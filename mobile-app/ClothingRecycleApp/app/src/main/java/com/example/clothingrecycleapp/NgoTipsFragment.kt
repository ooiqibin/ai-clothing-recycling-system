package com.example.clothingrecycleapp

import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.View
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class NgoTipsFragment : Fragment(R.layout.fragment_ngo_tips) {

    // Keep this list the same as the categories in the backend and dashboard.
    private val categories = listOf("Recycling", "Donation", "Reuse", "Care & Repair", "Shopping", "General")

    private lateinit var etTitle: EditText
    private lateinit var spCategory: Spinner
    private lateinit var etContent: EditText
    private lateinit var btnSubmit: Button
    private lateinit var tvStatus: TextView
    private lateinit var myTipsContainer: LinearLayout

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        etTitle = view.findViewById(R.id.etTipTitle)
        spCategory = view.findViewById(R.id.spCategory)
        etContent = view.findViewById(R.id.etTipContent)
        btnSubmit = view.findViewById(R.id.btnSubmitTip)
        tvStatus = view.findViewById(R.id.tvTipStatus)
        myTipsContainer = view.findViewById(R.id.myTipsContainer)

        spCategory.adapter = ArrayAdapter(
            requireContext(),
            android.R.layout.simple_spinner_dropdown_item,
            categories
        )

        btnSubmit.setOnClickListener { submit() }

        loadMyTips()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun showStatus(message: String, isError: Boolean) {
        tvStatus.setTextColor(
            if (isError) Color.parseColor("#B3261E") else resources.getColor(R.color.eco_dark_green, null)
        )
        tvStatus.text = message
    }

    private fun submit() {
        val title = etTitle.text.toString().trim()
        val content = etContent.text.toString().trim()
        val category = spCategory.selectedItem as String

        if (title.length < 3) {
            showStatus("The title needs at least 3 characters", true)
            return
        }
        if (content.length < 10) {
            showStatus("The tip text needs at least 10 characters", true)
            return
        }

        btnSubmit.isEnabled = false
        showStatus("Submitting...", false)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.createEcoTip(
                    CreateEcoTipRequest(title, content, category)
                )
                val errorText =
                    if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    btnSubmit.isEnabled = true

                    if (response.isSuccessful) {
                        etTitle.text.clear()
                        etContent.text.clear()
                        showStatus("Submitted! An admin will review your tip before users see it.", false)
                        loadMyTips()
                    } else {
                        showStatus(errorText ?: "Could not submit your tip", true)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    btnSubmit.isEnabled = true
                    showStatus("Error: ${e.message}", true)
                }
            }
        }
    }

    private fun loadMyTips() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getMyEcoTips()
                val tips = if (response.isSuccessful) response.body()?.tips.orEmpty() else null

                withContext(Dispatchers.Main) {
                    if (!isAdded || tips == null) return@withContext
                    showTips(tips)
                }
            } catch (e: Exception) {
                // Leave the list as it is if it cannot be loaded.
            }
        }
    }

    private fun showTips(tips: List<EcoTipItem>) {
        myTipsContainer.removeAllViews()

        if (tips.isEmpty()) {
            myTipsContainer.addView(TextView(requireContext()).apply {
                text = "You have not submitted any tips yet."
                textSize = 13f
                setTextColor(resources.getColor(R.color.eco_text_gray, null))
            })
            return
        }

        tips.forEach { tip ->
            val row = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(0, dp(10), 0, dp(10))
            }

            row.addView(TextView(requireContext()).apply {
                text = tip.title
                textSize = 14f
                setTypeface(null, Typeface.BOLD)
                setTextColor(resources.getColor(R.color.eco_text_dark, null))
            })

            val (statusText, statusColor) = when (tip.status) {
                "published" -> "Published" to resources.getColor(R.color.eco_dark_green, null)
                "rejected" -> "Not approved" to Color.parseColor("#B3261E")
                else -> "Waiting for admin review" to Color.parseColor("#8A5A00")
            }

            row.addView(TextView(requireContext()).apply {
                text = "${tip.category} • $statusText"
                textSize = 12f
                setTextColor(statusColor)
            })

            if (tip.status == "rejected" && !tip.rejectionReason.isNullOrBlank()) {
                row.addView(TextView(requireContext()).apply {
                    text = "Reason: ${tip.rejectionReason}"
                    textSize = 12f
                    setTextColor(resources.getColor(R.color.eco_text_gray, null))
                })
            }

            // A published tip can only be removed by an admin.
            if (tip.status != "published") {
                row.addView(TextView(requireContext()).apply {
                    text = "Delete"
                    textSize = 12f
                    setTextColor(Color.parseColor("#B3261E"))
                    setPadding(0, dp(6), 0, 0)
                    setOnClickListener { confirmDelete(tip) }
                })
            }

            myTipsContainer.addView(row)
        }
    }

    private fun confirmDelete(tip: EcoTipItem) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete this tip?")
            .setMessage(tip.title)
            .setPositiveButton("Delete") { _, _ -> deleteTip(tip) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun deleteTip(tip: EcoTipItem) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.deleteMyEcoTip(tip.id)
                val errorText =
                    if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (response.isSuccessful) {
                        loadMyTips()
                    } else {
                        showStatus(errorText ?: "Could not delete the tip", true)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    showStatus("Error: ${e.message}", true)
                }
            }
        }
    }

    // The backend sends errors as {"error": "message"}.
    private fun readErrorMessage(raw: String?): String {
        return try {
            JSONObject(raw ?: "").optString("error").ifBlank { "Something went wrong" }
        } catch (e: Exception) {
            "Something went wrong"
        }
    }
}