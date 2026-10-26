package com.example.clothingrecycleapp

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate

class EcoThreadApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // The app is designed with a light cream look, so do not follow the phone's dark mode.
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
    }
}