package expo.modules.notificationcapture

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

// System-bound listener. Filters by the allowlist (or everything in debug
// capture-all mode), stores the raw text in CaptureStore, and pings the JS
// module if it happens to be alive. Notifications from non-allowlisted apps are
// dropped immediately and never persisted.
class CaptureListenerService : NotificationListenerService() {

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null) return
    val ctx = applicationContext
    val pkg = sbn.packageName ?: return
    if (pkg == ctx.packageName) return // never capture our own reminders

    val captureAll = CaptureStore.captureAll(ctx)
    if (!captureAll && pkg !in CaptureStore.allowedPackages(ctx)) return

    // Skip group summaries — they duplicate the child notifications' content.
    val n = sbn.notification ?: return
    if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

    val extras = n.extras
    val title = extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val bigText = extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    if (title.isEmpty() && text.isEmpty() && bigText.isEmpty()) return

    val item = JSONObject().apply {
      put("id", "${sbn.key}|${sbn.postTime}")
      put("packageName", pkg)
      put("title", title)
      put("text", text)
      put("bigText", bigText)
      put("postedAt", sbn.postTime)
    }

    if (CaptureStore.append(ctx, item)) {
      NotificationCaptureModule.emitCapture(item)
    }
  }
}
