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
$dllPath   = Join-Path $scriptDir 'ControlServiceLayer.dll'

if (-not (Test-Path $dllPath)) {
    $err = @{ id = 0; ok = $false; error = "ControlServiceLayer.dll not found at: $dllPath" } | ConvertTo-Json -Compress
    Write-Host $err
    exit 1
}

# Ensure config files are in place
$configDst = Join-Path $env:LOCALAPPDATA 'Nikon\NXTether'
if (-not (Test-Path $configDst)) { New-Item -ItemType Directory -Force -Path $configDst | Out-Null }
foreach ($f in @('DC_PTP_Config.config','MaidLayer.config','RangeValue.config')) {
    $src = Join-Path $scriptDir $f
    $dst = Join-Path $configDst $f
    if ((Test-Path $src) -and (-not (Test-Path $dst))) {
        Copy-Item $src $dst -Force
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

    [DllImport("kernel32.dll")] static extern bool FreeLibrary(IntPtr h);

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
    delegate void   ProgressFn(IntPtr r, uint done, uint total);
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
    [StructLayout(LayoutKind.Sequential)]
    struct NkMAIDDeviceInfo {
        public uint   ID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string Name;
        [MarshalAs(UnmanagedType.I1)]
        public bool   Availability;
        public uint   ulConnectedPID;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string Version;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct NkMAIDEnumDevices {
        public uint   ulElements;
        public IntPtr pDeviceData;  // NkMAIDDeviceInfo[]
    }

    // ── Function pointer delegates (SDK entry points) ─────────────────────
    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int SetLoggingLevelFn(uint level);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int InitializeSDKFn(
        IntPtr pAlloc, IntPtr pFree,
        ref NkMAIDCSCallback cb,
        out IntPtr ppDeviceList,
        IntPtr ppEnumCapInfo);

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
    delegate int GetLiveViewStatusFn(ref int pStatus);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int StartShootingFn(ref MAIDShootingStructure param, IntPtr pProc, IntPtr nkRef);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int GetShootingStatusFn(ref int pStatus);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int GetCapabilityFn(uint capId, ref uint pDataType, out IntPtr pValue);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int SetCapabilityFn(uint capId, uint dataType, IntPtr pValue);

    [UnmanagedFunctionPointer(CallingConvention.StdCall)]
    delegate int SetImageVideoSavePathFn(
        [MarshalAs(UnmanagedType.LPWStr)] string imagePath,
        [MarshalAs(UnmanagedType.LPWStr)] string videoPath);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct MAIDShootingStructure {
        public uint  shootingMode;
        public uint  delayTime;
        public uint  intervalTime;
        public uint  shootCount;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string ImageSavePath;
    }

    // ── NkMAIDLiveViewData (partial — only fields we use) ─────────────────
    [StructLayout(LayoutKind.Sequential)]
    struct NkMAIDLiveViewData {
        public uint  wVersion;
        public uint  wPhysicalBytes;
        public uint  ulLvImageSize;
        public IntPtr pImageData;
        public uint  ulLvHeaderSize;
        public IntPtr pHeaderData;
        public uint  wLvZoomFactor;
        public uint  wLvZoomCenterX;
        public uint  wLvZoomCenterY;
    }

    // ── Capability IDs (from MAID3-COMMON spec) ────────────────────────────
    const uint kNkMAIDCapability_BatteryLevel       = 0x0018;
    const uint kNkMAIDCapability_ExposureMode       = 0x0009;
    const uint kNkMAIDCapability_ShutterSpeed       = 0x000A;
    const uint kNkMAIDCapability_Aperture           = 0x000B;
    const uint kNkMAIDCapability_ISO                = 0x0010;
    const uint kNkMAIDDataType_Unsigned             = 0x0004;

    // NKMAID result codes
    const int kNkMAIDResult_NoError = 0;

    // ── Shooting mode constants ────────────────────────────────────────────
    const uint MAID_SHOOTING_MODE_SINGLE = 0;

    // ── State ──────────────────────────────────────────────────────────────
    static IntPtr hMod = IntPtr.Zero;
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
    static FreeSDKFn              fnFreeSDK;
    static ConnectDeviceFn        fnConnectDevice;
    static DisconnectDeviceFn     fnDisconnectDevice;
    static StartLiveViewFn        fnStartLiveView;
    static StopLiveViewFn         fnStopLiveView;
    static GetLiveViewStatusFn    fnGetLiveViewStatus;
    static StartShootingFn        fnStartShooting;
    static GetShootingStatusFn    fnGetShootingStatus;
    static GetCapabilityFn        fnGetCapability;
    static SetCapabilityFn        fnSetCapability;
    static SetImageVideoSavePathFn fnSetSavePath;

    // ── Device list pointer (SDK-owned memory) ─────────────────────────────
    static IntPtr pDeviceList = IntPtr.Zero;

    // ── Captured-image queue ──────────────────────────────────────────────
    static ConcurrentQueue<string> capturedImages = new ConcurrentQueue<string>();
    static string lastCapturedImagePath = "";

    // ── Callbacks ─────────────────────────────────────────────────────────
    static IntPtr MyAlloc(IntPtr size) { return Marshal.AllocHGlobal(size); }
    static void   MyFree(IntPtr p)     { Marshal.FreeHGlobal(p); }
    static uint   MyUIReq(IntPtr r, IntPtr req) { return 0; }

    static void MyEvent(IntPtr r, uint evt, IntPtr data) {
        // kNkMAIDEvent_AddChild=5, kNkMAIDEvent_RemoveChild=6,
        // kNkMAIDEvent_CaptureComplete=8, kNkMAIDEvent_ImageSaved=16
        if (evt == 8 || evt == 16) {
            // Capture complete / image saved — note it (path comes via DataProc/file)
        }
    }

    static void   MyProgress(IntPtr r, uint d, uint t) { }
    static int    MyData(IntPtr r, IntPtr info, IntPtr pdata) { return 0; }

    static void MyLiveView(IntPtr r, IntPtr pLV) {
        try {
            if (pLV == IntPtr.Zero) return;
            var lv = (NkMAIDLiveViewData)Marshal.PtrToStructure(pLV, typeof(NkMAIDLiveViewData));
            if (lv.ulLvImageSize == 0 || lv.pImageData == IntPtr.Zero) return;
            int sz = (int)lv.ulLvImageSize;
            byte[] buf = new byte[sz];
            Marshal.Copy(lv.pImageData, buf, 0, sz);
            latestLVFrameB64 = Convert.ToBase64String(buf);
            Interlocked.Increment(ref lvFrameCount);
        } catch { }
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
        fnFreeSDK         = GetFunc<FreeSDKFn>("FreeSDK");
        fnConnectDevice   = GetFunc<ConnectDeviceFn>("ConnectDevice");
        fnDisconnectDevice= GetFunc<DisconnectDeviceFn>("DisconnectDevice");
        fnStartLiveView   = GetFunc<StartLiveViewFn>("StartLiveView");
        fnStopLiveView    = GetFunc<StopLiveViewFn>("StopLiveView");
        fnGetLiveViewStatus = GetFunc<GetLiveViewStatusFn>("GetLiveViewStatus");
        fnStartShooting   = GetFunc<StartShootingFn>("StartShooting");
        fnGetShootingStatus = GetFunc<GetShootingStatusFn>("GetShootingStatus");
        fnGetCapability   = GetFunc<GetCapabilityFn>("GetCapability");
        fnSetCapability   = GetFunc<SetCapabilityFn>("SetCapability");
        fnSetSavePath     = GetFunc<SetImageVideoSavePathFn>("SetImageVideoSavePath");

        fnSetLoggingLevel(1); // Error level only

        var cb = new NkMAIDCSCallback {
            pUIReqProc       = Marshal.GetFunctionPointerForDelegate(uiDelegate),
            pfnEventProc     = Marshal.GetFunctionPointerForDelegate(eventDelegate),
            pProgressProc    = Marshal.GetFunctionPointerForDelegate(progressDelegate),
            pDataProc        = Marshal.GetFunctionPointerForDelegate(dataDelegate),
            pLiveViewDataProc= Marshal.GetFunctionPointerForDelegate(lvDelegate),
            refProc          = IntPtr.Zero
        };

        int res = fnInitializeSDK(
            Marshal.GetFunctionPointerForDelegate(allocDelegate),
            Marshal.GetFunctionPointerForDelegate(freeDelegate),
            ref cb,
            out pDeviceList,
            IntPtr.Zero);

        if (res != kNkMAIDResult_NoError)
            return Err(id, "InitializeSDK failed: " + res);

        sdkInitialized = true;
        return Ok(id, "{\"initialized\":true}");
    }

    static string CmdEnumDevices(int id) {
        if (!sdkInitialized) return Err(id, "SDK not initialized");
        if (pDeviceList == IntPtr.Zero) return Ok(id, "{\"devices\":[]}");

        var enumDevs = (NkMAIDEnumDevices)Marshal.PtrToStructure(pDeviceList, typeof(NkMAIDEnumDevices));
        int count = (int)enumDevs.ulElements;
        var sb = new StringBuilder();
        sb.Append("{\"devices\":[");
        int devSize = Marshal.SizeOf(typeof(NkMAIDDeviceInfo));
        for (int i = 0; i < count; i++) {
            var info = (NkMAIDDeviceInfo)Marshal.PtrToStructure(
                new IntPtr(enumDevs.pDeviceData.ToInt64() + i * devSize),
                typeof(NkMAIDDeviceInfo));
            if (i > 0) sb.Append(",");
            sb.Append("{\"id\":" + info.ID
                + ",\"name\":\"" + EscJson(info.Name) + "\""
                + ",\"available\":" + (info.Availability ? "true" : "false")
                + ",\"version\":\"" + EscJson(info.Version) + "\"}");
        }
        sb.Append("]}");
        return Ok(id, sb.ToString());
    }

    static string CmdConnect(int id, string line) {
        if (!sdkInitialized) return Err(id, "SDK not initialized");
        if (deviceConnected) return Ok(id, "{\"already\":true,\"name\":\"" + EscJson(connectedDeviceName) + "\"}");
        if (pDeviceList == IntPtr.Zero) return Err(id, "No device list");

        var enumDevs = (NkMAIDEnumDevices)Marshal.PtrToStructure(pDeviceList, typeof(NkMAIDEnumDevices));
        if (enumDevs.ulElements == 0) return Err(id, "No Nikon camera detected via USB");

        // Pick first available device
        int devSize = Marshal.SizeOf(typeof(NkMAIDDeviceInfo));
        NkMAIDDeviceInfo chosen = default(NkMAIDDeviceInfo);
        bool found = false;
        for (int i = 0; i < (int)enumDevs.ulElements; i++) {
            var info = (NkMAIDDeviceInfo)Marshal.PtrToStructure(
                new IntPtr(enumDevs.pDeviceData.ToInt64() + i * devSize),
                typeof(NkMAIDDeviceInfo));
            if (info.Availability) { chosen = info; found = true; break; }
        }
        if (!found) return Err(id, "No available Nikon camera (all in use or powered off)");

        int res = fnConnectDevice(chosen.ID, IntPtr.Zero);
        if (res != kNkMAIDResult_NoError)
            return Err(id, "ConnectDevice failed: " + res);

        connectedDeviceId   = chosen.ID;
        connectedDeviceName = chosen.Name.Trim('\0');
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

    static string CmdStatus(int id) {
        int battPct = -1;
        if (deviceConnected) {
            try {
                uint dtype = 0;
                IntPtr pVal;
                int r = fnGetCapability(kNkMAIDCapability_BatteryLevel, ref dtype, out pVal);
                if (r == kNkMAIDResult_NoError && pVal != IntPtr.Zero) {
                    uint raw = (uint)Marshal.ReadInt32(pVal);
                    // Battery: 0=critical,1=low,2=medium,3=full (typical MAID mapping)
                    battPct = (int)(raw * 33);
                    if (battPct > 100) battPct = 100;
                }
            } catch {}
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

        // Get LV status
        int lvStatus = 0;
        fnGetLiveViewStatus(ref lvStatus);

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

        // Clear captured queue
        string dummy;
        while (capturedImages.TryDequeue(out dummy)) {}

        var param = new MAIDShootingStructure {
            shootingMode = MAID_SHOOTING_MODE_SINGLE,
            delayTime    = 0,
            intervalTime = 0,
            shootCount   = 1,
            ImageSavePath = savePath
        };

        int res = fnStartShooting(ref param, IntPtr.Zero, IntPtr.Zero);
        if (res != kNkMAIDResult_NoError)
            return Err(id, "StartShooting failed: " + res);

        // Poll until done or timeout (5 s)
        int status = 0;
        int waited = 0;
        while (waited < 5000) {
            Thread.Sleep(100);
            waited += 100;
            fnGetShootingStatus(ref status);
            // status 0 = kNkSDKShootingFinishedOrNotStarted
            if (status == 0) break;
        }

        // Find most-recently modified file in temp with common camera extensions
        string found = FindLatestCapturedFile(savePath);
        return Ok(id, "{\"captured\":true,\"path\":\""
            + EscJson(found ?? "") + "\",\"status\":" + status + "}");
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

    static string CmdGetCapability(int id, uint capId) {
        if (!deviceConnected) return Err(id, "Camera not connected");
        try {
            uint dtype = 0;
            IntPtr pVal;
            int r = fnGetCapability(capId, ref dtype, out pVal);
            if (r != kNkMAIDResult_NoError) return Err(id, "GetCapability failed: " + r);
            uint val = (pVal != IntPtr.Zero) ? (uint)Marshal.ReadInt32(pVal) : 0;
            return Ok(id, "{\"capId\":" + capId + ",\"value\":" + val + ",\"dataType\":" + dtype + "}");
        } catch (Exception ex) {
            return Err(id, ex.Message);
        }
    }

    static string CmdSetCapability(int id, uint capId, uint value) {
        if (!deviceConnected) return Err(id, "Camera not connected");
        try {
            IntPtr pVal = Marshal.AllocHGlobal(4);
            Marshal.WriteInt32(pVal, (int)value);
            int r = fnSetCapability(capId, kNkMAIDDataType_Unsigned, pVal);
            Marshal.FreeHGlobal(pVal);
            if (r != kNkMAIDResult_NoError) return Err(id, "SetCapability failed: " + r);
            return Ok(id, "{\"capId\":" + capId + ",\"set\":true}");
        } catch (Exception ex) {
            return Err(id, ex.Message);
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
    public static void Run(string dllPath) {
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

[NikonBridge]::Run($dllPath)

