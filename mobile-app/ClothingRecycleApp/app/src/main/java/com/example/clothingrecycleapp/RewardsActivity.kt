package com.example.clothingrecycleapp

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.google.zxing.BarcodeFormat
import com.journeyapps.barcodescanner.BarcodeEncoder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class RewardsActivity : AppCompatActivity() {

    private lateinit var tvPoints: TextView
    private lateinit var tvEmpty: TextView
    private lateinit var container: LinearLayout
    private lateinit var chipCatalog: TextView
    private lateinit var chipCoupons: TextView

    private var currentPoints = 0
    private var showing = TAB_CATALOG

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_rewards)
        RetrofitClient.init(this)

        tvPoints = findViewById(R.id.tvRewardsPoints)
        tvEmpty = findViewById(R.id.tvEmpty)
        container = findViewById(R.id.listContainer)
        chipCatalog = findViewById(R.id.chipCatalog)
        chipCoupons = findViewById(R.id.chipCoupons)

        findViewById<TextView>(R.id.tvBack).setOnClickListener { finish() }
        chipCatalog.setOnClickListener { selectTab(TAB_CATALOG) }
        chipCoupons.setOnClickListener { selectTab(TAB_COUPONS) }

        val prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        updatePoints(prefs.getInt("rewardPoints", 0))

        selectTab(intent.getStringExtra(EXTRA_TAB) ?: TAB_CATALOG)
    }

    // ---------------------------------------------------------------
    // Small helpers
    // ---------------------------------------------------------------

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun cardParams(): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(10) }

    private fun newCard(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundResource(R.drawable.bg_card)
        setPadding(dp(16), dp(16), dp(16), dp(16))
        elevation = dp(1).toFloat()
        layoutParams = cardParams()
    }

    private fun label(text: String, size: Float, color: Int, bold: Boolean = false): TextView =
        TextView(this).apply {
            this.text = text
            textSize = size
            setTextColor(color)
            if (bold) setTypeface(null, Typeface.BOLD)
        }

    private fun primaryButton(text: String, enabled: Boolean): Button =
        Button(this).apply {
            this.text = text
            isAllCaps = false
            setTypeface(null, Typeface.BOLD)
            setTextColor(getColor(R.color.eco_white))
            setBackgroundResource(R.drawable.bg_button_primary)
            isEnabled = enabled
            alpha = if (enabled) 1f else 0.5f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(48)
            ).apply { topMargin = dp(12) }
        }

    private fun updatePoints(points: Int) {
        currentPoints = points
        tvPoints.text = "$points pts"
        getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
            .edit().putInt("rewardPoints", points).apply()
    }

    private fun showMessage(message: String) {
        container.removeAllViews()
        tvEmpty.text = message
        tvEmpty.visibility = View.VISIBLE
    }

    private fun gone(): Boolean = isFinishing || isDestroyed

    // The backend sends errors as {"error": "message"}.
    private fun readErrorMessage(raw: String?): String {
        return try {
            JSONObject(raw ?: "").optString("error").ifBlank { "Something went wrong" }
        } catch (e: Exception) {
            "Something went wrong"
        }
    }

    private fun selectTab(tab: String) {
        showing = tab

        val selected = if (tab == TAB_CATALOG) chipCatalog else chipCoupons
        val other = if (tab == TAB_CATALOG) chipCoupons else chipCatalog

        selected.setBackgroundResource(R.drawable.bg_button_primary)
        selected.setTextColor(getColor(R.color.eco_white))
        other.setBackgroundResource(R.drawable.bg_card)
        other.setTextColor(getColor(R.color.eco_text_dark))

        container.removeAllViews()
        tvEmpty.visibility = View.GONE

        if (tab == TAB_CATALOG) loadCatalog() else loadCoupons()
    }

    // ---------------------------------------------------------------
    // Rewards catalog
    // ---------------------------------------------------------------

    private fun loadCatalog() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val me = RetrofitClient.apiService.getMe()
                val rewards = RetrofitClient.apiService.getRewards()

                withContext(Dispatchers.Main) {
                    if (gone() || showing != TAB_CATALOG) return@withContext

                    me.body()?.user?.let { updatePoints(it.rewardPoints) }

                    val list = if (rewards.isSuccessful) rewards.body()?.rewards else null
                    when {
                        list == null -> showMessage("Could not load rewards. Please try again.")
                        list.isEmpty() -> showMessage("No rewards available yet. Check back soon!")
                        else -> showRewards(list)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!gone() && showing == TAB_CATALOG) showMessage("Error: ${e.message}")
                }
            }
        }
    }

    private fun showRewards(rewards: List<RewardItem>) {
        container.removeAllViews()
        tvEmpty.visibility = View.GONE

        rewards.forEach { reward ->
            val card = newCard()

            val header = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
            header.addView(
                label(reward.title, 16f, getColor(R.color.eco_text_dark), bold = true).apply {
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
            )
            header.addView(
                label("${reward.pointsCost} pts", 14f, getColor(R.color.eco_dark_green), bold = true)
            )
            card.addView(header)

            reward.partnerName?.takeIf { it.isNotBlank() }?.let {
                card.addView(label(it, 12f, getColor(R.color.eco_text_gray)))
            }
            reward.description?.takeIf { it.isNotBlank() }?.let {
                card.addView(label(it, 13f, getColor(R.color.eco_text_dark)).apply {
                    setPadding(0, dp(6), 0, 0)
                })
            }

            val facts = mutableListOf<String>()
            reward.stock?.let { facts.add("$it left") }
            reward.perUserLimit?.let { facts.add("Limit $it per person") }
            facts.add("Valid ${reward.validDays} days after redeeming")
            card.addView(label(facts.joinToString(" • "), 11f, getColor(R.color.eco_text_gray)).apply {
                setPadding(0, dp(8), 0, 0)
            })

            val limitReached = reward.perUserLimit != null && reward.redeemedByMe >= reward.perUserLimit
            val missing = reward.pointsCost - currentPoints

            val button = when {
                reward.soldOut -> primaryButton("Sold out", false)
                limitReached -> primaryButton("Already redeemed", false)
                missing > 0 -> primaryButton("Need $missing more pts", false)
                else -> primaryButton("Redeem for ${reward.pointsCost} pts", true)
            }
            button.setOnClickListener { confirmRedeem(reward, button) }
            card.addView(button)

            container.addView(card)
        }
    }

    private fun confirmRedeem(reward: RewardItem, button: Button) {
        AlertDialog.Builder(this)
            .setTitle("Redeem this reward?")
            .setMessage(
                "${reward.title}\n\nThis uses ${reward.pointsCost} points. " +
                        "Your coupon will be valid for ${reward.validDays} days."
            )
            .setPositiveButton("Redeem") { _, _ -> redeem(reward, button) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun redeem(reward: RewardItem, button: Button) {
        button.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.redeemReward(reward.id)
                val errorText =
                    if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (gone()) return@withContext

                    val body = response.body()
                    if (response.isSuccessful && body != null) {
                        updatePoints(body.totalRewardPoints)
                        Toast.makeText(this@RewardsActivity, "Coupon ready! Find it in My coupons.", Toast.LENGTH_LONG).show()
                        selectTab(TAB_COUPONS)
                    } else {
                        Toast.makeText(this@RewardsActivity, errorText ?: "Could not redeem", Toast.LENGTH_LONG).show()
                        // Stock or points may have changed, so refresh the list.
                        if (showing == TAB_CATALOG) loadCatalog()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (gone()) return@withContext
                    button.isEnabled = true
                    Toast.makeText(this@RewardsActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    // ---------------------------------------------------------------
    // My coupons
    // ---------------------------------------------------------------

    private fun loadCoupons() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getMyCoupons()
                val list = if (response.isSuccessful) response.body()?.coupons else null

                withContext(Dispatchers.Main) {
                    if (gone() || showing != TAB_COUPONS) return@withContext

                    when {
                        list == null -> showMessage("Could not load your coupons. Please try again.")
                        list.isEmpty() -> showMessage("You have no coupons yet. Redeem a reward to get one!")
                        else -> showCoupons(list)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!gone() && showing == TAB_COUPONS) showMessage("Error: ${e.message}")
                }
            }
        }
    }

    private fun showCoupons(coupons: List<CouponItem>) {
        container.removeAllViews()
        tvEmpty.visibility = View.GONE

        coupons.forEach { coupon ->
            val card = newCard()
            val isActive = coupon.status == "active"

            card.addView(label(coupon.rewardTitle, 16f, getColor(R.color.eco_text_dark), bold = true))
            coupon.partnerName?.takeIf { it.isNotBlank() }?.let {
                card.addView(label(it, 12f, getColor(R.color.eco_text_gray)))
            }

            val (statusText, statusColor) = when (coupon.status) {
                "active" -> "Active" to getColor(R.color.eco_dark_green)
                "used" -> "Used" to getColor(R.color.eco_text_gray)
                "expired" -> "Expired" to Color.parseColor("#8A5A00")
                else -> "Cancelled" to Color.parseColor("#B3261E")
            }
            card.addView(label(statusText, 12f, statusColor, bold = true).apply {
                setPadding(0, dp(4), 0, dp(8))
            })

            if (isActive) {
                card.addView(
                    label(coupon.code, 28f, getColor(R.color.eco_dark_green), bold = true).apply {
                        gravity = Gravity.CENTER_HORIZONTAL
                        letterSpacing = 0.15f
                        layoutParams = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        )
                    }
                )

                card.addView(ImageView(this).apply {
                    setImageBitmap(createQrBitmap(coupon.code))
                    contentDescription = "Coupon QR code"
                    layoutParams = LinearLayout.LayoutParams(dp(180), dp(180)).apply {
                        gravity = Gravity.CENTER_HORIZONTAL
                        topMargin = dp(8)
                    }
                })
            } else {
                card.addView(label("Code: ${coupon.code}", 13f, getColor(R.color.eco_text_gray)))
            }

            val dateLine = when (coupon.status) {
                "active" -> "Valid until ${coupon.expiresAt?.take(10) ?: "-"}"
                "used" -> "Used on ${coupon.usedAt?.take(10) ?: "-"}"
                "expired" -> "Expired on ${coupon.expiresAt?.take(10) ?: "-"}"
                else -> "Cancelled. Your points were returned."
            }
            card.addView(label(dateLine, 12f, getColor(R.color.eco_text_gray)).apply {
                setPadding(0, dp(8), 0, 0)
            })

            coupon.terms?.takeIf { it.isNotBlank() }?.let {
                card.addView(label("Terms: $it", 11f, getColor(R.color.eco_text_gray)).apply {
                    setPadding(0, dp(4), 0, 0)
                })
            }

            if (isActive) {
                val button = primaryButton("Use now", true)
                button.setOnClickListener { confirmUse(coupon, button) }
                card.addView(button)
            }

            container.addView(card)
        }
    }

    private fun createQrBitmap(content: String, size: Int = 600): Bitmap =
        BarcodeEncoder().encodeBitmap(content, BarcodeFormat.QR_CODE, size, size)

    private fun confirmUse(coupon: CouponItem, button: Button) {
        val where = coupon.partnerName?.takeIf { it.isNotBlank() } ?: "the shop"

        AlertDialog.Builder(this)
            .setTitle("Use this coupon now?")
            .setMessage(
                "Only tap Use now when you are with the staff at $where. " +
                        "After this the coupon cannot be used again."
            )
            .setPositiveButton("Use now") { _, _ -> useCoupon(coupon, button) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun useCoupon(coupon: CouponItem, button: Button) {
        button.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.useCoupon(coupon.id)
                val errorText =
                    if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (gone()) return@withContext

                    if (response.isSuccessful) {
                        Toast.makeText(this@RewardsActivity, "Coupon used. Enjoy!", Toast.LENGTH_LONG).show()
                    } else {
                        Toast.makeText(this@RewardsActivity, errorText ?: "Could not use the coupon", Toast.LENGTH_LONG).show()
                    }
                    if (showing == TAB_COUPONS) loadCoupons()
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (gone()) return@withContext
                    button.isEnabled = true
                    Toast.makeText(this@RewardsActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    companion object {
        const val EXTRA_TAB = "tab"
        const val TAB_CATALOG = "catalog"
        const val TAB_COUPONS = "coupons"
    }
}