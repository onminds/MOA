package com.onminds.moa_interview_prep

import android.content.Context
import android.content.res.Configuration
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugins.googlemobileads.GoogleMobileAdsPlugin

class MainActivity : FlutterActivity() {
    override fun attachBaseContext(newBase: Context) {
        val cfg = Configuration(newBase.resources.configuration)
        cfg.fontScale = 1f
        val ctx = newBase.createConfigurationContext(cfg)
        super.attachBaseContext(ctx)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        GoogleMobileAdsPlugin.registerNativeAdFactory(
            flutterEngine,
            "recordAd",
            RecordNativeAdFactory(context)
        )
    }

    override fun cleanUpFlutterEngine(flutterEngine: FlutterEngine) {
        GoogleMobileAdsPlugin.unregisterNativeAdFactory(flutterEngine, "recordAd")
        super.cleanUpFlutterEngine(flutterEngine)
    }
}
