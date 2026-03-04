package com.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import android.util.Base64
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

class LocalImagePickerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  companion object {
    private const val REQUEST_PICK_IMAGES = 8102
    private const val MAX_PICK_IMAGES = 5
    private const val MAX_IMAGE_BYTES = 5 * 1024 * 1024
  }

  private var pendingPromise: Promise? = null
  private var maxSelection: Int = 1

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName(): String = "LocalImagePicker"

  @ReactMethod
  fun pickImages(limit: Int, promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("PICKER_BUSY", "Image picker is already open")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "No active activity found")
      return
    }

    maxSelection = limit.coerceIn(1, MAX_PICK_IMAGES)
    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
      type = "image/*"
      addCategory(Intent.CATEGORY_OPENABLE)
      putExtra(Intent.EXTRA_ALLOW_MULTIPLE, maxSelection > 1)
    }

    pendingPromise = promise
    try {
      activity.startActivityForResult(Intent.createChooser(intent, "Select item images"), REQUEST_PICK_IMAGES)
    } catch (error: Exception) {
      pendingPromise = null
      promise.reject("PICKER_OPEN_FAILED", error.message, error)
    }
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_PICK_IMAGES) return

    val promise = pendingPromise ?: return
    pendingPromise = null

    if (resultCode != Activity.RESULT_OK || data == null) {
      promise.resolve(Arguments.createArray())
      return
    }

    try {
      val uris = mutableListOf<Uri>()
      val clipData = data.clipData
      if (clipData != null) {
        val total = minOf(clipData.itemCount, maxSelection)
        for (index in 0 until total) {
          clipData.getItemAt(index)?.uri?.let { uri ->
            uris.add(uri)
          }
        }
      }
      if (uris.isEmpty()) {
        data.data?.let { uri ->
          uris.add(uri)
        }
      }

      val out = Arguments.createArray()
      for ((index, uri) in uris.withIndex()) {
        if (index >= maxSelection) break
        toImagePayload(uri)?.let { payload ->
          out.pushMap(payload)
        }
      }

      promise.resolve(out)
    } catch (error: Exception) {
      promise.reject("PICKER_READ_FAILED", error.message, error)
    }
  }

  override fun onNewIntent(intent: Intent) {
    // no-op
  }

  private fun toImagePayload(uri: Uri): WritableMap? {
    val resolver = reactContext.contentResolver
    val mimeType = (resolver.getType(uri) ?: "image/jpeg").lowercase()
    if (!mimeType.startsWith("image/")) return null

    val bytes = resolver.openInputStream(uri)?.use { stream ->
      stream.readBytes()
    } ?: return null

    if (bytes.isEmpty() || bytes.size > MAX_IMAGE_BYTES) {
      return null
    }

    val (fileName, reportedSize) = queryMeta(uri)
    val base64Data = Base64.encodeToString(bytes, Base64.NO_WRAP)

    return Arguments.createMap().apply {
      putString("uri", uri.toString())
      putString("fileName", fileName ?: "item-image-${System.currentTimeMillis()}.jpg")
      putString("mimeType", mimeType)
      putDouble("size", (reportedSize ?: bytes.size.toLong()).toDouble())
      putString("base64Data", base64Data)
    }
  }

  private fun queryMeta(uri: Uri): Pair<String?, Long?> {
    var name: String? = null
    var size: Long? = null

    reactContext.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
      val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
      val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
      if (cursor.moveToFirst()) {
        if (nameIndex >= 0) {
          name = cursor.getString(nameIndex)
        }
        if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) {
          size = cursor.getLong(sizeIndex)
        }
      }
    }

    return Pair(name, size)
  }
}
