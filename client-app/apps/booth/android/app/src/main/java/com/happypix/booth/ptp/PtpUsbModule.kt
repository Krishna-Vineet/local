package com.happypix.booth.ptp

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.BitmapFactory
import android.hardware.usb.*
import android.os.Build
import android.util.Base64
import com.facebook.react.bridge.*
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

class PtpUsbModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val usbManager = reactContext.getSystemService(Context.USB_SERVICE) as? UsbManager
    private var usbDevice: UsbDevice? = null
    private var usbConnection: UsbDeviceConnection? = null
    private var endpointIn: UsbEndpoint? = null
    private var endpointOut: UsbEndpoint? = null
    private var transactionId = 1
    private var isConnected = false
    private var cameraModel = "Nikon Camera"

    companion object {
        const val NAME = "PtpUsbModule"
        private const val ACTION_USB_PERMISSION = "com.happypix.booth.USB_PERMISSION"
        private const val TIMEOUT_MS = 5000
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun isSupported(promise: Promise) {
        val hasUsbHost = reactContext.packageManager.hasSystemFeature("android.hardware.usb.host")
        promise.resolve(hasUsbHost && usbManager != null)
    }

    @ReactMethod
    fun listDevices(promise: Promise) {
        try {
            val list = Arguments.createArray()
            val devices = usbManager?.deviceList ?: emptyMap()
            for ((_, device) in devices) {
                if (isPtpDevice(device)) {
                    val map = Arguments.createMap().apply {
                        putString("name", device.productName ?: "Nikon/PTP Camera")
                        putString("manufacturer", device.manufacturerName ?: "Nikon")
                        putInt("vendorId", device.vendorId)
                        putInt("productId", device.productId)
                        putString("deviceName", device.deviceName)
                    }
                    list.pushMap(map)
                }
            }
            promise.resolve(list)
        } catch (e: Exception) {
            promise.reject("ERR_LIST_DEVICES", e.message, e)
        }
    }

    @ReactMethod
    fun connect(promise: Promise) {
        try {
            val devices = usbManager?.deviceList ?: emptyMap()
            val target = devices.values.firstOrNull { isPtpDevice(it) }

            if (target == null) {
                promise.reject("ERR_NO_DEVICE", "No Nikon or PTP USB camera connected.")
                return
            }

            usbDevice = target
            cameraModel = target.productName ?: "Nikon Camera"

            if (usbManager?.hasPermission(target) == true) {
                setupConnection(target, promise)
            } else {
                requestUsbPermission(target, promise)
            }
        } catch (e: Exception) {
            promise.reject("ERR_CONNECT", e.message, e)
        }
    }

    @ReactMethod
    fun disconnect(promise: Promise) {
        try {
            if (isConnected && usbConnection != null) {
                sendPtpCommand(PtpConstants.OP_CLOSE_SESSION, listOf(1))
            }
            usbConnection?.close()
            usbConnection = null
            endpointIn = null
            endpointOut = null
            isConnected = false
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getStatus(promise: Promise) {
        val map = Arguments.createMap().apply {
            putBoolean("connected", isConnected)
            putString("type", "ptp")
            putString("model", cameraModel)
            putInt("batteryLevel", if (isConnected) 85 else 0)
        }
        promise.resolve(map)
    }

    @ReactMethod
    fun capture(promise: Promise) {
        if (!isConnected || usbConnection == null || endpointOut == null || endpointIn == null) {
            promise.reject("ERR_NOT_CONNECTED", "Camera not connected via USB PTP.")
            return
        }

        Thread {
            try {
                // Try Nikon InitiateCaptureRecInMedia (0x90C0) first, fallback to standard InitiateCapture (0x100E)
                val resp1 = sendPtpCommand(PtpConstants.NIKON_OP_INITIATE_CAPTURE_REC_IN_MEDIA, listOf(0xFFFFFFFF.toInt(), 0x0000))
                val captureSuccess = resp1.responseCode == PtpConstants.RESP_OK

                if (!captureSuccess) {
                    val resp2 = sendPtpCommand(PtpConstants.OP_INITIATE_CAPTURE, listOf(0, 0))
                    if (resp2.responseCode != PtpConstants.RESP_OK && resp2.responseCode != PtpConstants.RESP_DEVICE_BUSY) {
                        promise.reject("ERR_CAPTURE_FAILED", "PTP Shutter trigger returned error code: ${resp2.responseCode}")
                        return@Thread
                    }
                }

                // Wait for camera to write image to buffer (1.2 seconds)
                Thread.sleep(1200)

                // Query storage handles to get the latest object
                val handlesResp = sendPtpCommand(PtpConstants.OP_GET_OBJECT_HANDLES, listOf(0xFFFFFFFF.toInt(), 0, 0))
                val latestHandle = parseLastObjectHandle(handlesResp.data)

                if (latestHandle != 0) {
                    // Fetch full JPEG data
                    val objData = getPtpObject(latestHandle)
                    if (objData != null && objData.isNotEmpty()) {
                        val file = File(reactContext.cacheDir, "nikon_capture_${System.currentTimeMillis()}.jpg")
                        FileOutputStream(file).use { it.write(objData) }

                        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
                        BitmapFactory.decodeByteArray(objData, 0, objData.size, bounds)

                        val b64 = Base64.encodeToString(objData, Base64.NO_WRAP)
                        val map = Arguments.createMap().apply {
                            putString("id", "nikon-ptp-${System.currentTimeMillis()}")
                            putString("uri", "file://${file.absolutePath}")
                            putString("dataUrl", "data:image/jpeg;base64,$b64")
                            putInt("width", if (bounds.outWidth > 0) bounds.outWidth else 1920)
                            putInt("height", if (bounds.outHeight > 0) bounds.outHeight else 1080)
                            putString("capturedAt", java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).format(java.util.Date()))
                        }
                        promise.resolve(map)
                        return@Thread
                    }
                }

                promise.reject("ERR_RETRIEVE_PHOTO", "Shutter triggered, but image object handle not retrieved.")
            } catch (e: Exception) {
                promise.reject("ERR_CAPTURE_EXCEPTION", e.message, e)
            }
        }.start()
    }

    // ── Internal Helpers ────────────────────────────────────────────────────────

    private fun isPtpDevice(device: UsbDevice): Boolean {
        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            if (intf.interfaceClass == PtpConstants.USB_CLASS_STILL_IMAGE &&
                intf.interfaceSubclass == PtpConstants.USB_SUBCLASS_STILL_IMAGE) {
                return true
            }
        }
        return false
    }

    private fun requestUsbPermission(device: UsbDevice, promise: Promise) {
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        val permissionIntent = PendingIntent.getBroadcast(
            reactContext,
            0,
            Intent(ACTION_USB_PERMISSION),
            flags
        )

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (ACTION_USB_PERMISSION == intent?.action) {
                    reactContext.unregisterReceiver(this)
                    val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                    if (granted) {
                        setupConnection(device, promise)
                    } else {
                        promise.reject("ERR_PERMISSION_DENIED", "USB Permission denied by user.")
                    }
                }
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, IntentFilter(ACTION_USB_PERMISSION), Context.RECEIVER_NOT_EXPORTED)
        } else {
            reactContext.registerReceiver(receiver, IntentFilter(ACTION_USB_PERMISSION))
        }

        usbManager?.requestPermission(device, permissionIntent)
    }

    private fun setupConnection(device: UsbDevice, promise: Promise) {
        val conn = usbManager?.openDevice(device)
        if (conn == null) {
            promise.reject("ERR_OPEN_FAILED", "Failed to open USB device connection.")
            return
        }

        for (i in 0 until device.interfaceCount) {
            val intf = device.getInterface(i)
            if (intf.interfaceClass == PtpConstants.USB_CLASS_STILL_IMAGE) {
                conn.claimInterface(intf, true)
                for (e in 0 until intf.endpointCount) {
                    val ep = intf.getEndpoint(e)
                    if (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK) {
                        if (ep.direction == UsbConstants.USB_DIR_IN) endpointIn = ep
                        else if (ep.direction == UsbConstants.USB_DIR_OUT) endpointOut = ep
                    }
                }
                break
            }
        }

        if (endpointIn == null || endpointOut == null) {
            conn.close()
            promise.reject("ERR_NO_ENDPOINTS", "Could not resolve USB Bulk IN/OUT endpoints.")
            return
        }

        usbConnection = conn

        // Send PTP OpenSession (Session ID: 1)
        val openResp = sendPtpCommand(PtpConstants.OP_OPEN_SESSION, listOf(1))
        if (openResp.responseCode == PtpConstants.RESP_OK || openResp.responseCode == PtpConstants.RESP_SESSION_ALREADY_OPEN) {
            isConnected = true
            val map = Arguments.createMap().apply {
                putBoolean("connected", true)
                putString("model", cameraModel)
            }
            promise.resolve(map)
        } else {
            promise.reject("ERR_SESSION_OPEN", "Failed to open PTP session, code: ${openResp.responseCode}")
        }
    }

    private data class PtpResponse(val responseCode: Int, val data: ByteArray = ByteArray(0))

    private fun sendPtpCommand(opCode: Int, params: List<Int> = emptyList()): PtpResponse {
        val conn = usbConnection ?: return PtpResponse(0)
        val epOut = endpointOut ?: return PtpResponse(0)
        val epIn = endpointIn ?: return PtpResponse(0)

        val length = 12 + (params.size * 4)
        val buf = ByteBuffer.allocate(length).order(ByteOrder.LITTLE_ENDIAN).apply {
            putInt(length)
            putShort(PtpConstants.CONTAINER_COMMAND.toShort())
            putShort(opCode.toShort())
            putInt(transactionId++)
            for (p in params) {
                putInt(p)
            }
        }

        conn.bulkTransfer(epOut, buf.array(), length, TIMEOUT_MS)

        // Read response
        val inBuf = ByteArray(512)
        val read = conn.bulkTransfer(epIn, inBuf, inBuf.size, TIMEOUT_MS)
        if (read >= 12) {
            val bb = ByteBuffer.wrap(inBuf, 0, read).order(ByteOrder.LITTLE_ENDIAN)
            val contLen = bb.int
            val contType = bb.short
            val code = bb.short.toInt() and 0xFFFF
            return PtpResponse(code, inBuf.copyOfRange(12, read))
        }

        return PtpResponse(0)
    }

    private fun getPtpObject(handle: Int): ByteArray? {
        val conn = usbConnection ?: return null
        val epOut = endpointOut ?: return null
        val epIn = endpointIn ?: return null

        // Send GetObject (0x1009)
        val length = 12 + 4
        val buf = ByteBuffer.allocate(length).order(ByteOrder.LITTLE_ENDIAN).apply {
            putInt(length)
            putShort(PtpConstants.CONTAINER_COMMAND.toShort())
            putShort(PtpConstants.OP_GET_OBJECT.toShort())
            putInt(transactionId++)
            putInt(handle)
        }

        conn.bulkTransfer(epOut, buf.array(), length, TIMEOUT_MS)

        // Read data container + chunks
        val outStream = ByteArrayOutputStream()
        val chunk = ByteArray(16384)
        var totalRead = 0
        var expectedLength = 0

        while (true) {
            val r = conn.bulkTransfer(epIn, chunk, chunk.size, TIMEOUT_MS)
            if (r <= 0) break

            if (totalRead == 0 && r >= 12) {
                val header = ByteBuffer.wrap(chunk, 0, 12).order(ByteOrder.LITTLE_ENDIAN)
                expectedLength = header.int - 12
                outStream.write(chunk, 12, r - 12)
                totalRead += (r - 12)
            } else {
                outStream.write(chunk, 0, r)
                totalRead += r
            }

            if (expectedLength > 0 && totalRead >= expectedLength) {
                break
            }
        }

        // Read the final response container
        val finalResp = ByteArray(64)
        conn.bulkTransfer(epIn, finalResp, finalResp.size, 1000)

        return outStream.toByteArray()
    }

    private fun parseLastObjectHandle(data: ByteArray): Int {
        if (data.size < 4) return 0
        val bb = ByteBuffer.wrap(data).order(ByteOrder.LITTLE_ENDIAN)
        val count = bb.int
        if (count <= 0 || data.size < 4 + (count * 4)) return 0
        var last = 0
        for (i in 0 until count) {
            last = bb.int
        }
        return last
    }
}

