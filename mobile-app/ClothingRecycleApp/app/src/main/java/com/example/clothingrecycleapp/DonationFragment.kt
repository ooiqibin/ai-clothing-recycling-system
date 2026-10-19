package com.example.clothingrecycleapp

import android.os.Bundle
import androidx.appcompat.app.AlertDialog
import android.graphics.Bitmap
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import coil.load
import com.google.zxing.BarcodeFormat
import com.journeyapps.barcodescanner.BarcodeEncoder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class DonateFragment : Fragment(R.layout.fragment_donate) {

    private val selectedIds = mutableSetOf<String>()
    private var selectedPointsTotal = 0

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadBasket(view)
    }

    private fun loadBasket(rootView: View) {
        val activeBatchContainer = rootView.findViewById<LinearLayout>(R.id.activeBatchContainer)
        val tvActiveBatchCode = rootView.findViewById<TextView>(R.id.tvActiveBatchCode)
        val tvActiveBatchInfo = rootView.findViewById<TextView>(R.id.tvActiveBatchInfo)
        val pendingItemsContainer = rootView.findViewById<LinearLayout>(R.id.pendingItemsContainer)
        val tvEmptyBasket = rootView.findViewById<TextView>(R.id.tvEmptyBasket)
        val btnPrepareDonation = rootView.findViewById<Button>(R.id.btnPrepareDonation)
        val tvDonateSubtitle = rootView.findViewById<TextView>(R.id.tvDonateSubtitle)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getDonationBasket()
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!

                        if (body.activeBatch != null) {
                            // There's already a batch waiting on NGO verification - show that instead
                            tvDonateSubtitle.visibility = View.GONE
                            pendingItemsContainer.visibility = View.GONE
                            btnPrepareDonation.visibility = View.GONE
                            activeBatchContainer.visibility = View.VISIBLE

                            tvActiveBatchCode.text = body.activeBatch.verificationCode
                            rootView.findViewById<ImageView>(R.id.ivActiveBatchQr)
                                .setImageBitmap(createQrBitmap(body.activeBatch.verificationCode))
                            val centreLine = body.activeBatch.centre?.name?.let { "\nHand in at: $it" } ?: ""
                            tvActiveBatchInfo.text = "${body.activeBatch.items.size} items • +${body.activeBatch.totalPoints} pts once verified$centreLine"

                        } else if (body.pendingItems.isEmpty()) {
                            tvEmptyBasket.visibility = View.VISIBLE
                            btnPrepareDonation.visibility = View.GONE

                        } else {
                            pendingItemsContainer.removeAllViews()
                            body.pendingItems.forEach { item ->
                                val row = LayoutInflater.from(requireContext())
                                    .inflate(R.layout.item_donation_pending, pendingItemsContainer, false)

                                val cb = row.findViewById<CheckBox>(R.id.cbSelect)
                                val ivThumb = row.findViewById<ImageView>(R.id.ivThumb)
                                val tvDate = row.findViewById<TextView>(R.id.tvDate)
                                val tvPointsRow = row.findViewById<TextView>(R.id.tvPointsRow)

                                ivThumb.load(Constants.SERVER_BASE_URL + item.imageUrl) { crossfade(true) }
                                tvDate.text = item.createdAt.take(10)
                                tvPointsRow.text = "+${item.potentialPoints} pts"

                                cb.setOnCheckedChangeListener { _, isChecked ->
                                    if (isChecked) {
                                        selectedIds.add(item._id)
                                        selectedPointsTotal += item.potentialPoints
                                    } else {
                                        selectedIds.remove(item._id)
                                        selectedPointsTotal -= item.potentialPoints
                                    }
                                    btnPrepareDonation.text = "Prepare Donation (${selectedIds.size} selected, +$selectedPointsTotal pts)"
                                }

                                pendingItemsContainer.addView(row)
                            }

                            btnPrepareDonation.setOnClickListener {
                                prepareDonation(btnPrepareDonation)
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), "Failed to load basket: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun createQrBitmap(content: String, size: Int = 700): Bitmap {
        return BarcodeEncoder().encodeBitmap(content, BarcodeFormat.QR_CODE, size, size)
    }

    private fun prepareDonation(button: Button) {
        if (selectedIds.isEmpty()) {
            Toast.makeText(requireContext(), "Select at least one item first", Toast.LENGTH_SHORT).show()
            return
        }

        button.isEnabled = false

        // First ask the donor which centre they will hand the clothes to.
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getDonationCentres()
                val centres = if (response.isSuccessful) response.body()?.centers.orEmpty() else emptyList()

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (centres.isEmpty()) {
                        button.isEnabled = true
                        Toast.makeText(requireContext(), "No donation centres are available yet", Toast.LENGTH_LONG).show()
                    } else {
                        showCentreChooser(centres, button)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    button.isEnabled = true
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showCentreChooser(centres: List<DonationCentreItem>, button: Button) {
        val labels = centres.map { c ->
            if (c.address.isNullOrBlank()) c.name else "${c.name}\n${c.address}"
        }.toTypedArray()

        AlertDialog.Builder(requireContext())
            .setTitle("Where will you hand in your donation?")
            .setItems(labels) { _, which -> submitBatch(centres[which], button) }
            .setNegativeButton("Cancel") { _, _ -> button.isEnabled = true }
            .setOnCancelListener { button.isEnabled = true }
            .show()
    }

    private fun submitBatch(centre: DonationCentreItem, button: Button) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.prepareDonationBatch(
                    PrepareBatchRequest(selectedIds.toList(), centre._id)
                )
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (response.isSuccessful && response.body() != null) {
                        Toast.makeText(
                            requireContext(),
                            "Donation prepared for ${centre.name}. Show the code there.",
                            Toast.LENGTH_LONG
                        ).show()
                        // Reload the screen to show the active batch code view
                        view?.let { loadBasket(it) }
                    } else {
                        button.isEnabled = true
                        Toast.makeText(requireContext(), "Failed to prepare donation. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    button.isEnabled = true
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}