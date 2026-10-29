package com.happypix.booth.kiosk

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * KioskPackage — registers KioskModule with React Native.
 * Add this to getPackages() in MainApplication.kt:
 *
 *   override fun getPackages(): List<ReactPackage> = listOf(
 *       ...,
 *       KioskPackage(),
 *   )
 */
class KioskPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> = listOf(KioskModule(reactContext))

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<*, *>> = emptyList()
}
