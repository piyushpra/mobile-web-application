package com.mobile

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.core.location.LocationManagerCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.ResolvableApiException
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.LocationSettingsRequest
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource

class DeviceLocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    private const val REQUEST_ENABLE_LOCATION = 8103
    private const val MIN_TIMEOUT_MS = 3_000L
    private const val MAX_TIMEOUT_MS = 60_000L
  }

  private var pendingEnablePromise: Promise? = null

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "DeviceLocation"

  @ReactMethod
  fun isLocationEnabled(promise: Promise) {
    promise.resolve(isEnabled())
  }

  /** Resolves "enabled", "denied" (user dismissed the system dialog) or "settings_opened". */
  @ReactMethod
  fun requestEnableLocation(promise: Promise) {
    if (isEnabled()) {
      promise.resolve("enabled")
      return
    }
    if (pendingEnablePromise != null) {
      promise.reject("LOCATION_PROMPT_BUSY", "Location prompt is already open")
      return
    }
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No active activity found")
      return
    }
    if (!hasPlayServices()) {
      openLocationSettings(activity, promise)
      return
    }

    val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 10_000L).build()
    val settingsRequest = LocationSettingsRequest.Builder()
        .addLocationRequest(request)
        .setAlwaysShow(true)
        .build()

    LocationServices.getSettingsClient(activity)
        .checkLocationSettings(settingsRequest)
        .addOnSuccessListener { promise.resolve("enabled") }
        .addOnFailureListener { error ->
          if (error is ResolvableApiException) {
            pendingEnablePromise = promise
            try {
              error.startResolutionForResult(activity, REQUEST_ENABLE_LOCATION)
            } catch (startError: Exception) {
              pendingEnablePromise = null
              openLocationSettings(activity, promise)
            }
          } else {
            openLocationSettings(activity, promise)
          }
        }
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun getCurrentPosition(timeoutMs: Double, promise: Promise) {
    if (!hasPermission()) {
      promise.reject("PERMISSION_DENIED", "Location permission denied")
      return
    }
    if (!isEnabled()) {
      promise.reject("LOCATION_DISABLED", "Location services are disabled")
      return
    }

    val timeout = timeoutMs.toLong().coerceIn(MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
    val handler = Handler(Looper.getMainLooper())
    var settled = false
    var cleanup: () -> Unit = {}

    fun finish(location: Location?, errorMessage: String) {
      if (settled) return
      settled = true
      handler.removeCallbacksAndMessages(null)
      cleanup()
      val result = location ?: lastKnownLocation()
      if (result == null) {
        promise.reject("LOCATION_UNAVAILABLE", errorMessage)
        return
      }
      promise.resolve(
          Arguments.createMap().apply {
            putDouble("latitude", result.latitude)
            putDouble("longitude", result.longitude)
            putDouble("accuracy", result.accuracy.toDouble())
          })
    }

    if (hasPlayServices()) {
      val cancellation = CancellationTokenSource()
      cleanup = { cancellation.cancel() }
      handler.postDelayed({ finish(null, "Location request timeout") }, timeout)
      LocationServices.getFusedLocationProviderClient(reactContext)
          .getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cancellation.token)
          .addOnSuccessListener { location -> finish(location, "Location unavailable") }
          .addOnFailureListener { error -> finish(null, error.message ?: "Location unavailable") }
      return
    }

    val manager = locationManager()
    val provider = when {
      manager == null -> null
      manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
      manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
      else -> null
    }
    if (manager == null || provider == null) {
      finish(null, "Location services are disabled")
      return
    }
    val listener = LocationListener { location -> finish(location, "Location unavailable") }
    cleanup = { manager.removeUpdates(listener) }
    handler.postDelayed({ finish(null, "Location request timeout") }, timeout)
    manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_ENABLE_LOCATION) return
    val promise = pendingEnablePromise ?: return
    pendingEnablePromise = null
    promise.resolve(if (resultCode == Activity.RESULT_OK || isEnabled()) "enabled" else "denied")
  }

  override fun onNewIntent(intent: Intent) {
    // no-op
  }

  private fun openLocationSettings(activity: Activity, promise: Promise) {
    try {
      activity.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
      promise.resolve("settings_opened")
    } catch (error: Exception) {
      promise.reject("LOCATION_SETTINGS_FAILED", error.message, error)
    }
  }

  private fun locationManager(): LocationManager? =
      reactContext.getSystemService(Context.LOCATION_SERVICE) as? LocationManager

  private fun isEnabled(): Boolean =
      locationManager()?.let { LocationManagerCompat.isLocationEnabled(it) } ?: false

  private fun hasPlayServices(): Boolean =
      GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(reactContext) ==
          ConnectionResult.SUCCESS

  private fun hasPermission(): Boolean =
      ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) ==
          PackageManager.PERMISSION_GRANTED ||
          ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_COARSE_LOCATION) ==
              PackageManager.PERMISSION_GRANTED

  @SuppressLint("MissingPermission")
  private fun lastKnownLocation(): Location? {
    if (!hasPermission()) return null
    val manager = locationManager() ?: return null
    return manager.getProviders(true)
        .mapNotNull { provider -> runCatching { manager.getLastKnownLocation(provider) }.getOrNull() }
        .maxByOrNull { it.time }
  }
}
