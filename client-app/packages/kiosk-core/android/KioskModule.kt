package com.happypix.booth.kiosk

import android.app.Activity
import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.bridge.*

/**
 * KioskModule — Android Lock Task Mode + Screen Controls
 *
 * Exposes kiosk lockdown to React Native via NativeModules.KioskModule
 *
 * IMPORTANT: For startKiosk() to work without DPC setup, the app must be
 * whitelisted as the device's default home app, OR the device must be
 * enrolled as a Device Owner via Android Enterprise.
 *
 * For production deployments, set this app as Device Owner:
 *   adb shell dpm set-device-owner com.happypix.booth/.kiosk.KioskAdminReceiver
 */
class KioskModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "KioskModule"

    /**
     * Enter Android Lock Task Mode (kiosk).
     * Navigation bar, status bar, and recent apps are locked.
     */
    @ReactMethod
    fun startKiosk(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity found")
            return
        }
        try {
            activity.runOnUiThread {
                try {
                    activity.startLockTask()

                    // Full immersive mode
                    setImmersiveModeInternal(activity, true)

                    // Keep screen on
                    activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("KIOSK_START_FAILED", e.message ?: "Failed to start kiosk", e)
                }
            }
        } catch (e: Exception) {
            promise.reject("KIOSK_START_FAILED", e.message ?: "Failed to start kiosk", e)
        }
    }

    /**
     * Exit Lock Task Mode.
     * Only works if app has Device Owner privileges.
     */
    @ReactMethod
    fun stopKiosk(promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity found")
            return
        }
        try {
            activity.runOnUiThread {
                try {
                    activity.stopLockTask()
                    setImmersiveModeInternal(activity, false)
                    activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    promise.resolve(null)
                } catch (e: Exception) {
                    promise.reject("KIOSK_STOP_FAILED", e.message ?: "Failed to stop kiosk", e)
                }
            }
        } catch (e: Exception) {
            promise.reject("KIOSK_STOP_FAILED", e.message ?: "Failed to stop kiosk", e)
        }
    }

    /**
     * Returns true if Lock Task Mode is currently active.
     */
    @ReactMethod
    fun isKioskEnabled(promise: Promise) {
        try {
            val am = reactApplicationContext
                .getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
            val isLocked = am?.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
            promise.resolve(isLocked)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    /**
     * Enable/disable full immersive mode (hides status bar + navigation bar).
     */
    @ReactMethod
    fun setImmersiveMode(enabled: Boolean, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity found")
            return
        }
        activity.runOnUiThread {
            try {
                setImmersiveModeInternal(activity, enabled)
                promise.resolve(null)
            } catch (e: Exception) {
                promise.reject("IMMERSIVE_FAILED", e.message ?: "Failed to set immersive mode", e)
            }
        }
    }

    /**
     * Prevent screen from sleeping during booth session.
     */
    @ReactMethod
    fun keepScreenOn(enabled: Boolean, promise: Promise) {
        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity found")
            return
        }
        activity.runOnUiThread {
            if (enabled) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            promise.resolve(null)
        }
    }

    // ── Private Helpers ──────────────────────────────────────────────

    private fun setImmersiveModeInternal(activity: Activity, enabled: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            // Android 11+ API
            val controller = activity.window.insetsController
            if (enabled) {
                controller?.hide(
                    android.view.WindowInsets.Type.statusBars() or
                    android.view.WindowInsets.Type.navigationBars()
                )
                controller?.systemBarsBehavior =
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                controller?.show(
                    android.view.WindowInsets.Type.statusBars() or
                    android.view.WindowInsets.Type.navigationBars()
                )
            }
        } else {
            // Legacy API (< Android 11)
            @Suppress("DEPRECATION")
            val flags = if (enabled) {
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
                android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            } else {
                android.view.View.SYSTEM_UI_FLAG_VISIBLE
            }
            @Suppress("DEPRECATION")
            activity.window.decorView.systemUiVisibility = flags
        }
    }
}
