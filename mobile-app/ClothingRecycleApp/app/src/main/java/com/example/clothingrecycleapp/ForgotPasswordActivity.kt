package com.example.clothingrecycleapp

import android.content.Intent
import android.os.Bundle
import android.os.CountDownTimer
import android.util.Patterns
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class ForgotPasswordActivity : AppCompatActivity() {

    private lateinit var etEmail: EditText
    private lateinit var btnSend: Button
    private lateinit var stepTwo: LinearLayout
    private lateinit var etCode: EditText
    private lateinit var etNewPassword: EditText
    private lateinit var etConfirm: EditText
    private lateinit var btnReset: Button
    private lateinit var tvStatus: TextView
    private lateinit var tvResend: TextView
    private lateinit var tvIntro: TextView

    private var timer: CountDownTimer? = null
    private var sentTo = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_forgot_password)
        RetrofitClient.init(this)

        etEmail = findViewById(R.id.etForgotEmail)
        btnSend = findViewById(R.id.btnSendCode)
        stepTwo = findViewById(R.id.stepTwoContainer)
        etCode = findViewById(R.id.etResetCode)
        etNewPassword = findViewById(R.id.etNewPassword)
        etConfirm = findViewById(R.id.etConfirmPassword)
        btnReset = findViewById(R.id.btnResetPassword)
        tvStatus = findViewById(R.id.tvForgotStatus)
        tvResend = findViewById(R.id.tvResendReset)
        tvIntro = findViewById(R.id.tvForgotIntro)

        etEmail.setText(intent.getStringExtra(EXTRA_EMAIL).orEmpty())

        btnSend.setOnClickListener { sendCode() }
        btnReset.setOnClickListener { resetPassword() }
        tvResend.setOnClickListener { sendCode() }

        findViewById<TextView>(R.id.tvBackToLoginFromForgot).setOnClickListener { goToLogin() }
    }

    override fun onDestroy() {
        timer?.cancel()
        super.onDestroy()
    }

    private fun goToLogin() {
        startActivity(Intent(this, LoginActivity::class.java))
        finish()
    }

    private fun showStatus(message: String, isError: Boolean) {
        tvStatus.setTextColor(
            if (isError) getColor(android.R.color.holo_red_dark) else getColor(R.color.eco_dark_green)
        )
        tvStatus.text = message
    }

    private fun startCooldown(seconds: Int) {
        timer?.cancel()
        tvResend.visibility = View.VISIBLE
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

    // The backend sends errors as {"error": "message"}.
    private fun readErrorMessage(raw: String?): String {
        return try {
            JSONObject(raw ?: "").optString("error").ifBlank { "Something went wrong" }
        } catch (e: Exception) {
            "Something went wrong"
        }
    }

    private fun sendCode() {
        val email = (if (sentTo.isNotEmpty()) sentTo else etEmail.text.toString()).trim()

        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            showStatus("Please enter a valid email address", true)
            return
        }

        showStatus("Sending...", false)
        btnSend.isEnabled = false
        tvResend.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.forgotPassword(ForgotPasswordRequest(email))
                val errorText = if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnSend.isEnabled = true

                    if (response.isSuccessful) {
                        sentTo = email
                        etEmail.isEnabled = false
                        btnSend.visibility = View.GONE
                        stepTwo.visibility = View.VISIBLE
                        tvIntro.text = "Enter the code we sent to $email and choose a new password."
                        showStatus("If an account exists for this email, a code is on its way. Check your spam folder too.", false)
                        startCooldown(60)
                    } else {
                        showStatus(errorText ?: "Could not send the code", true)
                        if (sentTo.isNotEmpty()) tvResend.isEnabled = true
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnSend.isEnabled = true
                    if (sentTo.isNotEmpty()) tvResend.isEnabled = true
                    showStatus("Error: ${e.message}", true)
                }
            }
        }
    }

    private fun resetPassword() {
        val code = etCode.text.toString().trim()
        val newPassword = etNewPassword.text.toString()
        val confirm = etConfirm.text.toString()

        when {
            code.length != 6 || !code.all { it.isDigit() } -> {
                showStatus("Please enter the 6-digit code", true)
                return
            }
            newPassword.length < 9 -> {
                showStatus("The new password needs at least 9 characters", true)
                return
            }
            newPassword != confirm -> {
                showStatus("The two passwords do not match", true)
                return
            }
        }

        showStatus("Changing password...", false)
        btnReset.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.resetPassword(
                    ResetPasswordRequest(sentTo, code, newPassword)
                )
                val errorText = if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnReset.isEnabled = true

                    if (response.isSuccessful) {
                        Toast.makeText(this@ForgotPasswordActivity, "Password changed. Please log in.", Toast.LENGTH_LONG).show()
                        goToLogin()
                    } else {
                        showStatus(errorText ?: "Could not change the password", true)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnReset.isEnabled = true
                    showStatus("Error: ${e.message}", true)
                }
            }
        }
    }

    companion object {
        const val EXTRA_EMAIL = "email"
    }
}