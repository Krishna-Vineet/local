package com.happypix.booth

import android.media.AudioAttributes
import android.media.SoundPool
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SimpleSoundModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var soundPool: SoundPool? = null
    private val soundIds = mutableMapOf<String, Int>()

    init {
        val audioAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
        
        soundPool = SoundPool.Builder()
            .setMaxStreams(5)
            .setAudioAttributes(audioAttributes)
            .build()
            
        loadSounds()
    }

    private fun loadSounds() {
        val context = reactApplicationContext
        try {
            // Load sounds from res/raw directory
            val clickResId = context.resources.getIdentifier("click", "raw", context.packageName)
            if (clickResId != 0) soundIds["click"] = soundPool!!.load(context, clickResId, 1)

            val shutterResId = context.resources.getIdentifier("shutter", "raw", context.packageName)
            if (shutterResId != 0) soundIds["shutter"] = soundPool!!.load(context, shutterResId, 1)

            val beepResId = context.resources.getIdentifier("beep", "raw", context.packageName)
            if (beepResId != 0) soundIds["beep"] = soundPool!!.load(context, beepResId, 1)

            val successResId = context.resources.getIdentifier("success", "raw", context.packageName)
            if (successResId != 0) soundIds["success"] = soundPool!!.load(context, successResId, 1)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    override fun getName(): String {
        return "SimpleSound"
    }

    @ReactMethod
    fun play(name: String) {
        val soundId = soundIds[name]
        if (soundId != null) {
            soundPool?.play(soundId, 1.0f, 1.0f, 1, 0, 1.0f)
        }
    }
}
