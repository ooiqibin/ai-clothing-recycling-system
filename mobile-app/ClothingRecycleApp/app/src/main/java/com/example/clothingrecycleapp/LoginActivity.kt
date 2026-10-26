package com.example.clothingrecycleapp

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class LoginActivity : AppCompatActivity() {

    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var tvGoToRegister: TextView
    private lateinit var tvLoginStatus: TextView

    private data class LoginError(val message: String, val code: String?, val email: String?)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)
        RetrofitClient.init(this)

        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        tvGoToRegister = findViewById(R.id.tvGoToRegister)
        tvLoginStatus = findViewById(R.id.tvLoginStatus)

        btnLogin.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                showStatus("Please fill in all fields", isError = true)
                return@setOnClickListener
            }

            loginUser(email, password)
        }

        tvGoToRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            finish()
        }
        findViewById<TextView>(R.id.tvForgotPassword).setOnClickListener {
            startActivity(
                Intent(this, ForgotPasswordActivity::class.java)
                    .putExtra(ForgotPasswordActivity.EXTRA_EMAIL, etEmail.text.toString().trim())
            )
        }
    }

    private fun showStatus(message: String, isError: Boolean) {
        tvLoginStatus.setTextColor(
            if (isError) getColor(android.R.color.holo_red_dark) else getColor(R.color.eco_dark_green)
        )
        tvLoginStatus.text = message
    }

    // The backend sends errors as {"error": "...", "code": "...", "email": "..."}.
    private fun parseError(raw: String?): LoginError {
        return try {
            val json = JSONObject(raw ?: "")
            LoginError(
                json.optString("error").ifBlank { "Login failed" },
                json.optString("code").ifBlank { null },
                json.optString("email").ifBlank { null }
            )
        } catch (e: Exception) {
            LoginError("Login failed", null, null)
        }
    }

    private fun loginUser(email: String, password: String) {
        showStatus("Logging in...", isError = false)
        btnLogin.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.loginUser(
                    LoginRequest(email, password)
                )

                // Read the error here, while we are still off the main thread.
                val error = if (response.isSuccessful) null else parseError(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnLogin.isEnabled = true

                    val authData = response.body()

                    if (response.isSuccessful && authData != null) {
                        val prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("token", authData.token)
                            .putString("userId", authData.user.id)
                            .putString("userName", authData.user.name)
                            .putString("role", authData.user.role ?: "user")
                            .putInt("rewardPoints", authData.user.rewardPoints)
                            .apply()

                        showStatus("Welcome, ${authData.user.name}!", isError = false)

                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else if (error?.code == "EMAIL_NOT_VERIFIED") {
                        startActivity(
                            Intent(this@LoginActivity, VerifyEmailActivity::class.java)
                                .putExtra(VerifyEmailActivity.EXTRA_EMAIL, error.email ?: email)
                        )
                        finish()
                    } else {
                        showStatus(error?.message ?: "Login failed", isError = true)
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isFinishing || isDestroyed) return@withContext
                    btnLogin.isEnabled = true
                    showStatus("Error: ${e.message}", isError = true)
                }
            }
        }
    }
}