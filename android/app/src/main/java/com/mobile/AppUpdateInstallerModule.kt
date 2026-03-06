package com.mobile

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean

class AppUpdateInstallerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  companion object {
    private const val EVENT_NAME = "AppUpdateDownload"
    private const val BUFFER_SIZE = 8 * 1024
  }

  private val cancelRequested = AtomicBoolean(false)
  private var downloadThread: Thread? = null
  private var pendingApkFile: File? = null

  override fun getName(): String = "AppUpdateInstaller"

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter on Android.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter on Android.
  }

  @ReactMethod
  fun startDownload(downloadUrl: String, fileName: String?, checksumSha256: String?, promise: Promise) {
    if (downloadThread?.isAlive == true) {
      promise.reject("UPDATE_BUSY", "An update download is already in progress")
      return
    }

    val normalizedUrl = downloadUrl.trim()
    if (normalizedUrl.isEmpty()) {
      promise.reject("INVALID_URL", "Download URL is required")
      return
    }

    val targetFileName = sanitizeFileName(fileName, normalizedUrl)
    cancelRequested.set(false)
    pendingApkFile = null

    val thread =
        Thread {
          var connection: HttpURLConnection? = null
          var tempFile: File? = null
          try {
            emitEvent(status = "starting", progress = 0.0, message = "Preparing update download", fileName = targetFileName)
            connection = (URL(normalizedUrl).openConnection() as HttpURLConnection).apply {
              requestMethod = "GET"
              instanceFollowRedirects = true
              connectTimeout = 15000
              readTimeout = 30000
              doInput = true
            }
            connection.connect()

            val statusCode = connection.responseCode
            if (statusCode !in 200..299) {
              throw IllegalStateException("Download failed with status $statusCode")
            }

            val outputDir = File(reactContext.cacheDir, "updates").apply { mkdirs() }
            val targetFile = File(outputDir, targetFileName)
            tempFile = File(outputDir, "$targetFileName.part")
            if (tempFile.exists()) {
              tempFile.delete()
            }

            val expectedChecksum = checksumSha256?.trim()?.lowercase(Locale.ROOT)?.takeIf { it.isNotEmpty() }
            val digest = MessageDigest.getInstance("SHA-256")
            val totalBytes = connection.contentLengthLong.takeIf { it > 0L }

            connection.inputStream.use { input ->
              FileOutputStream(tempFile).use { output ->
                val buffer = ByteArray(BUFFER_SIZE)
                var downloadedBytes = 0L
                var lastEmitAt = 0L
                while (true) {
                  val read = input.read(buffer)
                  if (read == -1) {
                    break
                  }
                  if (cancelRequested.get()) {
                    throw UpdateDownloadCancelledException()
                  }
                  output.write(buffer, 0, read)
                  digest.update(buffer, 0, read)
                  downloadedBytes += read.toLong()
                  val now = System.currentTimeMillis()
                  if (now - lastEmitAt >= 200L || (totalBytes != null && downloadedBytes >= totalBytes)) {
                    emitEvent(
                        status = "downloading",
                        progress = progressValue(downloadedBytes, totalBytes),
                        downloadedBytes = downloadedBytes,
                        totalBytes = totalBytes,
                        message = "Downloading update",
                        fileName = targetFileName,
                    )
                    lastEmitAt = now
                  }
                }
                output.fd.sync()
              }
            }

            val actualChecksum =
                digest.digest().joinToString(separator = "") { byte -> "%02x".format(byte) }
            if (expectedChecksum != null && actualChecksum != expectedChecksum) {
              throw IllegalStateException("Downloaded update failed integrity check")
            }

            if (targetFile.exists()) {
              targetFile.delete()
            }
            if (!tempFile.renameTo(targetFile)) {
              tempFile.copyTo(targetFile, overwrite = true)
              tempFile.delete()
            }

            pendingApkFile = targetFile
            emitEvent(
                status = "downloaded",
                progress = 1.0,
                downloadedBytes = targetFile.length(),
                totalBytes = targetFile.length(),
                message = "Update downloaded",
                fileName = targetFile.name,
            )
            launchInstallerOrPermissionFlow(targetFile)
          } catch (error: UpdateDownloadCancelledException) {
            tempFile?.delete()
            emitEvent(status = "cancelled", progress = 0.0, message = "Update download cancelled", fileName = targetFileName)
          } catch (error: Exception) {
            tempFile?.delete()
            pendingApkFile = null
            emitEvent(
                status = "error",
                progress = 0.0,
                message = error.message ?: "Unable to download update",
                fileName = targetFileName,
            )
          } finally {
            connection?.disconnect()
            cancelRequested.set(false)
            downloadThread = null
          }
        }

    downloadThread = thread
    thread.start()
    promise.resolve(null)
  }

  @ReactMethod
  fun cancelDownload(promise: Promise) {
    val active = downloadThread?.isAlive == true
    if (active) {
      cancelRequested.set(true)
    }
    promise.resolve(active)
  }

  @ReactMethod
  fun installPendingUpdate(promise: Promise) {
    val apkFile = pendingApkFile
    if (apkFile == null || !apkFile.exists()) {
      promise.reject("NO_UPDATE_READY", "No downloaded update is available")
      return
    }

    try {
      launchInstallerOrPermissionFlow(apkFile)
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("INSTALL_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun openInstallPermissionSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val intent =
            Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${reactContext.packageName}"),
                )
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
      }
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("PERMISSION_SETTINGS_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun isInstallPermissionGranted(promise: Promise) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      promise.resolve(reactContext.packageManager.canRequestPackageInstalls())
      return
    }
    promise.resolve(true)
  }

  private fun launchInstallerOrPermissionFlow(apkFile: File) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !reactContext.packageManager.canRequestPackageInstalls()) {
      emitEvent(
          status = "permission_required",
          progress = 1.0,
          message = "Allow installs from this source, then tap Install Downloaded Update.",
          fileName = apkFile.name,
      )
      return
    }
    launchInstaller(apkFile)
  }

  private fun launchInstaller(apkFile: File) {
    val apkUri =
        FileProvider.getUriForFile(
            reactContext,
            "${reactContext.packageName}.fileprovider",
            apkFile,
        )
    val installIntent =
        Intent(Intent.ACTION_VIEW).apply {
          setDataAndType(apkUri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

    reactContext.startActivity(installIntent)
    emitEvent(
        status = "installing",
        progress = 1.0,
        downloadedBytes = apkFile.length(),
        totalBytes = apkFile.length(),
        message = "Opening Android installer",
        fileName = apkFile.name,
    )
  }

  @Suppress("DEPRECATION")
  private fun emitEvent(
      status: String,
      progress: Double? = null,
      downloadedBytes: Long? = null,
      totalBytes: Long? = null,
      message: String? = null,
      fileName: String? = null,
  ) {
    if (!reactContext.hasActiveCatalystInstance()) {
      return
    }
    val payload =
        Arguments.createMap().apply {
          putString("status", status)
          if (progress != null) putDouble("progress", progress.coerceIn(0.0, 1.0))
          if (downloadedBytes != null) putDouble("downloadedBytes", downloadedBytes.toDouble())
          if (totalBytes != null) putDouble("totalBytes", totalBytes.toDouble())
          if (!message.isNullOrBlank()) putString("message", message)
          if (!fileName.isNullOrBlank()) putString("fileName", fileName)
        }
    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(EVENT_NAME, payload)
  }

  private fun sanitizeFileName(rawFileName: String?, downloadUrl: String): String {
    val fromArg = rawFileName?.trim().orEmpty()
    val fromUrl = Uri.parse(downloadUrl).lastPathSegment?.trim().orEmpty()
    val candidate =
        sequenceOf(fromArg, fromUrl, "mobile-update.apk")
            .firstOrNull { it.isNotBlank() }
            ?: "mobile-update.apk"
    val sanitized = candidate.replace(Regex("[^A-Za-z0-9._-]"), "-")
    return if (sanitized.lowercase(Locale.ROOT).endsWith(".apk")) sanitized else "$sanitized.apk"
  }

  private fun progressValue(downloadedBytes: Long, totalBytes: Long?): Double {
    if (totalBytes == null || totalBytes <= 0L) {
      return 0.0
    }
    return downloadedBytes.toDouble() / totalBytes.toDouble()
  }

  private class UpdateDownloadCancelledException : RuntimeException()
}
