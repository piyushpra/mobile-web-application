package com.mobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AppInfoModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AppInfo"

  @ReactMethod
  fun getCurrentVersion(promise: Promise) {
    promise.resolve(BuildConfig.VERSION_NAME)
  }
}
