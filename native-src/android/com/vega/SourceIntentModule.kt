package com.vega

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * Receives the custom "add provider source" intent. It is not a deep link:
 * the intent has no data URI, only an action, a "url" string extra and an
 * optional "token" extra (GitHub token for a private repo).
 *
 * From a web page (Chrome intent URI):
 *   intent:#Intent;action=vega.intent.action.ADD_SOURCE;S.url=https%3A%2F%2Fgithub.com%2Fauthor%2Frepo;end
 * From adb:
 *   adb shell am start -a vega.intent.action.ADD_SOURCE --es url https://github.com/author/repo
 * Private repo:
 *   ... --es url https://github.com/author/repo --es token github_pat_xxx
 */
class SourceIntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val ACTION_ADD_SOURCE = "vega.intent.action.ADD_SOURCE"
        const val EXTRA_URL = "url"
        const val EXTRA_TOKEN = "token"
        private const val MAX_URL_LENGTH = 2048
        private const val MAX_TOKEN_LENGTH = 255
    }

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "VegaSourceIntent"

    /** Returns {url, token?} of the launch intent once, then clears it. */
    @ReactMethod
    fun getInitialSource(promise: Promise) {
        val intent = reactApplicationContext.currentActivity?.intent
        if (intent == null ||
            intent.flags and Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY != 0
        ) {
            promise.resolve(null)
            return
        }
        promise.resolve(consume(intent))
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    override fun onNewIntent(intent: Intent) {
        val payload = consume(intent) ?: return
        reactApplicationContext.currentActivity?.intent?.let { consume(it) }
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("onVegaAddSource", payload)
    }

    override fun onActivityResult(
        activity: Activity,
        requestCode: Int,
        resultCode: Int,
        data: Intent?,
    ) {}

    private fun consume(intent: Intent): WritableMap? {
        if (intent.action != ACTION_ADD_SOURCE) return null
        val url = intent.getStringExtra(EXTRA_URL)?.trim()
        val token = intent.getStringExtra(EXTRA_TOKEN)?.trim()
        // Clear so a JS reload or activity recreation does not add it again.
        intent.removeExtra(EXTRA_URL)
        intent.removeExtra(EXTRA_TOKEN)
        if (url.isNullOrEmpty() || url.length > MAX_URL_LENGTH) return null
        return Arguments.createMap().apply {
            putString("url", url)
            if (!token.isNullOrEmpty() && token.length <= MAX_TOKEN_LENGTH) {
                putString("token", token)
            }
        }
    }
}
