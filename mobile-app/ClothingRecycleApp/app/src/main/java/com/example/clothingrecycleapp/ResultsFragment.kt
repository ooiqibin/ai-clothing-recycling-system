package com.example.clothingrecycleapp

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import coil.load
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ResultsFragment : Fragment(R.layout.fragment_results) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvNoResult = view.findViewById<TextView>(R.id.tvNoResult)
        val resultCardContainer = view.findViewById<LinearLayout>(R.id.resultCardContainer)
        val ivResultImage = view.findViewById<ImageView>(R.id.ivResultImage)
        val tvResultCategory = view.findViewById<TextView>(R.id.tvResultCategory)
        val tvResultConfidence = view.findViewById<TextView>(R.id.tvResultConfidence)
        val tvResultPoints = view.findViewById<TextView>(R.id.tvResultPoints)
        val btnFindNGO = view.findViewById<Button>(R.id.btnFindNGO)
        val btnConfirmAction = view.findViewById<Button>(R.id.btnConfirmAction)
        val verificationCodeContainer = view.findViewById<LinearLayout>(R.id.verificationCodeContainer)
        val tvVerificationCode = view.findViewById<TextView>(R.id.tvVerificationCode)

        val resultId = LastResultHolder.resultId
        val category = LastResultHolder.category
        val confidence = LastResultHolder.confidence
        val potentialPoints = LastResultHolder.potentialPoints

        if (category == null || resultId == null) {
            tvNoResult.visibility = View.VISIBLE
            resultCardContainer.visibility = View.GONE
            return
        }

        tvNoResult.visibility = View.GONE
        resultCardContainer.visibility = View.VISIBLE

        tvResultCategory.text = category.uppercase()
        tvResultConfidence.text = "${((confidence ?: 0f) * 100).toInt()}%"
        val tvResultPointsLabel = view.findViewById<TextView>(R.id.tvResultPointsLabel)
        when (category) {
            "reusable" -> {
                tvResultPointsLabel.text = "Earned once an NGO verifies your donation"
                tvResultPoints.text = "+${potentialPoints ?: 0} pts"
            }
            "recyclable" -> {
                tvResultPointsLabel.text = "Take it to a textile recycling bin, then tap Mark as Recycled"
                tvResultPoints.text = "No points for recycling"
            }
            else -> {
                tvResultPointsLabel.text = "Dispose of it responsibly, then tap Mark as Disposed"
                tvResultPoints.text = "No points for disposal"
            }
        }

        LastResultHolder.imageUrl?.let { url ->
            ivResultImage.load(url) { crossfade(true) }
        }

        btnFindNGO.setOnClickListener {
            (activity as? MainActivity)?.navigateToTab(R.id.nav_map)
        }

        if (category == "reusable") {
            btnFindNGO.visibility = View.GONE
            btnConfirmAction.text = "Go to Donation Basket"
            btnConfirmAction.isEnabled = true
            btnConfirmAction.setOnClickListener {
                (activity as? MainActivity)?.navigateToTab(R.id.nav_donate)
            }
        } else {
            // Recyclable and damaged items are self-confirmed, no NGO needed
            btnFindNGO.visibility = View.GONE

            val actionValue = if (category == "recyclable") "recycled" else "disposed"
            val confirmLabel = if (category == "recyclable") "Mark as Recycled" else "Mark as Disposed"

            if (LastResultHolder.confirmed) {
                btnConfirmAction.text = "Confirmed ✓"
                btnConfirmAction.isEnabled = false
            } else {
                btnConfirmAction.text = confirmLabel
                btnConfirmAction.isEnabled = true
            }

            btnConfirmAction.setOnClickListener {
                confirmAction(resultId, actionValue, btnConfirmAction)
            }
        }
    }

    private fun prepareDonation(
        resultId: String,
        button: Button,
        codeContainer: LinearLayout,
        tvCode: TextView
    ) {
        button.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.prepareDonation(resultId)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        LastResultHolder.confirmed = true
                        LastResultHolder.verificationCode = body.verificationCode

                        codeContainer.visibility = View.VISIBLE
                        tvCode.text = body.verificationCode
                        button.text = "Awaiting NGO Verification"

                        Toast.makeText(requireContext(), "Show this code to the NGO to complete your donation", Toast.LENGTH_LONG).show()
                    } else {
                        button.isEnabled = true
                        Toast.makeText(requireContext(), "Failed to prepare donation. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    button.isEnabled = true
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun confirmAction(resultId: String, action: String, button: Button) {
        button.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.confirmAction(resultId, ConfirmActionRequest(action))
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        Toast.makeText(requireContext(), "Done. This case is closed.", Toast.LENGTH_SHORT).show()

                        (activity as? MainActivity)?.setPointsDisplay(body.totalRewardPoints)

                        val prefs = requireContext().getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
                        prefs.edit().putInt("rewardPoints", body.totalRewardPoints).apply()

                        LastResultHolder.confirmed = true
                        button.text = "Confirmed ✓"
                        button.isEnabled = false
                    } else {
                        button.isEnabled = true
                        Toast.makeText(requireContext(), "Failed to confirm. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    button.isEnabled = true
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}