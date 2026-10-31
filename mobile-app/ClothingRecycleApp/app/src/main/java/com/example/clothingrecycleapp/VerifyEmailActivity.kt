package com.example.clothingrecycleapp

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class VerifyEmailActivity : AppCompatActivity() {

    private lateinit var email: String
    private var isNgo = false

    private lateinit var etCode: EditText
    private lateinit var btnVerify: Button
    private lateinit var tvStatus: TextView
    private lateinit var tvResend: TextView

    private var timer: CountDownTimer? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_verify_email)
        RetrofitClient.init(this)

        email = intent.getStringExtra(EXTRA_EMAIL).orEmpty()
        isNgo = intent.getBooleanExtra(EXTRA_IS_NGO, false)

        if (email.isBlank()) {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
            return
        }

        etCode = findViewById(R.id.etEmailCode)
        btnVerify = findViewById(R.id.btnVerifyEmail)
        tvStatus = findViewById(R.id.tvEmailStatus)
        tvResend = findViewById(R.id.tvResendCode)

        findViewById<TextView>(R.id.tvVerifyIntro).text =
            "We sent a 6-digit code to\n$email\n\nEnter it below. It expires in 10 minutes." +
                    (if (isNgo) "\n\nAfter this, an admin will review your NGO application." else "")

        btnVerify.setOnClickListener { verify() }
        tvResend.setOnClickListener { resend() }

        findViewById<TextView>(R.id.tvBackToLogin).setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }

        // A code was just sent, so wait a minute before offering another.
        startCooldown(60)
    }

    override fun onDestroy() {
        timer?.cancel()
        super.onDestroy()
    }

    private fun showStatus(message: String, isError: Boolean) {
        tvStatus.setTextColor(
            if (isError) getColor(android.R.color.holo_red_dark) else getColor(R.color.eco_dark_green)
        )
        tvStatus.text = message
    }

    private fun startCooldown(seconds: Int) {
        timer?.cancel()
        tvResend.isEnabled = false

        timer = object : CountDownTimer(seconds * 1000L, 1000L) {
            override fun onTick(millisUntilFinished: Long) {
                tvResend.text = "Resend code in ${millisUntilFinished / 1000 + 1}s"
            }

            override fun onFinish() {
                tvResend.text = "Resend code"
                tvResend.isEnabled = true
            }
        }.start()
    }

    private fun verify() {
        val code = etCode.text.toString().trim()

        if (code.length != 6 || !code.all { it.isDigit() }) {
            showStatus("Please enter the 6-digit code", true)
            return
        }

        showStatus("Verifying...", false)
        btnVerify.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.verifyEmail(
                    VerifyEmailRequest(email, code))
                val errorText = if (response.isSuccessful) null else readErrorMessage(
                    response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnVerify.isEnabled = true

                    val body = response.body()
                    if (response.isSuccessful && body != null) {
                        getSharedPreferences("app_prefs", Context.MODE_PRIVATE).edit()
                            .putString("token", body.token)
                            .putString("userId", body.user.id)
                            .putString("userName", body.user.name)
                            .putString("role", body.user.role ?: "user")
                            .putInt("rewardPoints", body.user.rewardPoints)
                            .apply()

                        startActivity(
                            Intent(this@VerifyEmailActivity, MainActivity::class.java)
                                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                        )
                        finish()
                    } else {
                        showStatus(errorText ?: "Could not verify", true)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnVerify.isEnabled = true
                    showStatus("Error: ${e.message}", true)
                }
            }
        }
    }

    private fun resend() {
        tvResend.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.resendCode(
                    ResendCodeRequest(email))
                val errorText = if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext

                    if (response.isSuccessful) {
                        Toast.makeText(this@VerifyEmailActivity, "A new code is on its way", Toast.LENGTH_SHORT).show()
                        showStatus("", false)
                        startCooldown(60)
                    } else {
                        showStatus(errorText ?: "Could not send a new code", true)
                        startCooldown(30)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    showStatus("Error: ${e.message}", true)
                    tvResend.isEnabled = true
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

    companion object {
        const val EXTRA_EMAIL = "email"
        const val EXTRA_IS_NGO = "is_ngo"
    }
}