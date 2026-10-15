package com.example.clothingrecycleapp

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ProfileFragment : Fragment(R.layout.fragment_profile) {

    // Rough estimate: assume ~3kg CO2 saved per reusable/recyclable item processed.
    // This is a simple placeholder metric for the prototype, not a scientifically validated figure.
    private val CO2_PER_ITEM_KG = 3.0

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

        btnViewHistory.setOnClickListener {
            startActivity(Intent(requireContext(), HistoryActivity::class.java))
        }

        btnRedeemRewards.setOnClickListener {
            Toast.makeText(requireContext(), "Rewards catalog coming soon!", Toast.LENGTH_SHORT).show()
        }

        loadProfileData(tvProfileName, tvProfileEmail, tvProfilePoints, tvProfileTotalItems, tvProfileCarbonOffset, tvBreakdown)
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
                    if (meResponse.isSuccessful && meResponse.body() != null) {
                        val user = meResponse.body()!!.user
                        tvProfileName.text = user.name
                        tvProfileEmail.text = user.email
                        tvProfilePoints.text = user.rewardPoints.toString()
                    }

                    if (historyResponse.isSuccessful && historyResponse.body() != null) {
                        val items = historyResponse.body()!!.history
                        tvProfileTotalItems.text = items.size.toString()

                        val carbonOffset = items.size * CO2_PER_ITEM_KG
                        tvProfileCarbonOffset.text = "${carbonOffset.toInt()} kg"

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