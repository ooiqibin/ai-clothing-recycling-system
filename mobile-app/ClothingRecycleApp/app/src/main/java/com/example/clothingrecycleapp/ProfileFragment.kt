package com.example.clothingrecycleapp

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

class ProfileFragment : Fragment(R.layout.fragment_profile) {

    // Same estimate as the admin dashboard: about 0.4 kg per item,
    // 3.169 kg CO2e avoided per kg of clothing reused (European Commission figure).
    // This is an estimate, not a measured value.
    private val CO2_PER_ITEM_KG = 0.4 * 3.169

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvProfileName = view.findViewById<TextView>(R.id.tvProfileName)
        val tvProfileEmail = view.findViewById<TextView>(R.id.tvProfileEmail)
        val tvProfilePoints = view.findViewById<TextView>(R.id.tvProfilePoints)
        val tvProfileTotalItems = view.findViewById<TextView>(R.id.tvProfileTotalItems)
        val tvProfileCarbonOffset = view.findViewById<TextView>(R.id.tvProfileCarbonOffset)
        val tvBreakdown = view.findViewById<TextView>(R.id.tvBreakdown)
        val btnViewHistory = view.findViewById<Button>(R.id.btnViewHistory)
        val btnRedeemRewards = view.findViewById<Button>(R.id.btnRedeemRewards)
        val btnMyCoupons = view.findViewById<Button>(R.id.btnMyCoupons)

        btnViewHistory.setOnClickListener {
            startActivity(Intent(requireContext(), HistoryActivity::class.java))
        }

        btnRedeemRewards.setOnClickListener {
            startActivity(Intent(requireContext(), RewardsActivity::class.java))
        }

        btnMyCoupons.setOnClickListener {
            startActivity(
                Intent(requireContext(), RewardsActivity::class.java)
                    .putExtra(RewardsActivity.EXTRA_TAB, RewardsActivity.TAB_COUPONS)
            )
        }

        loadProfileData(tvProfileName, tvProfileEmail, tvProfilePoints, tvProfileTotalItems, tvProfileCarbonOffset, tvBreakdown)
    }

    // Points change when coupons are redeemed, so refresh when coming back.
    override fun onResume() {
        super.onResume()
        view?.let {
            loadProfileData(
                it.findViewById(R.id.tvProfileName),
                it.findViewById(R.id.tvProfileEmail),
                it.findViewById(R.id.tvProfilePoints),
                it.findViewById(R.id.tvProfileTotalItems),
                it.findViewById(R.id.tvProfileCarbonOffset),
                it.findViewById(R.id.tvBreakdown)
            )
        }
    }

    private fun loadProfileData(
        tvProfileName: TextView,
        tvProfileEmail: TextView,
        tvProfilePoints: TextView,
        tvProfileTotalItems: TextView,
        tvProfileCarbonOffset: TextView,
        tvBreakdown: TextView
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val meResponse = RetrofitClient.apiService.getMe()
                val historyResponse = RetrofitClient.apiService.getHistory()

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (meResponse.isSuccessful && meResponse.body() != null) {
                        val user = meResponse.body()!!.user
                        tvProfileName.text = user.name
                        tvProfileEmail.text = user.email
                        tvProfilePoints.text = user.rewardPoints.toString()
                    }

                    if (historyResponse.isSuccessful && historyResponse.body() != null) {
                        val items = historyResponse.body()!!.history
                        tvProfileTotalItems.text = items.size.toString()

                        // Only donations that an NGO verified count towards the offset.
                        val donatedCount = items.count { it.status == "donated" }
                        val carbonOffset = donatedCount * CO2_PER_ITEM_KG
                        tvProfileCarbonOffset.text = String.format(Locale.US, "%.1f kg", carbonOffset)

                        val reusableCount = items.count { it.category == "reusable" }
                        val recyclableCount = items.count { it.category == "recyclable" }
                        val damagedCount = items.count { it.category == "damaged" }
                        tvBreakdown.text = "Reusable: $reusableCount   •   Recyclable: $recyclableCount   •   Damaged: $damagedCount"
                    }
                }
            } catch (e: Exception) {
                // Fields stay at default placeholder values if this fails
            }
        }
    }
}