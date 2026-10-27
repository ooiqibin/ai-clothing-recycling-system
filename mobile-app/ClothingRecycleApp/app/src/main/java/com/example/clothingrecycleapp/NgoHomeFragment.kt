package com.example.clothingrecycleapp

import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class NgoHomeFragment : Fragment(R.layout.fragment_ngo_home) {

    private var pendingPdfBytes: ByteArray? = null

    private val createPdfLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/pdf")
    ) { uri: Uri? ->

        if (uri == null) {
            pendingPdfBytes = null
            return@registerForActivityResult
        }

        val bytes = pendingPdfBytes
        pendingPdfBytes = null

        if (bytes == null) return@registerForActivityResult

        val resolver = requireContext().contentResolver

        CoroutineScope(Dispatchers.IO).launch {
            val result = runCatching {
                val output = resolver.openOutputStream(uri)
                    ?: throw IOException("Unable to open the output stream")

                output.use {
                    it.write(bytes)
                }
            }

            withContext(Dispatchers.Main) {
                if (!isAdded) return@withContext

                val message = if (result.isSuccess) {
                    "PDF report saved successfully"
                } else {
                    "Could not save PDF report"
                }

                Toast.makeText(
                    requireContext(),
                    message,
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }

    override fun onViewCreated(
        view: View,
        savedInstanceState: Bundle?
    ) {
        super.onViewCreated(view, savedInstanceState)

        view.findViewById<Button>(R.id.btnGoVerify)
            .setOnClickListener {
                (activity as? MainActivity)
                    ?.navigateToTab(R.id.nav_ngo_verify)
            }

        view.findViewById<Button>(R.id.btnShareTip)
            .setOnClickListener {
                (activity as? MainActivity)?.openNgoTips()
            }

        view.findViewById<Button>(R.id.btnExportNgoReport)
            .setOnClickListener {
                exportDonationReport()
            }

        loadOverview(view)
    }

    private fun loadOverview(root: View) {
        val tvCentre = root.findViewById<TextView>(
            R.id.tvHomeCentre
        )

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response =
                    RetrofitClient.apiService.getNgoOverview()

                val body =
                    if (response.isSuccessful) response.body()
                    else null

                val code = response.code()

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (body != null) {
                        show(root, body)
                    } else {
                        tvCentre.text = if (code == 403) {
                            "Your account is not linked to a donation centre yet. Ask an admin to link it."
                        } else {
                            "Could not load your dashboard."
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isAdded) {
                        tvCentre.text =
                            "Could not load your dashboard."
                    }
                }
            }
        }
    }

    private fun show(
        root: View,
        data: NgoOverviewResponse
    ) {
        root.findViewById<TextView>(R.id.tvHomeCentre).text =
            data.centre.name

        root.findViewById<TextView>(R.id.tvToday).text =
            (data.today?.items ?: 0).toString()

        root.findViewById<TextView>(R.id.tvPending).text =
            data.pending.toString()

        root.findViewById<TextView>(R.id.tvTotalDonations).text =
            data.totals.donations.toString()

        root.findViewById<TextView>(R.id.tvTotalItems).text =
            data.totals.items.toString()

        root.findViewById<TextView>(R.id.tvCarbon).text =
            formatCarbon(data.carbonKg)

        val container = root.findViewById<LinearLayout>(
            R.id.recentContainer
        )

        container.removeAllViews()

        if (data.recent.isEmpty()) {
            container.addView(
                TextView(requireContext()).apply {
                    text = "No verified donations yet."
                    textSize = 13f
                    setTextColor(
                        resources.getColor(
                            R.color.eco_text_gray,
                            null
                        )
                    )
                }
            )
            return
        }

        val pad =
            (8 * resources.displayMetrics.density).toInt()

        data.recent.take(5).forEach { donation ->
            container.addView(
                TextView(requireContext()).apply {
                    text =
                        "${donation.donorName} • " +
                                "${donation.itemCount} item(s) • " +
                                "+${donation.points} pts\n" +
                                (donation.verifiedAt?.take(10) ?: "")

                    textSize = 13f

                    setTextColor(
                        resources.getColor(
                            R.color.eco_text_dark,
                            null
                        )
                    )

                    setPadding(0, pad, 0, pad)
                }
            )
        }
    }

    private fun exportDonationReport() {
        Toast.makeText(
            requireContext(),
            "Preparing your donation report...",
            Toast.LENGTH_SHORT
        ).show()

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response =
                    RetrofitClient.apiService.getNgoDonationReport()

                if (!response.isSuccessful || response.body() == null) {
                    val message = when (response.code()) {
                        401 -> "Please log in again."
                        403 -> "Your NGO account must be linked to a donation centre."
                        else -> "Could not generate the report."
                    }

                    withContext(Dispatchers.Main) {
                        if (!isAdded) return@withContext

                        Toast.makeText(
                            requireContext(),
                            message,
                            Toast.LENGTH_LONG
                        ).show()
                    }

                    return@launch
                }

                val report = response.body()!!

                val pdfBytes = NgoReportPdf.create(report)

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    pendingPdfBytes = pdfBytes

                    val timestamp = SimpleDateFormat(
                        "yyyyMMdd_HHmm",
                        Locale.US
                    ).format(Date())

                    createPdfLauncher.launch(
                        "NGO_Donation_Report_$timestamp.pdf"
                    )
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    Toast.makeText(
                        requireContext(),
                        "Could not generate report: ${e.message ?: "Unknown error"}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun formatCarbon(kg: Double): String =
        if (kg >= 1000) {
            String.format(
                Locale.US,
                "%.2f tonnes",
                kg / 1000
            )
        } else {
            String.format(
                Locale.US,
                "%.1f kg",
                kg
            )
        }
}
