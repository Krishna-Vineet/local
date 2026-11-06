package com.happypix.booth.ptp

object PtpConstants {
    const val USB_CLASS_STILL_IMAGE = 6
    const val USB_SUBCLASS_STILL_IMAGE = 1
    const val USB_PROTOCOL_PTP = 1

    // PTP Container Types
    const val CONTAINER_COMMAND = 1
    const val CONTAINER_DATA = 2
    const val CONTAINER_RESPONSE = 3
    const val CONTAINER_EVENT = 4

    // Standard PTP 1.1 Operation Codes
    const val OP_GET_DEVICE_INFO = 0x1001
    const val OP_OPEN_SESSION = 0x1002
    const val OP_CLOSE_SESSION = 0x1003
    const val OP_GET_STORAGE_IDS = 0x1004
    const val OP_GET_STORAGE_INFO = 0x1005
    const val OP_GET_NUM_OBJECTS = 0x1006
    const val OP_GET_OBJECT_HANDLES = 0x1007
    const val OP_GET_OBJECT_INFO = 0x1008
    const val OP_GET_OBJECT = 0x1009
    const val OP_INITIATE_CAPTURE = 0x100E
    const val OP_GET_DEVICE_PROP_DESC = 0x1014
    const val OP_GET_DEVICE_PROP_VALUE = 0x1015
    const val OP_SET_DEVICE_PROP_VALUE = 0x1016

    // Nikon Vendor Extended Operation Codes
    const val NIKON_OP_INITIATE_CAPTURE_REC_IN_MEDIA = 0x90C0
    const val NIKON_OP_SET_CONTROL_MODE = 0x90C2
    const val NIKON_OP_CHECK_EVENT = 0x90C7
    const val NIKON_OP_DEVICE_READY = 0x90C8
    const val NIKON_OP_START_LIVE_VIEW = 0x9201
    const val NIKON_OP_END_LIVE_VIEW = 0x9202
    const val NIKON_OP_GET_LIVE_VIEW_IMAGE = 0x9203

    // Standard Property Codes
    const val PROP_BATTERY_LEVEL = 0x5001

    // Response Codes
    const val RESP_OK = 0x2001
    const val RESP_SESSION_ALREADY_OPEN = 0x201E
    const val RESP_DEVICE_BUSY = 0x2019
}

