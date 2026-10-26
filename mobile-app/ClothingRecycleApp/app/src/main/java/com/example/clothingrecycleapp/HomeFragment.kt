package com.example.clothingrecycleapp

import android.content.Context
import android.graphics.Typeface
import android.os.Bundle
import android.text.TextUtils
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

    // Shown when there are no published tips yet, or the server cannot be reached.
    private val fallbackTips = listOf(
        "💧 Wash in cold water to save energy.",
        "🌬️ Air dry linen to preserve fibers."
    )

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvTotalPointsInline = view.findViewById<TextView>(R.id.tvTotalPointsInline)
        val tvTotalItems = view.findViewById<TextView>(R.id.tvTotalItems)
        val btnStartScan = view.findViewById<Button>(R.id.btnStartScan)
        val recentContainer = view.findViewById<LinearLayout>(R.id.recentContributionsContainer)
        val ecoTipsContainer = view.findViewById<LinearLayout>(R.id.ecoTipsContainer)

        val prefs = requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        tvTotalPointsInline.text = "${prefs.getInt("rewardPoints", 0)} pts total"

        btnStartScan.setOnClickListener {
            (activity as? MainActivity)?.openScanFragment()
        }

        loadEcoTips(ecoTipsContainer)
        loadRecentItems(tvTotalPointsInline, tvTotalItems, recentContainer)
    }

    // ---------------------------------------------------------------
    // Eco tips
    // ---------------------------------------------------------------

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun cardParams(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(8) }

    private fun loadEcoTips(container: LinearLayout) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getEcoTips()
                val tips = if (response.isSuccessful) response.body()?.tips.orEmpty() else emptyList()

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (tips.isNotEmpty()) showTips(container, tips.take(5))
                    else showFallbackTips(container)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isAdded) showFallbackTips(container)
                }
            }
        }
    }

    private fun showFallbackTips(container: LinearLayout) {
        container.removeAllViews()

        fallbackTips.forEach { tipText ->
            container.addView(TextView(requireContext()).apply {
                text = tipText
                textSize = 13f
                setBackgroundResource(R.drawable.bg_card)
                setPadding(dp(14), dp(14), dp(14), dp(14))
                elevation = dp(1).toFloat()
                layoutParams = cardParams()
            })
        }
    }

    private fun showTips(container: LinearLayout, tips: List<EcoTipItem>) {
        container.removeAllViews()

        tips.forEach { tip ->
            val card = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundResource(R.drawable.bg_card)
                setPadding(dp(14), dp(14), dp(14), dp(14))
                elevation = dp(1).toFloat()
                layoutParams = cardParams()
            }

            card.addView(TextView(requireContext()).apply {
                text = tip.category.uppercase()
                textSize = 10f
                setTypeface(null, Typeface.BOLD)
                setTextColor(resources.getColor(R.color.eco_primary_green, null))
            })

            card.addView(TextView(requireContext()).apply {
                text = tip.title
                textSize = 14f
                setTypeface(null, Typeface.BOLD)
                setTextColor(resources.getColor(R.color.eco_text_dark, null))
                setPadding(0, dp(2), 0, dp(4))
            })

            val body = TextView(requireContext()).apply {
                text = tip.content
                textSize = 13f
                maxLines = COLLAPSED_LINES
                ellipsize = TextUtils.TruncateAt.END
                setTextColor(resources.getColor(R.color.eco_text_dark, null))
            }
            card.addView(body)

            tip.author?.takeIf { it.isNotBlank() }?.let { author ->
                card.addView(TextView(requireContext()).apply {
                    text = "By $author"
                    textSize = 11f
                    setTextColor(resources.getColor(R.color.eco_text_gray, null))
                    setPadding(0, dp(6), 0, 0)
                })
            }

            // Tap a tip to read all of it; tap again to collapse.
            card.setOnClickListener {
                body.maxLines = if (body.maxLines == COLLAPSED_LINES) Int.MAX_VALUE else COLLAPSED_LINES
            }

            container.addView(card)
        }
    }

    // ---------------------------------------------------------------
    // Recent contributions
    // ---------------------------------------------------------------

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
                                        tvPointsRow.text = if (item.category == "reusable") "+${item.potentialPoints} pts" else ""
                                    }
                                    "awaiting_verification" -> {
                                        tvStatus.text = "Awaiting NGO"
                                        tvPointsRow.text = "+${item.potentialPoints} pts"
                                    }
                                    else -> {
                                        tvStatus.text = item.status.replace('_', ' ').replaceFirstChar { it.uppercase() }
                                        tvPointsRow.text = if (item.pointsAwarded > 0) "+${item.pointsAwarded} pts" else ""
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

    private companion object {
        const val COLLAPSED_LINES = 3
    }
}