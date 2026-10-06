package expo.modules.notificationcapture

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

// On-disk inbox shared by the listener service (writer) and the JS module
// (reader). The service runs even while the JS runtime is dead, so captures are
// queued here and drained by JS on the next app open. Kept deliberately dumb —
// raw title/text only; all parsing lives in JS (lib/notificationParser.ts).
object CaptureStore {
  private const val PREFS = "bubble_notification_capture"
  private const val KEY_INBOX = "inbox"
  private const val KEY_ALLOWED = "allowed_packages"
  private const val KEY_CAPTURE_ALL = "capture_all"

  // Ring-buffer cap — oldest entries are dropped first. Generous enough to
  // survive a few weeks of bank pushes between app opens.
  private const val MAX_ITEMS = 300

  // Defaults until JS pushes its own list via setAllowedPackages().
  val DEFAULT_ALLOWED = setOf(
    "com.mservice.momotransfer", // MoMo
    "mobile.acb.com.vn", // ACB ONE
  )

  private fun prefs(context: Context): SharedPreferences =
    context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun allowedPackages(context: Context): Set<String> =
    prefs(context).getStringSet(KEY_ALLOWED, null) ?: DEFAULT_ALLOWED

  fun setAllowedPackages(context: Context, packages: Collection<String>) {
    prefs(context).edit().putStringSet(KEY_ALLOWED, packages.toSet()).apply()
  }

  // Debug-only: record notifications from every app so real package names and
  // message formats can be discovered. Off by default.
  fun captureAll(context: Context): Boolean =
    prefs(context).getBoolean(KEY_CAPTURE_ALL, false)

  fun setCaptureAll(context: Context, enabled: Boolean) {
    prefs(context).edit().putBoolean(KEY_CAPTURE_ALL, enabled).apply()
  }

  @Synchronized
  fun append(context: Context, item: JSONObject): Boolean {
    val inbox = readInbox(context)
    val id = item.optString("id")
    for (i in 0 until inbox.length()) {
      // Banks often re-post (update) the same notification — keep the first.
      if (inbox.optJSONObject(i)?.optString("id") == id) return false
    }
    inbox.put(item)
    val trimmed = if (inbox.length() > MAX_ITEMS) {
      JSONArray().also { out ->
        for (i in (inbox.length() - MAX_ITEMS) until inbox.length()) out.put(inbox.get(i))
      }
    } else inbox
    prefs(context).edit().putString(KEY_INBOX, trimmed.toString()).apply()
    return true
  }

  @Synchronized
  fun peek(context: Context): String = readInbox(context).toString()

  @Synchronized
  fun drain(context: Context): String {
    val json = readInbox(context).toString()
    prefs(context).edit().remove(KEY_INBOX).apply()
    return json
  }

  // Remove only the given ids — the JS pipeline acks exactly what it stored, so
  // a notification that lands mid-run survives until the next pass.
  @Synchronized
  fun remove(context: Context, ids: Collection<String>) {
    if (ids.isEmpty()) return
    val drop = ids.toHashSet()
    val inbox = readInbox(context)
    val kept = JSONArray()
    for (i in 0 until inbox.length()) {
      val item = inbox.optJSONObject(i) ?: continue
      if (item.optString("id") !in drop) kept.put(item)
    }
    prefs(context).edit().putString(KEY_INBOX, kept.toString()).apply()
  }

  @Synchronized
  fun clear(context: Context) {
    prefs(context).edit().remove(KEY_INBOX).apply()
  }

  private fun readInbox(context: Context): JSONArray =
    try {
      JSONArray(prefs(context).getString(KEY_INBOX, "[]"))
    } catch (_: Exception) {
      JSONArray()
    }
}
