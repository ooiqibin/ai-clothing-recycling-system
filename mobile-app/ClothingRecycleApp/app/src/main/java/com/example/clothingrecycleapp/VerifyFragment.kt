package com.example.clothingrecycleapp

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.CheckBox
import android.widget.ImageView
import coil.load
import androidx.fragment.app.Fragment
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class VerifyFragment : Fragment(R.layout.fragment_verify) {

    private lateinit var etCode: EditText
    private lateinit var btnVerify: Button
    private lateinit var tvStatus: TextView
    private lateinit var recentSection: LinearLayout
    private lateinit var recentContainer: LinearLayout
    private lateinit var btnConfirmItems: Button
    private lateinit var previewSection: LinearLayout
    private lateinit var itemsContainer: LinearLayout
    private lateinit var previewTitle: TextView
    private lateinit var previewSummary: TextView

    private var currentPreview: VerifyPreviewResponse? = null

    private val itemCheckboxes = linkedMapOf<String, CheckBox>()
    // Opens the camera, and gives back whatever the QR code contains.
    private val scanLauncher = registerForActivityResult(ScanContract()) { result ->
        val scanned = result.contents?.trim()
        if (scanned.isNullOrEmpty()) return@registerForActivityResult // scan cancelled

        etCode.setText(scanned)
        verify(scanned)
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        etCode = view.findViewById(R.id.etVerificationCode)
        btnVerify = view.findViewById(R.id.btnVerify)
        btnConfirmItems = view.findViewById(R.id.btnConfirmVerifiedItems)
        tvStatus = view.findViewById(R.id.tvVerifyStatus)
        recentSection = view.findViewById(R.id.recentSection)
        recentContainer = view.findViewById(R.id.recentDonationsContainer)
        previewSection = view.findViewById(R.id.donationPreviewSection)
        itemsContainer = view.findViewById(R.id.donationItemsContainer)
        previewTitle = view.findViewById(R.id.tvDonationPreviewTitle)
        previewSummary = view.findViewById(R.id.tvDonationPreviewSummary)

        btnVerify.setOnClickListener {
            loadDonationPreview(view.findViewById<EditText>(R.id.etVerificationCode).text.toString().trim())
        }

        btnConfirmItems.setOnClickListener {
            confirmAcceptedItems()
        }

        view.findViewById<Button>(R.id.btnScanQr).setOnClickListener {
            val options = ScanOptions()
                .setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                .setPrompt("Scan the donor's QR code")
                .setBeepEnabled(false)
                .setOrientationLocked(false)

            scanLauncher.launch(options)
        }

        loadRecent()
    }

    private fun showStatus(message: String, colorRes: Int) {
        tvStatus.setTextColor(resources.getColor(colorRes, null))
        tvStatus.text = message
    }

    // Recent verifications at this centre

    private fun loadRecent() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getNgoOverview()
                val body = if (response.isSuccessful) response.body() else null

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (body == null) {
                        recentSection.visibility = View.GONE
                    } else {
                        showRecent(body.recent.take(5))
                    }
                }
            } catch (e: Exception) {
                // Leave the list hidden if it cannot be loaded.
            }
        }
    }

    private fun showRecent(items: List<NgoRecentDonation>) {
        recentSection.visibility = View.VISIBLE
        recentContainer.removeAllViews()

        if (items.isEmpty()) {
            recentContainer.addView(TextView(requireContext()).apply {
                text = "No verified donations yet."
                textSize = 13f
                setTextColor(resources.getColor(R.color.eco_text_gray, null))
            })
            return
        }

        val pad = (8 * resources.displayMetrics.density).toInt()

        items.forEach { donation ->
            recentContainer.addView(TextView(requireContext()).apply {
                text = "${donation.donorName} • ${donation.itemCount} item(s) • +${donation.points} pts\n" +
                        (donation.verifiedAt?.take(10) ?: "")
                textSize = 13f
                setTextColor(resources.getColor(R.color.eco_text_dark, null))
                setPadding(0, pad, 0, pad)
            })
        }
    }

    // Verifying a code (unchanged)

    private fun verify(code: String) {
        if (code.length != 6 || !code.all { it.isDigit() }) {
            showStatus("Please enter a valid 6-digit code", android.R.color.holo_red_dark)
            return
        }

        showStatus("Verifying...", R.color.eco_text_gray)
        btnVerify.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.verifyDonation(
                    VerifyRequest(
                        verificationCode = code,
                        acceptedItemIds = emptyList()
                    )
                )

                // Read the error text here, while we are still off the main thread.
                val errorText = if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    btnVerify.isEnabled = true

                    val body = response.body()
                    if (response.isSuccessful && body != null) {
                        showStatus(
                            "Verified! ${body.donorName} earned +${body.pointsAwarded} pts for donating ${body.itemCount} item(s).",
                            R.color.eco_dark_green
                        )
                        etCode.text.clear()
                        loadRecent() // update the recent list
                    } else {
                        showStatus(errorText ?: "Verification failed", android.R.color.holo_red_dark)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    btnVerify.isEnabled = true
                    showStatus("Error: ${e.message}", android.R.color.holo_red_dark)
                }
            }
        }
    }

    private fun loadDonationPreview(code: String) {
        if (code.length != 6 || !code.all { it.isDigit() }) {
            tvStatus.text = "Enter a valid 6-digit code"
            return
        }

        btnVerify.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.previewDonation(
                    VerifyPreviewRequest(code)
                )

                val body = response.body()

                withContext(Dispatchers.Main) {
                    btnVerify.isEnabled = true

                    if (response.isSuccessful && body != null) {
                        currentPreview = body
                        showDonationPreview(body)
                        tvStatus.text =
                            "Inspect the physical basket and untick missing items."
                    } else {
                        tvStatus.text = response.errorBody()
                            ?.string() ?: "Failed to load donation"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    btnVerify.isEnabled = true
                    tvStatus.text = "Error: ${e.message}"
                }
            }
        }
    }

    private fun showDonationPreview(
        preview: VerifyPreviewResponse
    ) {
        itemsContainer.removeAllViews()
        itemCheckboxes.clear()

        previewTitle.text = "Donation from ${preview.donorName}"

        preview.items.forEachIndexed { index, item ->
            val row = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.CENTER_VERTICAL
            }

            val image = ImageView(requireContext()).apply {
                layoutParams = LinearLayout.LayoutParams(200, 200)
                scaleType = ImageView.ScaleType.CENTER_CROP

                item.imageUrl?.let { path ->
                    load(Constants.SERVER_BASE_URL + path)
                }
            }

            val checkbox = CheckBox(requireContext()).apply {
                text = "Item ${index + 1}: ${item.category}\n" +
                        "${item.pointsPerItem} points if accepted"
                isChecked = true

                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    1f
                )
            }

            checkbox.setOnCheckedChangeListener { _, _ ->
                updateSelectedSummary()
            }

            itemCheckboxes[item.id] = checkbox

            row.addView(image)
            row.addView(checkbox)
            itemsContainer.addView(row)
        }

        previewSection.visibility = View.VISIBLE
        updateSelectedSummary()
    }

    private fun updateSelectedSummary() {
        val preview = currentPreview ?: return

        val acceptedCount =
            itemCheckboxes.values.count { it.isChecked }

        val points = acceptedCount * 5

        previewSummary.text =
            "${preview.items.size} listed • " +
                    "$acceptedCount accepted • $points points"

        btnConfirmItems.isEnabled = acceptedCount > 0

        btnConfirmItems.text =
            "Confirm $acceptedCount Item(s) and Award $points Points"
    }

    private fun confirmAcceptedItems() {
        val preview = currentPreview ?: return

        val acceptedIds = itemCheckboxes
            .filterValues { it.isChecked }
            .keys
            .toList()

        if (acceptedIds.isEmpty()) {
            tvStatus.text = "Select at least one received item"
            return
        }

        btnConfirmItems.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.verifyDonation(
                    VerifyRequest(
                        verificationCode = preview.verificationCode,
                        acceptedItemIds = acceptedIds
                    )
                )

                val body = response.body()

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && body != null) {
                        tvStatus.text =
                            "Verified ${body.itemCount} items. " +
                                    "${body.donorName} earned " +
                                    "${body.pointsAwarded} points."

                        currentPreview = null
                        itemCheckboxes.clear()
                        itemsContainer.removeAllViews()
                        previewSection.visibility = View.GONE
                    } else {
                        btnConfirmItems.isEnabled = true
                        tvStatus.text = response.errorBody()
                            ?.string() ?: "Verification failed"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    btnConfirmItems.isEnabled = true
                    tvStatus.text = "Error: ${e.message}"
                }
            }
        }
    }

    // The backend sends errors as {"error": "message"}.
    private fun readErrorMessage(raw: String?): String {
        return try {
            JSONObject(raw ?: "").optString("error").ifBlank { "Verification failed" }
        } catch (e: Exception) {
            "Verification failed"
        }
    }
}