package com.example.clothingrecycleapp

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import coil.load
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class HistoryActivity : AppCompatActivity() {

    private lateinit var historyContainer: LinearLayout
    private lateinit var tvEmptyState: TextView
    private lateinit var chipAll: TextView
    private lateinit var chipDonated: TextView
    private lateinit var chipRecycled: TextView
    private lateinit var chipDisposed: TextView

    private var allItems: List<HistoryItem> = emptyList()
    private var currentFilter: String = "all"

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_history)
        RetrofitClient.init(this)

        historyContainer = findViewById(R.id.historyContainer)
        tvEmptyState = findViewById(R.id.tvEmptyState)
        chipAll = findViewById(R.id.chipAll)
        chipDonated = findViewById(R.id.chipDonated)
        chipRecycled = findViewById(R.id.chipRecycled)
        chipDisposed = findViewById(R.id.chipDisposed)

        chipAll.setOnClickListener { selectFilter("all") }
        chipDonated.setOnClickListener { selectFilter("donated") }
        chipRecycled.setOnClickListener { selectFilter("recycled") }
        chipDisposed.setOnClickListener { selectFilter("disposed") }

        loadHistory()
    }

    private fun selectFilter(filter: String) {
        currentFilter = filter

        val chips = listOf(chipAll, chipDonated, chipRecycled, chipDisposed)
        val labels = listOf("all", "donated", "recycled", "disposed")

        chips.forEachIndexed { index, chip ->
            if (labels[index] == filter) {
                chip.setBackgroundResource(R.drawable.bg_button_primary)
                chip.setTextColor(getColor(R.color.eco_white))
            } else {
                chip.setBackgroundResource(R.drawable.bg_card)
                chip.setTextColor(getColor(R.color.eco_text_dark))
            }
        }

        renderList()
    }

    private fun loadHistory() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getHistory()
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        allItems = response.body()!!.history
                        renderList()
                    } else {
                        tvEmptyState.text = "Failed to load history"
                        tvEmptyState.visibility = View.VISIBLE
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    tvEmptyState.text = "Error: ${e.message}"
                    tvEmptyState.visibility = View.VISIBLE
                }
            }
        }
    }

    private fun renderList() {
        val filtered = if (currentFilter == "all") {
            allItems
        } else {
            allItems.filter { it.status == currentFilter }
        }

        historyContainer.removeAllViews()

        if (filtered.isEmpty()) {
            tvEmptyState.visibility = View.VISIBLE
            return
        }
        tvEmptyState.visibility = View.GONE

        filtered.forEach { item ->
            val row = LayoutInflater.from(this)
                .inflate(R.layout.item_recent_contribution, historyContainer, false)

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
                val intent = Intent(this, MainActivity::class.java)
                intent.putExtra("openItemId", item._id)
                intent.flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                startActivity(intent)
                finish()
            }

            historyContainer.addView(row)
        }
    }
}