package com.example.clothingrecycleapp

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
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
        tvStatus = view.findViewById(R.id.tvVerifyStatus)
        recentSection = view.findViewById(R.id.recentSection)
        recentContainer = view.findViewById(R.id.recentDonationsContainer)

        btnVerify.setOnClickListener {
            verify(etCode.text.toString().trim())
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

    // ---------------------------------------------------------------
    // Recent verifications at this centre
    // ---------------------------------------------------------------

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

    // ---------------------------------------------------------------
    // Verifying a code (unchanged)
    // ---------------------------------------------------------------

    private fun verify(code: String) {
        if (code.length != 6 || !code.all { it.isDigit() }) {
            showStatus("Please enter a valid 6-digit code", android.R.color.holo_red_dark)
            return
        }

        showStatus("Verifying...", R.color.eco_text_gray)
        btnVerify.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.verifyDonation(VerifyRequest(code))

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

    // The backend sends errors as {"error": "message"}.
    private fun readErrorMessage(raw: String?): String {
        return try {
            JSONObject(raw ?: "").optString("error").ifBlank { "Verification failed" }
        } catch (e: Exception) {
            "Verification failed"
        }
    }
}