package com.example.clothingrecycleapp

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.fragment.app.Fragment
import coil.load
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HomeFragment : Fragment(R.layout.fragment_home) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvTotalPointsInline = view.findViewById<TextView>(R.id.tvTotalPointsInline)
        val tvTotalItems = view.findViewById<TextView>(R.id.tvTotalItems)
        val btnStartScan = view.findViewById<Button>(R.id.btnStartScan)
        val recentContainer = view.findViewById<LinearLayout>(R.id.recentContributionsContainer)

        val prefs = requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        tvTotalPointsInline.text = "${prefs.getInt("rewardPoints", 0)} pts total"

        btnStartScan.setOnClickListener {
            (activity as? MainActivity)?.openScanFragment()
        }

        loadRecentItems(tvTotalPointsInline, tvTotalItems, recentContainer)
    }

    private fun loadRecentItems(
        tvTotalPointsInline: TextView,
        tvTotalItems: TextView,
        recentContainer: LinearLayout
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val meResponse = RetrofitClient.apiService.getMe()
                val historyResponse = RetrofitClient.apiService.getHistory()

                withContext(Dispatchers.Main) {
                    if (meResponse.isSuccessful) {
                        val points = meResponse.body()?.user?.rewardPoints ?: 0
                        tvTotalPointsInline.text = "$points pts total"
                    }

                    if (historyResponse.isSuccessful) {
                        val allItems = historyResponse.body()?.history ?: emptyList()
                        val completedCount = allItems.count { it.status !in listOf("pending") }
                        tvTotalItems.text = "$completedCount items classified"

                        recentContainer.removeAllViews()

                        if (allItems.isEmpty()) {
                            val emptyText = TextView(requireContext())
                            emptyText.text = "No items yet. Scan your first one!"
                            emptyText.setTextColor(resources.getColor(R.color.eco_text_gray, null))
                            recentContainer.addView(emptyText)
                        } else {
                            allItems.take(5).forEach { item ->
                                val row = LayoutInflater.from(requireContext())
                                    .inflate(R.layout.item_recent_contribution, recentContainer, false)

                                val ivThumb = row.findViewById<ImageView>(R.id.ivThumb)
                                val tvCategory = row.findViewById<TextView>(R.id.tvCategory)
                                val tvStatus = row.findViewById<TextView>(R.id.tvStatus)
                                val tvPointsRow = row.findViewById<TextView>(R.id.tvPointsRow)

                                ivThumb.load(Constants.SERVER_BASE_URL + item.imageUrl) { crossfade(true) }
                                tvCategory.text = item.category.replaceFirstChar { it.uppercase() }

                                when (item.status) {
                                    "pending" -> {
                                        tvStatus.text = "Tap to complete"
                                        tvPointsRow.text = "+${item.potentialPoints} pts"
                                    }
                                    "awaiting_verification" -> {
                                        tvStatus.text = "Awaiting NGO"
                                        tvPointsRow.text = "+${item.potentialPoints} pts"
                                    }
                                    else -> {
                                        tvStatus.text = item.status.replaceFirstChar { it.uppercase() }
                                        tvPointsRow.text = "+${item.pointsAwarded} pts"
                                    }
                                }

                                row.setOnClickListener {
                                    (activity as? MainActivity)?.openItemDetail(item._id)
                                }

                                recentContainer.addView(row)
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                // Fail silently on the home screen
            }
        }
    }
}