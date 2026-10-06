package expo.modules.notificationcapture

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.lang.ref.WeakReference

class NotificationCaptureModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }

  override fun definition() = ModuleDefinition {
    Name("NotificationCapture")

    Events("onCapture")

    OnCreate { active = WeakReference(this@NotificationCaptureModule) }
    OnDestroy { active = null }

    Function("isAccessGranted") {
      isAccessGranted(context)
    }

    Function("openAccessSettings") {
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        // Deep-link straight to our toggle where supported.
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).putExtra(
          Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME,
          ComponentName(context, CaptureListenerService::class.java).flattenToString(),
        )
      } else {
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
        context.startActivity(
          Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }

    // Ask the system to re-bind the listener — some OEMs (Xiaomi, Oppo) unbind
    // it after the process is killed and never bring it back on their own.
    Function("requestRebind") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isAccessGranted(context)) {
        NotificationListenerService.requestRebind(
          ComponentName(context, CaptureListenerService::class.java),
        )
      }
    }

    Function("getAllowedPackages") {
      CaptureStore.allowedPackages(context).toList()
    }

    Function("setAllowedPackages") { packages: List<String> ->
      CaptureStore.setAllowedPackages(context, packages)
    }

    Function("isCaptureAll") {
      CaptureStore.captureAll(context)
    }

    Function("setCaptureAll") { enabled: Boolean ->
      CaptureStore.setCaptureAll(context, enabled)
    }

    // Subset of `packages` that are installed on this device.
    Function("getInstalledPackages") { packages: List<String> ->
      val pm = context.packageManager
      packages.filter { pkg ->
        try {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getPackageInfo(pkg, PackageManager.PackageInfoFlags.of(0))
          } else {
            @Suppress("DEPRECATION")
            pm.getPackageInfo(pkg, 0)
          }
          true
        } catch (_: PackageManager.NameNotFoundException) {
          false
        }
      }
    }

    // Inbox access — JSON strings, parsed on the JS side.
    Function("peekPending") { CaptureStore.peek(context) }
    Function("drainPending") { CaptureStore.drain(context) }
    Function("clearPending") { CaptureStore.clear(context) }
    Function("removePending") { ids: List<String> -> CaptureStore.remove(context, ids) }
  }

  companion object {
    @Volatile
    private var active: WeakReference<NotificationCaptureModule>? = null

    // Called by the listener service; a no-op when the JS runtime isn't alive
    // (the capture is already safe in CaptureStore).
    fun emitCapture(item: JSONObject) {
      val module = active?.get() ?: return
      try {
        module.sendEvent(
          "onCapture",
          mapOf(
            "id" to item.optString("id"),
            "packageName" to item.optString("packageName"),
            "title" to item.optString("title"),
            "text" to item.optString("text"),
            "bigText" to item.optString("bigText"),
            "postedAt" to item.optLong("postedAt").toDouble(),
          ),
        )
      } catch (_: Exception) {
        // JS side torn down mid-emit — the inbox still has it.
      }
    }

    fun isAccessGranted(context: Context): Boolean {
      val enabled = Settings.Secure.getString(
        context.contentResolver,
        "enabled_notification_listeners",
      ) ?: return false
      val mine = ComponentName(context, CaptureListenerService::class.java)
      return enabled.split(":").any { ComponentName.unflattenFromString(it) == mine }
    }
  }
}
