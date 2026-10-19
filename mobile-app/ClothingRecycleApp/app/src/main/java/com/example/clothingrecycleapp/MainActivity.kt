package com.example.clothingrecycleapp

import android.graphics.Color
import android.os.Bundle
import android.view.View
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
    private lateinit var tvHeaderTitle: TextView
    private lateinit var tvNgoBanner: TextView

    // Which set of tabs is showing: donors and NGO partners get different apps.
    private var shell: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        RetrofitClient.init(this)

        bottomNav = findViewById(R.id.bottomNav)
        tvGlobalPoints = findViewById(R.id.tvGlobalPoints)
        tvHeaderTitle = findViewById(R.id.tvHeaderTitle)
        tvNgoBanner = findViewById(R.id.tvNgoBanner)

        val prefs = getSharedPreferences("app_prefs", MODE_PRIVATE)
        tvGlobalPoints.text = "${prefs.getInt("rewardPoints", 0)} pts"

        applyShell(prefs.getString("role", "user"), loadStartScreen = false)
        refreshPointsFromServer()

        if (savedInstanceState == null) {
            if (shell == SHELL_NGO) {
                loadFragment(NgoHomeFragment(), addToBackStack = false)
            } else {
                val openItemId = intent.getStringExtra("openItemId")
                loadFragment(HomeFragment(), addToBackStack = false)
                if (openItemId != null) {
                    openItemDetail(openItemId)
                }
            }
        }

        bottomNav.setOnItemSelectedListener { item ->
            val fragment: Fragment = when (item.itemId) {
                // Donor app
                R.id.nav_home -> HomeFragment()
                R.id.nav_donate -> DonateFragment()
                R.id.nav_map -> MapFragment()
                R.id.nav_profile -> ProfileFragment()
                // NGO partner app
                R.id.nav_ngo_home -> NgoHomeFragment()
                R.id.nav_ngo_verify -> VerifyFragment()
                R.id.nav_ngo_account -> NgoAccountFragment()
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

    fun openNgoTips() {
        loadFragment(NgoTipsFragment(), addToBackStack = true)
    }

    fun setPointsDisplay(points: Int) {
        tvGlobalPoints.text = "$points pts"
    }

    // Donors and NGO partners see different tabs and a different header.
    private fun applyShell(role: String?, loadStartScreen: Boolean) {
        val wanted = if (role == "ngo") SHELL_NGO else SHELL_DONOR
        if (wanted == shell) return

        shell = wanted
        bottomNav.menu.clear()

        if (wanted == SHELL_NGO) {
            bottomNav.inflateMenu(R.menu.bottom_nav_menu_ngo)
            tvHeaderTitle.text = "🍃 EcoThread Partners"
            tvGlobalPoints.visibility = View.GONE
        } else {
            bottomNav.inflateMenu(R.menu.bottom_nav_menu)
            // Donors never verify; NGO partners do that in their own app.
            bottomNav.menu.findItem(R.id.nav_verify)?.isVisible = false
            tvHeaderTitle.text = "🍃 EcoThread"
            tvGlobalPoints.visibility = View.VISIBLE
        }

        if (bottomNav.menu.size() > 0) {
            bottomNav.menu.getItem(0).isChecked = true
        }

        if (loadStartScreen) {
            val start: Fragment = if (wanted == SHELL_NGO) NgoHomeFragment() else HomeFragment()
            loadFragment(start, addToBackStack = false)
        }
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
                        applyShell(role, loadStartScreen = true)
                    }
                }
            } catch (e: Exception) {
                // Keep showing cached value if this fails
            }

            // The NGO application banner is separate, so a failure here changes nothing above.
            try {
                val appResponse = RetrofitClient.apiService.getMyNgoApplication()
                val application = if (appResponse.isSuccessful) appResponse.body()?.application else null
                val role = getSharedPreferences("app_prefs", MODE_PRIVATE).getString("role", "user")

                withContext(Dispatchers.Main) {
                    showNgoBanner(application, role)
                }
            } catch (e: Exception) {
                // No banner if we cannot check
            }
        }
    }

    private fun showNgoBanner(application: NgoApplicationInfo?, role: String?) {
        val status = application?.status

        when {
            status == "pending" -> {
                tvNgoBanner.text =
                    "Your NGO application is under review. NGO features unlock once an admin approves it."
                tvNgoBanner.setBackgroundColor(Color.parseColor("#FFF4E5"))
                tvNgoBanner.setTextColor(Color.parseColor("#8A5A00"))
                tvNgoBanner.visibility = View.VISIBLE
            }

            status == "rejected" && role != "ngo" && role != "admin" -> {
                val reason = application.rejectionReason?.takeIf { it.isNotBlank() }
                tvNgoBanner.text =
                    "Your NGO application was not approved." + (reason?.let { " Reason: $it" } ?: "")
                tvNgoBanner.setBackgroundColor(Color.parseColor("#FDECEA"))
                tvNgoBanner.setTextColor(Color.parseColor("#B3261E"))
                tvNgoBanner.visibility = View.VISIBLE
            }

            else -> tvNgoBanner.visibility = View.GONE
        }
    }

    private fun loadFragment(fragment: Fragment, addToBackStack: Boolean) {
        val transaction = supportFragmentManager.beginTransaction()
            .replace(R.id.fragmentContainer, fragment)
        if (addToBackStack) {
            transaction.addToBackStack(null)
        }
        transaction.commit()
    }

    private companion object {
        const val SHELL_DONOR = "donor"
        const val SHELL_NGO = "ngo"
    }
}