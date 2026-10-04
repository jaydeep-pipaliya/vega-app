package com.vega

import android.app.ActivityManager
import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Exposes the app's real heap limit (Runtime.maxMemory, which reflects
 * largeHeap) and the device's total RAM so settings can cap the player buffer
 * sliders at what the patched player will actually use.
 */
class DeviceMemoryModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "VegaDeviceMemory"

    private fun memoryInfo(): Map<String, Any> {
        val activityManager =
            reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val info = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(info)
        return mapOf(
            "heapLimitMB" to (Runtime.getRuntime().maxMemory() / (1024 * 1024)).toInt(),
            "totalRamMB" to (info.totalMem / (1024 * 1024)).toInt(),
        )
    }

    override fun getConstants(): MutableMap<String, Any> = memoryInfo().toMutableMap()

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getHeapLimitMB(): Int = memoryInfo()["heapLimitMB"] as Int

    @ReactMethod(isBlockingSynchronousMethod = true)
    fun getTotalRamMB(): Int = memoryInfo()["totalRamMB"] as Int
}
