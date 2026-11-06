#Requires -Version 5.1
# ─────────────────────────────────────────────────────────────────────────────
#  NikonBridge.ps1  — HappyPix Nikon Remote SDK bridge (PowerShell C# host)
#  Runs as a persistent child process managed by NikonAdapter.ts
#  All communication via stdin/stdout line-delimited JSON:
#    IN (from Node):  {"id":1,"cmd":"connect"|"status"|"liveview_start"|...}
#    OUT (to Node):   {"id":1,"ok":true,"data":{...}} or {"id":1,"ok":false,"error":"..."}
#
#  Nikon SDK location: same directory as this script (resources/nikon/)
#  Config location:    %LOCALAPPDATA%\Nikon\NXTether  (pre-deployed)
# ─────────────────────────────────────────────────────────────────────────────

param()
$ErrorActionPreference = 'Stop'

# ── Determine resource directory ─────────────────────────────────────────────
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
# Allow a camera-specific Nikon SDK package to be selected without replacing the
# SDK files that may be needed by another camera build. The directory must be
# the SDK's BinaryFile/resource directory containing ControlServiceLayer.dll.
$sdkDir = $scriptDir
$sdkDirOverride = $env:HAPPYPIX_NIKON_SDK_DIR
if ([string]::IsNullOrWhiteSpace($sdkDirOverride)) { $sdkDirOverride = $env:NIKON_SDK_DIR }
if (-not [string]::IsNullOrWhiteSpace($sdkDirOverride)) {
    try {
        $sdkDir = (Resolve-Path -LiteralPath $sdkDirOverride -ErrorAction Stop).Path
    } catch {
        $err = @{ id = 0; ok = $false; error = "Nikon SDK directory does not exist: $sdkDirOverride" } | ConvertTo-Json -Compress
        [Console]::Out.WriteLine($err)
        exit 1
    }
}
$dllPath = Join-Path $sdkDir 'ControlServiceLayer.dll'

if (-not (Test-Path -LiteralPath $dllPath -PathType Leaf)) {
    $err = @{ id = 0; ok = $false; error = "ControlServiceLayer.dll not found at: $dllPath. Set HAPPYPIX_NIKON_SDK_DIR to the Nikon SDK folder containing the DLL." } | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($err)
    exit 1
}

# Keep the vendor profiles synchronized with the selected SDK. Previously these
# were copied only once, so cached profiles from a different Nikon SDK could
# silently take precedence over the camera-specific package being loaded.
$configDst = Join-Path $env:LOCALAPPDATA 'Nikon\NXTether'
if (-not (Test-Path -LiteralPath $configDst)) { New-Item -ItemType Directory -Force -Path $configDst | Out-Null }
foreach ($f in @('DC_PTP_Config.config','MaidLayer.config','RangeValue.config')) {
    $src = Join-Path $sdkDir $f
    $dst = Join-Path $configDst $f
    if (Test-Path -LiteralPath $src -PathType Leaf) {
        $needsCopy = -not (Test-Path -LiteralPath $dst -PathType Leaf)
        if (-not $needsCopy) {
            $needsCopy = (Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash -ne
                         (Get-FileHash -LiteralPath $dst -Algorithm SHA256).Hash
        }
        if ($needsCopy) {
            Copy-Item -LiteralPath $src -Destination ($dst + '.new') -Force
            Move-Item -LiteralPath ($dst + '.new') -Destination $dst -Force
        }
    }
}

# ── C# P/Invoke host (compiled at runtime, in-process) ───────────────────────
$csharpCode = @'
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Runtime.InteropServices;
using System.Collections.Generic;
using System.Collections.Concurrent;

public static class NikonBridge {

    // ── DLL Interop ────────────────────────────────────────────────────────
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Ansi)]
    static extern IntPtr LoadLibrary(string path);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr GetProcAddress(IntPtr hMod, string name);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    static extern bool SetDllDirectory(string path);

    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr h);

    // The SDK's returned buffers are allocated by the UCRT imported by
    // ControlServiceLayer.dll. Use that same allocator pair for callbacks and
    // SDK-owned output buffers; Marshal.FreeHGlobal is not interchangeable.
    [DllImport("ucrtbase.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "malloc")]
    static extern IntPtr CrtMalloc(IntPtr size);
    [DllImport("ucrtbase.dll", CallingConvention = CallingConvention.Cdecl, EntryPoint = "free")]
    static extern void CrtFree(IntPtr p);

    // ── MAID Delegate types ────────────────────────────────────────────────
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate IntPtr AllocFn(IntPtr size);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate void   FreeFn(IntPtr p);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate uint   UIReqFn(IntPtr r, IntPtr req);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate void   EventFn(IntPtr r, uint evt, IntPtr data);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate void   ProgressFn(uint msg, uint done, IntPtr data, uint dataType, uint total);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int    DataFn(IntPtr r, IntPtr info, IntPtr pdata);
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate void   LVDataFn(IntPtr r, IntPtr pLVData);

    [StructLayout(LayoutKind.Sequential)]
    struct NkMAIDCSCallback {
        public IntPtr pUIReqProc;
        public IntPtr pfnEventProc;
        public IntPtr pProgressProc;
        public IntPtr pDataProc;
        public IntPtr pLiveViewDataProc;
        public IntPtr refProc;
    }

    // ── NkMAIDEnumDevices layout ───────────────────────────────────────────
    // ControlServiceLayer uses Maid3.h's #pragma pack(push, 2). The enum
    // contains both ULONG fields before its device-data pointer; the previous
    // bridge treated the InitializeSDK output as this list and never enumerated.
    [StructLayout(LayoutKind.Sequential, Pack = 2, CharSet = CharSet.Ansi)]
    struct NkMAIDDeviceInfo {
        public uint ID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string Name;
        [MarshalAs(UnmanagedType.I1)]
        public bool Availability;
        public uint ulConnectedPID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string Version;
    }

    [StructLayout(LayoutKind.Sequential, Pack = 2)]
    struct NkMAIDEnumDevices {
        public uint ulElements;
        public uint ulValue;
        public IntPtr pDeviceData;
    }

    // ── Function pointer delegates (SDK entry points) ─────────────────────
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int SetLoggingLevelFn(uint level);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int InitializeSDKFn(
        IntPtr pAlloc, IntPtr pFree,
        IntPtr pCallbacks,
        IntPtr ppDevices,
        IntPtr ppEnumCapInfo);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int EnumDevicesFn(out IntPtr ppDevices, IntPtr pProc, IntPtr nkRef);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int FreeSDKFn();

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int ConnectDeviceFn(uint deviceId, IntPtr ppEnumCapInfo);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int DisconnectDeviceFn();

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int StartLiveViewFn(IntPtr pProc, IntPtr nkRef);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int StopLiveViewFn(IntPtr pProc, IntPtr nkRef);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int StartShootingFn(IntPtr pParam, IntPtr pProc, IntPtr nkRef);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int GetShootingStatusFn(ref int pStatus);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int GetCapabilityFn(uint capId, int request, IntPtr ppData, IntPtr pDataType);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int SetCapabilityFn(uint capId, IntPtr pValue, int dataType);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int SetImageVideoSavePathFn(
        [MarshalAs(UnmanagedType.LPWStr)] string imagePath,
        [MarshalAs(UnmanagedType.LPWStr)] string videoPath);

    // ── ControlServiceLayer data types (Maid3.h pack(2)) ──────────────────
    const int NK_GET_VALUE = 0;
    const int NK_GET_SUPPORTED_VALUES = 1;
    const int NK_DATA_UNSIGNED_PTR = 6;
    const int NK_DATA_ENUM_PTR = 16;
    const int NK_DATA_INTEGER_PTR = 5;
    const int NK_ENUM_HEADER_SIZE = 26;
    const int NK_ENUM_PDATA_OFFSET = 18;
    const int NK_ENUM_VALUE_OFFSET = 8;
    const int NK_ENUM_ELEMENTS_OFFSET = 4;
    const int NK_ENUM_TYPE_OFFSET = 0;
    const int NK_ENUM_DEFAULT_OFFSET = 12;
    const int NK_ENUM_PHYSICAL_BYTES_OFFSET = 16;
    const int NK_SHOOTING_SIZE = 2078;
    const int NK_SHOOTING_SAVE_PATH_OFFSET = 22;
    const int NK_SHOOTING_SAVE_PATH_CHARS = 1024;
    const int NK_LIVEVIEW_SIZE = 900;
    const int NK_LIVEVIEW_IMAGE_SIZE_OFFSET = 0;
    const int NK_LIVEVIEW_IMAGE_DATA_OFFSET = 892;
    const int NK_UI_REQUEST_DEFAULT_OFFSET = 4;

    // ── Capability IDs (Maid3d1.h) ────────────────────────────────────────
    const uint kNkMAIDCapability_BatteryLevel = 48;
    const uint kNkMAIDCapability_ExposureMode = 0x8111;
    const uint kNkMAIDCapability_ShutterSpeed = 0x8112;
    const uint kNkMAIDCapability_Aperture = 0x8113;
    const uint kNkMAIDCapability_ISO = 0x8117;
    const uint kNkMAIDCapability_SaveMedia = 0x8305;
    const int kNkMAIDSaveMedia_SDRAM = 1;

    // NKMAID result codes
    const int kNkMAIDResult_NoError = 0;
    const int kNkMAIDResult_SessionFailure = 142; // Maid3d1.h


    // ── State ──────────────────────────────────────────────────────────────
    static IntPtr hMod = IntPtr.Zero;
    static IntPtr callbackBlock = IntPtr.Zero;
    static string sdkDirectory = "";
    static string sdkFileVersion = "unknown";
    static bool sdkInitialized = false;
    static bool deviceConnected = false;
    static uint connectedDeviceId = 0;
    static string connectedDeviceName = "";
    static bool liveViewActive = false;

    // Captured live-view frame (latest JPEG bytes, base64 encoded)
    static string latestLVFrameB64 = "";
    static int    lvFrameCount = 0;

    // ── Delegates kept alive (prevent GC) ─────────────────────────────────
    static AllocFn    allocDelegate;
    static FreeFn     freeDelegate;
    static UIReqFn    uiDelegate;
    static EventFn    eventDelegate;
    static ProgressFn progressDelegate;
    static DataFn     dataDelegate;
    static LVDataFn   lvDelegate;

    // ── SDK function pointers ─────────────────────────────────────────────
    static SetLoggingLevelFn      fnSetLoggingLevel;
    static InitializeSDKFn        fnInitializeSDK;
    static EnumDevicesFn          fnEnumDevices;
    static FreeSDKFn              fnFreeSDK;
    static ConnectDeviceFn        fnConnectDevice;
    static DisconnectDeviceFn     fnDisconnectDevice;
    static StartLiveViewFn        fnStartLiveView;
    static StopLiveViewFn         fnStopLiveView;
    static StartShootingFn        fnStartShooting;
    static GetShootingStatusFn    fnGetShootingStatus;
    static GetCapabilityFn        fnGetCapability;
    static SetCapabilityFn        fnSetCapability;
    static SetImageVideoSavePathFn fnSetSavePath;


    // ── Captured-image queue ──────────────────────────────────────────────
    static ConcurrentQueue<string> capturedImages = new ConcurrentQueue<string>();
    static string lastCapturedImagePath = "";

    // ── Callbacks ─────────────────────────────────────────────────────────
    static IntPtr MyAlloc(IntPtr size) { return CrtMalloc(size); }
    static void   MyFree(IntPtr p)     { if (p != IntPtr.Zero) CrtFree(p); }
    static uint MyUIReq(IntPtr r, IntPtr req) {
        // Return the SDK-provided default rather than hard-coding an invalid
        // zero answer to every modal UI request.
        if (req == IntPtr.Zero) return 0;
        try { return (uint)Marshal.ReadInt32(req, NK_UI_REQUEST_DEFAULT_OFFSET); }
        catch { return 0; }
    }

    static void MyEvent(IntPtr r, uint evt, IntPtr data) {
        // kNkMAIDEvent_AddChild=5, kNkMAIDEvent_RemoveChild=6,
        // kNkMAIDEvent_CaptureComplete=8, kNkMAIDEvent_ImageSaved=16
        if (evt == 8 || evt == 16) {
            // Capture complete / image saved — note it (path comes via DataProc/file)
        }
    }

    static void MyProgress(uint msg, uint done, IntPtr data, uint dataType, uint total) { }
    static int MyData(IntPtr r, IntPtr info, IntPtr pdata) { return 0; }

    static void MyLiveView(IntPtr r, IntPtr pLV) {
        IntPtr imageData = IntPtr.Zero;
        try {
            if (pLV == IntPtr.Zero) return;
            int imageSize = Marshal.ReadInt32(pLV, NK_LIVEVIEW_IMAGE_SIZE_OFFSET);
            imageData = Marshal.ReadIntPtr(pLV, NK_LIVEVIEW_IMAGE_DATA_OFFSET);
            if (imageSize <= 0 || imageData == IntPtr.Zero || imageSize > 64 * 1024 * 1024) return;
            byte[] buf = new byte[imageSize];
            Marshal.Copy(imageData, buf, 0, imageSize);
            latestLVFrameB64 = Convert.ToBase64String(buf);
            Interlocked.Increment(ref lvFrameCount);
        } catch { }
        finally {
            // The Remote SDK transfers ownership of both buffers to this callback.
            try { if (imageData != IntPtr.Zero) MyFree(imageData); } catch { }
            try { if (pLV != IntPtr.Zero) MyFree(pLV); } catch { }
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────────
    static T GetFunc<T>(string name) {
        IntPtr ptr = GetProcAddress(hMod, name);
        if (ptr == IntPtr.Zero) throw new Exception("DLL export not found: " + name);
        return (T)(object)Marshal.GetDelegateForFunctionPointer(ptr, typeof(T));
    }

    static string EscJson(string s) {
        return s == null ? "" : s.Replace("\\","\\\\").Replace("\"","\\\"").Replace("\n","\\n").Replace("\r","");
    }

    static string Ok(int id, string dataJson) {
        return "{\"id\":" + id + ",\"ok\":true,\"data\":" + dataJson + "}";
    }

    static string Err(int id, string msg) {
        return "{\"id\":" + id + ",\"ok\":false,\"error\":\"" + EscJson(msg) + "\"}";
    }

    // ── Command handlers ───────────────────────────────────────────────────

    static string CmdInit(int id) {
        if (sdkInitialized) return Ok(id, "{\"already\":true}");

        allocDelegate    = MyAlloc;
        freeDelegate     = MyFree;
        uiDelegate       = MyUIReq;
        eventDelegate    = MyEvent;
        progressDelegate = MyProgress;
        dataDelegate     = MyData;
        lvDelegate       = MyLiveView;

        fnSetLoggingLevel = GetFunc<SetLoggingLevelFn>("SetLoggingLevel");
        fnInitializeSDK   = GetFunc<InitializeSDKFn>("InitializeSDK");
        fnEnumDevices     = GetFunc<EnumDevicesFn>("EnumDevices");
        fnFreeSDK         = GetFunc<FreeSDKFn>("FreeSDK");
        fnConnectDevice   = GetFunc<ConnectDeviceFn>("ConnectDevice");
        fnDisconnectDevice= GetFunc<DisconnectDeviceFn>("DisconnectDevice");
        fnStartLiveView   = GetFunc<StartLiveViewFn>("StartLiveView");
        fnStopLiveView    = GetFunc<StopLiveViewFn>("StopLiveView");
        fnStartShooting   = GetFunc<StartShootingFn>("StartShooting");
        fnGetShootingStatus = GetFunc<GetShootingStatusFn>("GetShootingStatus");
        fnGetCapability   = GetFunc<GetCapabilityFn>("GetCapability");
        fnSetCapability   = GetFunc<SetCapabilityFn>("SetCapability");
        fnSetSavePath     = GetFunc<SetImageVideoSavePathFn>("SetImageVideoSavePath");

        fnSetLoggingLevel(2); // Error level (eNkMAIDLoggingLevel)

        var cb = new NkMAIDCSCallback {
            pUIReqProc       = Marshal.GetFunctionPointerForDelegate(uiDelegate),
            pfnEventProc     = Marshal.GetFunctionPointerForDelegate(eventDelegate),
            pProgressProc    = Marshal.GetFunctionPointerForDelegate(progressDelegate),
            pDataProc        = Marshal.GetFunctionPointerForDelegate(dataDelegate),
            pLiveViewDataProc= Marshal.GetFunctionPointerForDelegate(lvDelegate),
            refProc          = IntPtr.Zero
        };
        callbackBlock = Marshal.AllocHGlobal(Marshal.SizeOf(typeof(NkMAIDCSCallback)));
        Marshal.StructureToPtr(cb, callbackBlock, false);

        // This API takes the callback block itself and NULL for its optional
        // device/capability outputs. Enumeration is a separate EnumDevices call.
        int res = fnInitializeSDK(
            Marshal.GetFunctionPointerForDelegate(allocDelegate),
            Marshal.GetFunctionPointerForDelegate(freeDelegate),
            callbackBlock,
            IntPtr.Zero,
            IntPtr.Zero);

        if (res != kNkMAIDResult_NoError) {
            if (callbackBlock != IntPtr.Zero) { Marshal.FreeHGlobal(callbackBlock); callbackBlock = IntPtr.Zero; }
            return Err(id, "InitializeSDK failed: " + DescribeSdkResult(res));
        }

        sdkInitialized = true;
        return Ok(id, "{\"initialized\":true,\"sdkDir\":\"" + EscJson(sdkDirectory)
            + "\",\"sdkVersion\":\"" + EscJson(sdkFileVersion)
            + "\",\"processBits\":" + (IntPtr.Size * 8) + "}");
    }

    static int ReadDevices(out List<NkMAIDDeviceInfo> devices) {
        devices = new List<NkMAIDDeviceInfo>();
        IntPtr list = IntPtr.Zero;
        try {
            int result = fnEnumDevices(out list, IntPtr.Zero, IntPtr.Zero);
            if (result != kNkMAIDResult_NoError) return result;
            if (list == IntPtr.Zero) return kNkMAIDResult_NoError;
            var enumDevs = (NkMAIDEnumDevices)Marshal.PtrToStructure(list, typeof(NkMAIDEnumDevices));
            int count = Math.Min((int)enumDevs.ulElements, 128);
            int devSize = Marshal.SizeOf(typeof(NkMAIDDeviceInfo));
            if (count > 0 && enumDevs.pDeviceData != IntPtr.Zero) {
                for (int i = 0; i < count; i++) {
                    IntPtr item = new IntPtr(enumDevs.pDeviceData.ToInt64() + (long)i * devSize);
                    devices.Add((NkMAIDDeviceInfo)Marshal.PtrToStructure(item, typeof(NkMAIDDeviceInfo)));
                }
            }
            return kNkMAIDResult_NoError;
        } finally {
            if (list != IntPtr.Zero) {
                try {
                    var enumDevs = (NkMAIDEnumDevices)Marshal.PtrToStructure(list, typeof(NkMAIDEnumDevices));
                    if (enumDevs.pDeviceData != IntPtr.Zero) MyFree(enumDevs.pDeviceData);
                } catch { }
                try { MyFree(list); } catch { }
            }
        }
    }

    static string CmdEnumDevices(int id) {
        if (!sdkInitialized) return Err(id, "SDK not initialized");
        List<NkMAIDDeviceInfo> devices;
        int result = ReadDevices(out devices);
        if (result != kNkMAIDResult_NoError)
            return Err(id, "EnumDevices failed: " + DescribeSdkResult(result));
        var sb = new StringBuilder();
        sb.Append("{\"devices\":[");
        for (int i = 0; i < devices.Count; i++) {
            var info = devices[i];
            if (i > 0) sb.Append(",");
            sb.Append("{\"id\":" + info.ID
                + ",\"name\":\"" + EscJson((info.Name ?? "").Trim('\0')) + "\""
                + ",\"available\":" + (info.Availability ? "true" : "false")
                + ",\"productId\":" + info.ulConnectedPID
                + ",\"version\":\"" + EscJson((info.Version ?? "").Trim('\0')) + "\"}");
        }
        sb.Append("]}");
        return Ok(id, sb.ToString());
    }

    static string CmdConnect(int id, string line) {
        if (!sdkInitialized) return Err(id, "SDK not initialized");
        if (deviceConnected) return Ok(id, "{\"already\":true,\"name\":\"" + EscJson(connectedDeviceName) + "\"}");
        List<NkMAIDDeviceInfo> devices;
        int enumResult = ReadDevices(out devices);
        if (enumResult != kNkMAIDResult_NoError)
            return Err(id, "EnumDevices failed: " + DescribeSdkResult(enumResult));
        if (devices.Count == 0) return Err(id, "No Nikon camera detected via USB");

        // Prefer the explicitly requested device ID; otherwise choose the first
        // available camera as before.
        int requestedId = ExtractInt(line, "\"deviceId\"");
        bool hasRequestedId = line.IndexOf("\"deviceId\"", StringComparison.Ordinal) >= 0;
        NkMAIDDeviceInfo chosen = default(NkMAIDDeviceInfo);
        bool found = false;
        for (int i = 0; i < devices.Count; i++) {
            var info = devices[i];
            if (info.Availability && (!hasRequestedId || info.ID == (uint)requestedId)) {
                chosen = info;
                found = true;
                break;
            }
        }
        if (!found) {
            return Err(id, hasRequestedId
                ? "Requested Nikon device ID is not available: " + requestedId
                : "No available Nikon camera (all in use or powered off)");
        }

        int res = fnConnectDevice(chosen.ID, IntPtr.Zero);
        if (res != kNkMAIDResult_NoError) {
            string message = "ConnectDevice failed: " + DescribeSdkResult(res)
                + " (camera=\"" + (chosen.Name ?? "").Trim('\0') + "\", id=" + chosen.ID
                + ", productId=" + chosen.ulConnectedPID
                + ", sdk=\"" + sdkDirectory + "\", ControlServiceLayer=" + sdkFileVersion
                + "). Close NX Tether/Camera Control Pro/Nikon Transfer and other camera apps, then reconnect the camera by USB.";
            return Err(id, message);
        }

        connectedDeviceId   = chosen.ID;
        connectedDeviceName = (chosen.Name ?? "").Trim('\0');
        deviceConnected = true;

        // Set save path to temp dir so SDK can save images autonomously
        string tempPath = Path.GetTempPath();
        fnSetSavePath(tempPath, tempPath);
        lastCapturedImagePath = tempPath;

        return Ok(id, "{\"connected\":true,\"name\":\"" + EscJson(connectedDeviceName) + "\",\"id\":" + chosen.ID + "}");
    }

    static string CmdDisconnect(int id) {
        if (!deviceConnected) return Ok(id, "{\"disconnected\":true}");
        if (liveViewActive) {
            try { fnStopLiveView(IntPtr.Zero, IntPtr.Zero); } catch {}
            liveViewActive = false;
        }
        try { fnDisconnectDevice(); } catch {}
        deviceConnected = false;
        connectedDeviceId = 0;
        connectedDeviceName = "";
        return Ok(id, "{\"disconnected\":true}");
    }

    static string DescribeSdkResult(int code) {
        if (code == kNkMAIDResult_NoError) return "0 (NoError)";
        if (code == kNkMAIDResult_SessionFailure) return "142 (SessionFailure)";
        // Result 179 is outside the published MAID standard/D5600 result range;
        // preserve its numeric value without inventing a vendor-specific label.
        return code.ToString();
    }

    static int GetCapabilityRaw(uint capId, int request, out IntPtr value, out int dataType) {
        value = IntPtr.Zero;
        dataType = 0;
        IntPtr ppData = Marshal.AllocHGlobal(IntPtr.Size);
        IntPtr pType = Marshal.AllocHGlobal(4);
        try {
            Marshal.WriteIntPtr(ppData, IntPtr.Zero);
            Marshal.WriteInt32(pType, 0);
            int result = fnGetCapability(capId, request, ppData, pType);
            value = Marshal.ReadIntPtr(ppData);
            dataType = Marshal.ReadInt32(pType);
            return result;
        } finally {
            Marshal.FreeHGlobal(ppData);
            Marshal.FreeHGlobal(pType);
        }
    }

    static string CmdStatus(int id) {
        int battPct = -1;
        if (deviceConnected) {
            IntPtr pVal = IntPtr.Zero;
            try {
                int dtype;
                int r = GetCapabilityRaw(kNkMAIDCapability_BatteryLevel, NK_GET_VALUE, out pVal, out dtype);
                if (r == kNkMAIDResult_NoError && pVal != IntPtr.Zero) {
                    int raw = Marshal.ReadInt32(pVal);
                    if (dtype == NK_DATA_INTEGER_PTR && raw >= 0 && raw <= 100) battPct = raw;
                }
            } catch {} finally { if (pVal != IntPtr.Zero) { try { MyFree(pVal); } catch { } } }
        }

        string statusJson = "{\"sdkInitialized\":" + (sdkInitialized ? "true" : "false")
            + ",\"connected\":" + (deviceConnected ? "true" : "false")
            + ",\"model\":\"" + EscJson(connectedDeviceName) + "\""
            + ",\"liveView\":" + (liveViewActive ? "true" : "false")
            + ",\"batteryPct\":" + (battPct >= 0 ? battPct.ToString() : "null")
            + "}";
        return Ok(id, statusJson);
    }

    static string CmdLiveViewStart(int id) {
        if (!deviceConnected) return Err(id, "Camera not connected");
        if (liveViewActive) return Ok(id, "{\"started\":true,\"already\":true}");

        int res = fnStartLiveView(IntPtr.Zero, IntPtr.Zero);
        if (res != kNkMAIDResult_NoError)
            return Err(id, "StartLiveView failed: " + res);

        liveViewActive = true;
        latestLVFrameB64 = "";
        lvFrameCount = 0;
        return Ok(id, "{\"started\":true}");
    }

    static string CmdLiveViewStop(int id) {
        if (!liveViewActive) return Ok(id, "{\"stopped\":true}");
        try { fnStopLiveView(IntPtr.Zero, IntPtr.Zero); } catch {}
        liveViewActive = false;
        return Ok(id, "{\"stopped\":true}");
    }

    static string CmdLiveViewFrame(int id) {
        // Return latest buffered LV frame (base64 JPEG)
        string frame = latestLVFrameB64;
        return Ok(id, "{\"frame\":" + (frame.Length > 0 ? "\"" + frame + "\"" : "null")
            + ",\"count\":" + lvFrameCount + "}");
    }

    static string CmdCapture(int id) {
        if (!deviceConnected) return Err(id, "Camera not connected");

        string savePath = Path.GetTempPath();
        fnSetSavePath(savePath, savePath);
        SetUnsignedCapability(kNkMAIDCapability_SaveMedia, kNkMAIDSaveMedia_SDRAM);

        string dummy;
        while (capturedImages.TryDequeue(out dummy)) {}

        IntPtr param = Marshal.AllocHGlobal(NK_SHOOTING_SIZE);
        try {
            byte[] bytes = new byte[NK_SHOOTING_SIZE];
            // MAIDShootingStructure: eNkMAIDShootingType::Single (1), one
            // shot, autofocus enabled, UTF-16 save directory, null output ref.
            Array.Copy(BitConverter.GetBytes((uint)1), 0, bytes, 0, 4);
            Array.Copy(BitConverter.GetBytes((uint)1), 0, bytes, 4, 4);
            bytes[20] = 1;
            byte[] pathBytes = Encoding.Unicode.GetBytes(savePath);
            int maxPathBytes = (NK_SHOOTING_SAVE_PATH_CHARS - 1) * 2;
            if (pathBytes.Length > maxPathBytes)
                return Err(id, "Capture folder path is too long for the Nikon SDK");
            Array.Copy(pathBytes, 0, bytes, NK_SHOOTING_SAVE_PATH_OFFSET, pathBytes.Length);
            Marshal.Copy(bytes, 0, param, bytes.Length);

            int res = fnStartShooting(param, IntPtr.Zero, IntPtr.Zero);
            if (res != kNkMAIDResult_NoError)
                return Err(id, "StartShooting failed: " + DescribeSdkResult(res));
        } finally {
            Marshal.FreeHGlobal(param);
        }

        int status = 1;
        int waited = 0;
        while (waited < 10000) {
            Thread.Sleep(100);
            waited += 100;
            int statusResult = fnGetShootingStatus(ref status);
            if (statusResult != kNkMAIDResult_NoError) break;
            if (status == 0) break;
        }

        string found = FindLatestCapturedFile(savePath);
        if (string.IsNullOrEmpty(found))
            return Err(id, "Nikon SDK accepted the shot but no image file appeared in " + savePath + " (shooting status=" + status + ")");
        return Ok(id, "{\"captured\":true,\"path\":\""
            + EscJson(found) + "\",\"status\":" + status + "}");
    }

    static int SetUnsignedCapability(uint capId, uint value) {
        IntPtr data = Marshal.AllocHGlobal(4);
        try {
            Marshal.WriteInt32(data, unchecked((int)value));
            return fnSetCapability(capId, data, NK_DATA_UNSIGNED_PTR);
        } finally {
            Marshal.FreeHGlobal(data);
        }
    }

    static string FindLatestCapturedFile(string dir) {
        try {
            string[] exts = { "*.jpg", "*.jpeg", "*.nef", "*.nrw" };
            DateTime best = DateTime.MinValue;
            string bestFile = null;
            foreach (var ext in exts) {
                foreach (var f in Directory.GetFiles(dir, ext)) {
                    var t = File.GetLastWriteTime(f);
                    if (t > best) { best = t; bestFile = f; }
                }
            }
            // Only return if file was created/modified in last 15 seconds
            if (bestFile != null && (DateTime.Now - best).TotalSeconds < 15)
                return bestFile;
        } catch {}
        return null;
    }

    static bool IsEnumCapability(uint capId) {
        return capId == kNkMAIDCapability_ExposureMode || capId == kNkMAIDCapability_ShutterSpeed
            || capId == kNkMAIDCapability_Aperture || capId == kNkMAIDCapability_ISO;
    }

    static string CmdGetCapability(int id, uint capId) {
        if (!deviceConnected) return Err(id, "Camera not connected");
        IntPtr value = IntPtr.Zero;
        try {
            int dataType;
            int result = GetCapabilityRaw(capId, NK_GET_VALUE, out value, out dataType);
            if (result != kNkMAIDResult_NoError) return Err(id, "GetCapability failed: " + DescribeSdkResult(result));
            if (value == IntPtr.Zero) return Err(id, "GetCapability returned a null value for capability " + capId);
            uint raw;
            if (IsEnumCapability(capId) && dataType == NK_DATA_ENUM_PTR) {
                raw = unchecked((uint)Marshal.ReadInt32(value, NK_ENUM_VALUE_OFFSET));
            } else {
                raw = unchecked((uint)Marshal.ReadInt32(value));
            }
            return Ok(id, "{\"capId\":" + capId + ",\"value\":" + raw + ",\"dataType\":" + dataType + "}");
        } catch (Exception ex) {
            return Err(id, ex.Message);
        } finally {
            if (value != IntPtr.Zero) { try { MyFree(value); } catch { } }
        }
    }

    static string CmdSetCapability(int id, uint capId, uint value) {
        if (!deviceConnected) return Err(id, "Camera not connected");
        IntPtr native = IntPtr.Zero;
        try {
            int dataType;
            int result;
            if (IsEnumCapability(capId)) {
                IntPtr current = IntPtr.Zero;
                try {
                    result = GetCapabilityRaw(capId, NK_GET_VALUE, out current, out dataType);
                    if (result != kNkMAIDResult_NoError) return Err(id, "GetCapability before enum set failed: " + DescribeSdkResult(result));
                    if (current == IntPtr.Zero || dataType != NK_DATA_ENUM_PTR)
                        return Err(id, "Nikon enum capability returned an unexpected data layout (type=" + dataType + ")");
                    byte[] header = new byte[NK_ENUM_HEADER_SIZE];
                    Marshal.Copy(current, header, 0, header.Length);
                    Array.Copy(BitConverter.GetBytes(value), 0, header, NK_ENUM_VALUE_OFFSET, 4);
                    // The SDK requires a null pData for a set operation.
                    Array.Clear(header, NK_ENUM_PDATA_OFFSET, IntPtr.Size);
                    native = Marshal.AllocHGlobal(header.Length);
                    Marshal.Copy(header, 0, native, header.Length);
                    result = fnSetCapability(capId, native, NK_DATA_ENUM_PTR);
                } finally {
                    if (current != IntPtr.Zero) { try { MyFree(current); } catch { } }
                }
            } else {
                native = Marshal.AllocHGlobal(4);
                Marshal.WriteInt32(native, unchecked((int)value));
                result = fnSetCapability(capId, native, NK_DATA_UNSIGNED_PTR);
            }
            if (result != kNkMAIDResult_NoError) return Err(id, "SetCapability failed: " + DescribeSdkResult(result));
            return Ok(id, "{\"capId\":" + capId + ",\"set\":true}");
        } catch (Exception ex) {
            return Err(id, ex.Message);
        } finally {
            if (native != IntPtr.Zero) Marshal.FreeHGlobal(native);
        }
    }

    static string CmdReadImageFile(int id, string path) {
        try {
            if (string.IsNullOrEmpty(path) || !File.Exists(path))
                return Err(id, "File not found: " + path);
            byte[] bytes = File.ReadAllBytes(path);
            string b64 = Convert.ToBase64String(bytes);
            string ext = Path.GetExtension(path).ToLower().TrimStart('.');
            string mime = (ext == "jpg" || ext == "jpeg") ? "image/jpeg" : "image/" + ext;
            return Ok(id, "{\"size\":" + bytes.Length
                + ",\"ext\":\"" + ext + "\""
                + ",\"dataUrl\":\"data:" + mime + ";base64," + b64 + "\"}");
        } catch (Exception ex) {
            return Err(id, ex.Message);
        }
    }

    // ── Main command router ────────────────────────────────────────────────
    public static void Run(string dllPath, string sdkDir) {
        sdkDirectory = sdkDir ?? "";
        try { sdkFileVersion = System.Diagnostics.FileVersionInfo.GetVersionInfo(dllPath).FileVersion ?? "unknown"; } catch { }
        // Resolve Nikon's adjacent DLL dependencies from the selected SDK folder,
        // not from an arbitrary global installation on the user's PATH.
        SetDllDirectory(sdkDirectory);
        hMod = LoadLibrary(dllPath);
        if (hMod == IntPtr.Zero) {
            Console.WriteLine("{\"id\":0,\"ok\":false,\"error\":\"LoadLibrary failed: " + Marshal.GetLastWin32Error() + "\"}");
            Console.Out.Flush();
            return;
        }

        // Signal ready
        Console.WriteLine("{\"id\":0,\"ok\":true,\"data\":{\"ready\":true,\"pid\":" + System.Diagnostics.Process.GetCurrentProcess().Id + "}}");
        Console.Out.Flush();

        string line;
        while ((line = Console.In.ReadLine()) != null) {
            line = line.Trim();
            if (line.Length == 0) continue;
            string response = DispatchCommand(line);
            Console.WriteLine(response);
            Console.Out.Flush();
        }

        // Cleanup on stdin close
        try {
            if (liveViewActive) { try { fnStopLiveView(IntPtr.Zero, IntPtr.Zero); } catch {} }
            if (deviceConnected) { try { fnDisconnectDevice(); } catch {} }
            if (sdkInitialized) { try { fnFreeSDK(); } catch {} }
            if (callbackBlock != IntPtr.Zero) { Marshal.FreeHGlobal(callbackBlock); callbackBlock = IntPtr.Zero; }
        } catch {}
        if (hMod != IntPtr.Zero) FreeLibrary(hMod);
    }

    static string DispatchCommand(string line) {
        int id = 0;
        try {
            // Minimal JSON parser (no deps) — extract id and cmd fields
            int jId = ExtractInt(line, "\"id\"");
            id = jId;
            string cmd = ExtractStr(line, "\"cmd\"");
            switch (cmd) {
                case "init":   return CmdInit(id);
                case "devices":return CmdEnumDevices(id);
                case "connect":return CmdConnect(id, line);
                case "disconnect": return CmdDisconnect(id);
                case "status": return CmdStatus(id);
                case "liveview_start": return CmdLiveViewStart(id);
                case "liveview_stop":  return CmdLiveViewStop(id);
                case "liveview_frame": return CmdLiveViewFrame(id);
                case "capture":return CmdCapture(id);
                case "get_cap": {
                    uint capId = (uint)ExtractInt(line, "\"capId\"");
                    return CmdGetCapability(id, capId);
                }
                case "set_cap": {
                    uint capId = (uint)ExtractInt(line, "\"capId\"");
                    uint val   = (uint)ExtractInt(line, "\"value\"");
                    return CmdSetCapability(id, capId, val);
                }
                case "read_image": {
                    string path = ExtractStr(line, "\"path\"");
                    return CmdReadImageFile(id, path);
                }
                case "shutdown":
                    CmdDisconnect(id);
                    if (sdkInitialized) { try { fnFreeSDK(); } catch {} sdkInitialized = false; }
                    if (callbackBlock != IntPtr.Zero) { Marshal.FreeHGlobal(callbackBlock); callbackBlock = IntPtr.Zero; }
                    return Ok(id, "{\"shutdown\":true}");
                default:
                    return Err(id, "Unknown command: " + cmd);
            }
        } catch (Exception ex) {
            return "{\"id\":" + id + ",\"ok\":false,\"error\":\"" + EscJson(ex.Message) + "\"}";
        }
    }

    // ── Tiny JSON field extractors ─────────────────────────────────────────
    static int ExtractInt(string json, string key) {
        int ki = json.IndexOf(key);
        if (ki < 0) return 0;
        int ci = json.IndexOf(':', ki + key.Length);
        if (ci < 0) return 0;
        int start = ci + 1;
        while (start < json.Length && (json[start] == ' ' || json[start] == '\t')) start++;
        int end = start;
        if (end < json.Length && json[end] == '-') end++;
        while (end < json.Length && char.IsDigit(json[end])) end++;
        if (start == end) return 0;
        return int.Parse(json.Substring(start, end - start));
    }

    static string ExtractStr(string json, string key) {
        int ki = json.IndexOf(key);
        if (ki < 0) return "";
        int ci = json.IndexOf(':', ki + key.Length);
        if (ci < 0) return "";
        int q1 = json.IndexOf('"', ci + 1);
        if (q1 < 0) return "";
        int q2 = q1 + 1;
        while (q2 < json.Length) {
            if (json[q2] == '\\') { q2 += 2; continue; }
            if (json[q2] == '"') break;
            q2++;
        }
        return json.Substring(q1 + 1, q2 - q1 - 1).Replace("\\\"","\"").Replace("\\\\","\\");
    }
}
'@

try {
    if (-not ([System.Management.Automation.PSTypeName]'NikonBridge').Type) {
        Add-Type -TypeDefinition $csharpCode -Language CSharp -ErrorAction Stop
    }
} catch {
    $err = @{ id = 0; ok = $false; error = "Compile error: $($_.Exception.Message)" } | ConvertTo-Json -Compress
    Write-Host $err
    exit 1
}

[NikonBridge]::Run($dllPath, $sdkDir)
