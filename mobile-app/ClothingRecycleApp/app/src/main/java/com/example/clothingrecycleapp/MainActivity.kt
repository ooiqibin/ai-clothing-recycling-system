package com.example.clothingrecycleapp

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.bottomnavigation.BottomNavigationView
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : AppCompatActivity() {

    private lateinit var bottomNav: BottomNavigationView
    private lateinit var tvGlobalPoints: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        RetrofitClient.init(this)

        bottomNav = findViewById(R.id.bottomNav)
        tvGlobalPoints = findViewById(R.id.tvGlobalPoints)

        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
        tvGlobalPoints.text = "${prefs.getInt("rewardPoints", 0)} pts"
        applyRoleToTabs(prefs.getString("role", "user"))
        refreshPointsFromServer()

        if (savedInstanceState == null) {
            val openItemId = intent.getStringExtra("openItemId")
            if (openItemId != null) {
                loadFragment(HomeFragment(), addToBackStack = false)
                openItemDetail(openItemId)
            } else {
                loadFragment(HomeFragment(), addToBackStack = false)
            }
        }

        bottomNav.setOnItemSelectedListener { item ->
            val fragment: Fragment = when (item.itemId) {
                R.id.nav_home -> HomeFragment()
                R.id.nav_donate -> DonateFragment()
                R.id.nav_verify -> VerifyFragment()
                R.id.nav_map -> MapFragment()
                R.id.nav_profile -> ProfileFragment()
                else -> HomeFragment()
            }
            loadFragment(fragment, addToBackStack = false)
            true
        }
    }

    override fun onResume() {
        super.onResume()
        refreshPointsFromServer()
    }

    fun navigateToTab(itemId: Int) {
        bottomNav.selectedItemId = itemId
    }

    fun openScanFragment() {
        loadFragment(ScanFragment(), addToBackStack = true)
    }

    fun openItemDetail(resultId: String) {
        loadFragment(ItemDetailFragment.newInstance(resultId), addToBackStack = true)
    }

    fun setPointsDisplay(points: Int) {
        tvGlobalPoints.text = "$points pts"
    }

    private fun refreshPointsFromServer() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getMe()
                if (response.isSuccessful && response.body() != null) {
                    val user = response.body()!!.user
                    val role = user.role ?: "user"

                    val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
                    prefs.edit()
                        .putInt("rewardPoints", user.rewardPoints)
                        .putString("role", role)
                        .apply()

                    withContext(Dispatchers.Main) {
                        tvGlobalPoints.text = "${user.rewardPoints} pts"
                        applyRoleToTabs(role)
                    }
                }
            } catch (e: Exception) {
                // Keep showing cached value if this fails
            }
        }
    }

    // Only NGO staff (and admins) see the Verify tab.
    private fun applyRoleToTabs(role: String?) {
        val canVerify = role == "ngo" || role == "admin"
        bottomNav.menu.findItem(R.id.nav_verify)?.isVisible = canVerify
    }

    private fun loadFragment(fragment: Fragment, addToBackStack: Boolean) {
        val transaction = supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
        if (addToBackStack) {
            transaction.addToBackStack(null)
        }
        transaction.commit()
    }
}