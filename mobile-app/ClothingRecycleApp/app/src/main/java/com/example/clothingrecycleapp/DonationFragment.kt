package com.example.clothingrecycleapp

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import coil.load
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.zxing.BarcodeFormat
import com.journeyapps.barcodescanner.BarcodeEncoder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import kotlin.math.roundToInt

private data class CentreOption(val centre: DonationCentreItem, val metres: Float?)

class DonateFragment : Fragment(R.layout.fragment_donate) {

    private val selectedIds = mutableSetOf<String>()
    private var selectedPointsTotal = 0

    // Remembers which button asked for permission, so we can carry on after the answer.
    private var pendingButton: Button? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        // Carry on whether or not they said yes. Without location we just skip the distances.
        pendingButton?.let { startPrepare(it) }
        pendingButton = null
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadBasket(view)
    }

    // ---------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun label(text: String, size: Float, colorRes: Int, bold: Boolean = false): TextView =
        TextView(requireContext()).apply {
            this.text = text
            textSize = size
            setTextColor(ContextCompat.getColor(requireContext(), colorRes))
            if (bold) setTypeface(null, Typeface.BOLD)
        }

    private fun formatDistance(metres: Float): String =
        if (metres < 1000f) "${metres.roundToInt()} m"
        else String.format(Locale.US, "%.1f km", metres / 1000f)

    // Makes the Prepare Donation button look like a real button.
    private fun styleActionButton(button: Button) {
        button.setBackgroundResource(R.drawable.bg_button_primary)
        button.backgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
        button.setTextColor(ContextCompat.getColor(requireContext(), R.color.eco_dark_green))
        button.isAllCaps = false
        button.setTypeface(null, Typeface.BOLD)
        button.textSize = 15f
        button.minHeight = dp(52)
        button.setPadding(dp(16), dp(12), dp(16), dp(12))
        button.alpha = if (button.isEnabled) 1f else 0.5f
    }

    private fun setBusy(button: Button, busy: Boolean) {
        button.isEnabled = !busy
        button.alpha = if (busy) 0.5f else 1f
    }

    private fun hasLocationPermission(): Boolean {
        val ctx = requireContext()
        return ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED
    }

    // ---------------------------------------------------------------
    // The basket
    // ---------------------------------------------------------------

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
                    if (!isAdded) return@withContext

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
                            tvActiveBatchInfo.text =
                                "${body.activeBatch.items.size} items • +${body.activeBatch.totalPoints} pts once verified$centreLine"

                        } else if (body.pendingItems.isEmpty()) {
                            tvEmptyBasket.visibility = View.VISIBLE
                            btnPrepareDonation.visibility = View.GONE

                        } else {
                            selectedIds.clear()
                            selectedPointsTotal = 0

                            btnPrepareDonation.visibility = View.VISIBLE
                            btnPrepareDonation.isEnabled = true
                            btnPrepareDonation.text = "Prepare Donation"
                            styleActionButton(btnPrepareDonation)

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
                                    btnPrepareDonation.text =
                                        if (selectedIds.isEmpty()) "Prepare Donation"
                                        else "Prepare Donation (${selectedIds.size} selected, +$selectedPointsTotal pts)"
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
                    if (isAdded) {
                        Toast.makeText(requireContext(), "Failed to load basket: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }
        }
    }

    private fun createQrBitmap(content: String, size: Int = 700): Bitmap {
        return BarcodeEncoder().encodeBitmap(content, BarcodeFormat.QR_CODE, size, size)
    }

    // ---------------------------------------------------------------
    // Choosing where to hand in the donation
    // ---------------------------------------------------------------

    private fun prepareDonation(button: Button) {
        if (selectedIds.isEmpty()) {
            Toast.makeText(requireContext(), "Select at least one item first", Toast.LENGTH_SHORT).show()
            return
        }

        setBusy(button, true)

        if (hasLocationPermission()) {
            startPrepare(button)
        } else {
            pendingButton = button
            permissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        }
    }

    private fun startPrepare(button: Button) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getDonationCentres()
                val centres = if (response.isSuccessful) response.body()?.centers.orEmpty() else emptyList()

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (centres.isEmpty()) {
                        setBusy(button, false)
                        Toast.makeText(requireContext(), "No donation centres are available yet", Toast.LENGTH_LONG).show()
                    } else {
                        findLocation { location ->
                            if (isAdded) showCentreChooser(centres, location, button)
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    setBusy(button, false)
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // Uses the last known location, or waits up to 6 seconds for a fresh one.
    @SuppressLint("MissingPermission")
    private fun findLocation(onResult: (Location?) -> Unit) {
        if (!hasLocationPermission()) {
            onResult(null)
            return
        }

        val manager = requireContext().getSystemService(Context.LOCATION_SERVICE) as LocationManager

        val last = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        ).mapNotNull { provider ->
            try {
                manager.getLastKnownLocation(provider)
            } catch (e: Exception) {
                null
            }
        }.maxByOrNull { it.time }

        if (last != null) {
            onResult(last)
            return
        }

        val provider = listOf(LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER).firstOrNull {
            try {
                manager.isProviderEnabled(it)
            } catch (e: Exception) {
                false
            }
        }

        if (provider == null) {
            onResult(null)
            return
        }

        val handler = Handler(Looper.getMainLooper())
        var finished = false

        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                if (finished) return
                finished = true
                handler.removeCallbacksAndMessages(null)
                manager.removeUpdates(this)
                onResult(location)
            }

            // Older Android versions need these three, even though they do nothing here.
            @Deprecated("Deprecated in Java")
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

            override fun onProviderEnabled(provider: String) {}

            override fun onProviderDisabled(provider: String) {}
        }

        manager.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())

        handler.postDelayed({
            if (!finished) {
                finished = true
                manager.removeUpdates(listener)
                onResult(null)
            }
        }, 6000)
    }

    private fun showCentreChooser(centres: List<DonationCentreItem>, location: Location?, button: Button) {
        val ctx = requireContext()

        val options = centres.map { c ->
            val lat = c.latitude
            val lon = c.longitude
            val metres = if (location != null && lat != null && lon != null) {
                val result = FloatArray(1)
                Location.distanceBetween(location.latitude, location.longitude, lat, lon, result)
                result[0]
            } else {
                null
            }
            CentreOption(c, metres)
        }.sortedWith(
            compareBy<CentreOption> { it.metres == null }
                .thenBy { it.metres ?: 0f }
                .thenBy { it.centre.name.lowercase() }
        )

        var chosen = false
        val dialog = BottomSheetDialog(ctx)

        val column = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(24))
        }

        column.addView(label("Where will you hand in your donation?", 18f, R.color.eco_dark_green, bold = true))
        column.addView(
            label(
                if (location != null) "Sorted by distance from you (straight line)"
                else "Turn on location to see which centre is nearest",
                12f,
                R.color.eco_text_gray
            ).apply { setPadding(0, dp(4), 0, dp(4)) }
        )

        options.forEachIndexed { index, option ->
            val card = centreCard(option, isNearest = index == 0 && option.metres != null)
            card.setOnClickListener {
                confirmCentre(option) {
                    chosen = true
                    dialog.dismiss()
                    submitBatch(option.centre, button)
                }
            }
            column.addView(card)
        }

        dialog.setContentView(ScrollView(ctx).apply { addView(column) })
        dialog.setOnShowListener { dialog.behavior.state = BottomSheetBehavior.STATE_EXPANDED }
        dialog.setOnDismissListener { if (!chosen) setBusy(button, false) }
        dialog.show()
    }

    private fun centreCard(option: CentreOption, isNearest: Boolean): LinearLayout {
        val ctx = requireContext()
        val c = option.centre

        return LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundResource(R.drawable.bg_card)
            setPadding(dp(16), dp(14), dp(16), dp(14))
            elevation = dp(2).toFloat()
            isClickable = true
            isFocusable = true
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(12) }

            if (isNearest) {
                addView(label("★ Nearest to you", 11f, R.color.eco_primary_green, bold = true))
            }

            val header = LinearLayout(ctx).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
            }
            header.addView(
                label(c.name, 16f, R.color.eco_text_dark, bold = true).apply {
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
            )
            option.metres?.let {
                header.addView(label(formatDistance(it), 14f, R.color.eco_dark_green, bold = true))
            }
            addView(header)

            c.address?.takeIf { it.isNotBlank() }?.let {
                addView(label(it, 12f, R.color.eco_text_gray).apply { setPadding(0, dp(4), 0, 0) })
            }
            c.openingHours?.takeIf { it.isNotBlank() }?.let {
                addView(label("Open: $it", 11f, R.color.eco_text_gray).apply { setPadding(0, dp(2), 0, 0) })
            }
            c.phone?.takeIf { it.isNotBlank() }?.let {
                addView(label("Tel: $it", 11f, R.color.eco_text_gray).apply { setPadding(0, dp(2), 0, 0) })
            }

            addView(label("Tap to choose", 11f, R.color.eco_primary_green, bold = true).apply {
                setPadding(0, dp(8), 0, 0)
            })
        }
    }

    private fun confirmCentre(option: CentreOption, onConfirm: () -> Unit) {
        val c = option.centre
        val details = listOfNotNull(
            c.address?.takeIf { it.isNotBlank() },
            option.metres?.let { "${formatDistance(it)} away" }
        ).joinToString("\n")

        AlertDialog.Builder(requireContext())
            .setTitle("Hand in at ${c.name}?")
            .setMessage(
                (if (details.isNotEmpty()) "$details\n\n" else "") +
                        "Your donation code will only work at this centre."
            )
            .setPositiveButton("Confirm") { _, _ -> onConfirm() }
            .setNegativeButton("Back", null)
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
                        setBusy(button, false)
                        Toast.makeText(requireContext(), "Failed to prepare donation. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    setBusy(button, false)
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}