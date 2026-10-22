param(
    [string]$PrinterName = ""
)

$ErrorActionPreference = 'SilentlyContinue'

# Resolve DLL path dynamically relative to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$dllPath = Join-Path $scriptDir "CyStat64.dll"

if (-not (Test-Path $dllPath)) {
    @{
        success = $false
        connected = $false
        error = "CyStat64.dll not found at $dllPath"
    } | ConvertTo-Json -Compress
    exit 0
}

# Define C# P/Invoke wrapper for CyStat64.dll
$typeDef = @"
using System;
using System.Runtime.InteropServices;

public class DnpNativeBridge {
    [DllImport("$($dllPath.Replace('\', '\\'))", CharSet = CharSet.Unicode, EntryPoint = "PortInitialize")]
    public static extern int PortInitialize(string printerName);

    [DllImport("$($dllPath.Replace('\', '\\'))", EntryPoint = "GetStatus")]
    public static extern int GetStatus(int portNum);

    [DllImport("$($dllPath.Replace('\', '\\'))", EntryPoint = "GetMediaCounter")]
    public static extern int GetMediaCounter(int portNum);

    [DllImport("$($dllPath.Replace('\', '\\'))", EntryPoint = "GetInitialMediaCount")]
    public static extern int GetInitialMediaCount(int portNum);

    [DllImport("$($dllPath.Replace('\', '\\'))", EntryPoint = "GetCounterL")]
    public static extern int GetCounterL(int portNum);
}
"@

try {
    if (-not ([System.Management.Automation.PSTypeName]'DnpNativeBridge').Type) {
        Add-Type -TypeDefinition $typeDef -ErrorAction Stop
    }
} catch {
    # If type definition fails, return clean JSON
    @{
        success = $false
        connected = $false
        error = "Could not bind CyStat64.dll: $($_.Exception.Message)"
    } | ConvertTo-Json -Compress
    exit 0
}

# Determine candidate printer names
$candidates = @()
if ($PrinterName) { $candidates += $PrinterName }
$candidates += @("DS-RX1", "DNP DS-RX1", "DS-RX1HS", "DNP DS-RX1HS", "DS620", "DNP DS620")

$portNum = -1
$activePrinter = ""

foreach ($p in $candidates) {
    try {
        $pNum = [DnpNativeBridge]::PortInitialize($p)
        if ($pNum -ge 0) {
            $portNum = $pNum
            $activePrinter = $p
            break
        }
    } catch {
        # continue trying next candidate
    }
}

if ($portNum -lt 0) {
    # Printer not physically attached or powered off
    @{
        success = $true
        connected = $false
        status = "offline"
        paperRemaining = $null
        ribbonRemaining = $null
        lifetimePrints = $null
        error = "DNP RX1HS is not detected on USB. Please check USB cable and power."
    } | ConvertTo-Json -Compress
    exit 0
}

# Read hardware status
$statusCode = [DnpNativeBridge]::GetStatus($portNum)
$remaining = [DnpNativeBridge]::GetMediaCounter($portNum)
$initialCount = [DnpNativeBridge]::GetInitialMediaCount($portNum)
$lifetime = [DnpNativeBridge]::GetCounterL($portNum)

# Calculate Ribbon / Paper percentage
$percent = $null
if ($initialCount -gt 0 -and $remaining -ge 0) {
    $percent = [Math]::Round(($remaining / $initialCount) * 100)
}

# Map status flags
$statusText = "idle"
$errorText = $null

if (($statusCode -band 0x00010008) -ne 0) {
    $statusText = "paper_end"
    $errorText = "Paper roll empty. Please load new paper roll."
} elseif (($statusCode -band 0x00010010) -ne 0) {
    $statusText = "ribbon_end"
    $errorText = "Ribbon depleted. Please replace color ribbon."
} elseif (($statusCode -band 0x00020001) -ne 0) {
    $statusText = "cover_open"
    $errorText = "Printer door / cover open."
} elseif (($statusCode -band 0x00020002) -ne 0) {
    $statusText = "paper_jam"
    $errorText = "Paper jam detected inside printer."
} elseif (($statusCode -band 0x00010002) -ne 0) {
    $statusText = "printing"
}

@{
    success = $true
    connected = $true
    printerName = $activePrinter
    status = $statusText
    statusCode = $statusCode
    paperRemaining = $remaining
    initialMediaCount = $initialCount
    ribbonPercent = $percent
    lifetimePrints = $lifetime
    error = $errorText
} | ConvertTo-Json -Compress
