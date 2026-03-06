package com.mobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class AppUpdateInstallerPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(AppUpdateInstallerModule(reactContext))
  }

  @Deprecated("Legacy ReactPackage view-manager API")
  @Suppress("OVERRIDE_DEPRECATION")
  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> {
    return emptyList()
  }
}
