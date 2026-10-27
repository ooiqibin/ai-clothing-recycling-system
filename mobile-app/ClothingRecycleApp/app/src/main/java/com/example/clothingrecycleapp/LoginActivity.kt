package com.example.clothingrecycleapp

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class LoginActivity : AppCompatActivity() {

    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var btnGoogleLogin: Button
    private lateinit var tvGoToRegister: TextView
    private lateinit var tvLoginStatus: TextView

    private data class LoginError(
        val message: String,
        val code: String?,
        val email: String?
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        RetrofitClient.init(this)

        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnLogin = findViewById(R.id.btnLogin)
        btnGoogleLogin = findViewById(R.id.btnGoogleLogin)
        tvGoToRegister = findViewById(R.id.tvGoToRegister)
        tvLoginStatus = findViewById(R.id.tvLoginStatus)

        // Normal email/password login
        btnLogin.setOnClickListener {
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (email.isEmpty() || password.isEmpty()) {
                showStatus("Please fill in all fields", isError = true)
                return@setOnClickListener
            }

            loginUser(email, password)
        }

        // Google login
        btnGoogleLogin.setOnClickListener {
            signInWithGoogle()
        }

        // Navigate to registration
        tvGoToRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            finish()
        }

        // Navigate to forgot password
        findViewById<TextView>(R.id.tvForgotPassword)
            .setOnClickListener {
                startActivity(
                    Intent(this, ForgotPasswordActivity::class.java)
                        .putExtra(
                            ForgotPasswordActivity.EXTRA_EMAIL,
                            etEmail.text.toString().trim()
                        )
                )
            }
    }

    private fun showStatus(message: String, isError: Boolean) {
        tvLoginStatus.setTextColor(
            if (isError) {
                getColor(android.R.color.holo_red_dark)
            } else {
                getColor(R.color.eco_dark_green)
            }
        )

        tvLoginStatus.text = message
    }

    // The backend sends errors as:
    // {"error": "...", "code": "...", "email": "..."}
    private fun parseError(raw: String?): LoginError {
        return try {
            val json = JSONObject(raw ?: "")

            LoginError(
                message = json.optString("error")
                    .ifBlank { "Login failed" },
                code = json.optString("code")
                    .ifBlank { null },
                email = json.optString("email")
                    .ifBlank { null }
            )
        } catch (e: Exception) {
            LoginError("Login failed", null, null)
        }
    }

    private fun loginUser(email: String, password: String) {
        showStatus("Logging in...", isError = false)
        btnLogin.isEnabled = false

        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.apiService.loginUser(
                        LoginRequest(email, password)
                    )
                }

                val error = if (response.isSuccessful) {
                    null
                } else {
                    withContext(Dispatchers.IO) {
                        parseError(response.errorBody()?.string())
                    }
                }

                if (isFinishing || isDestroyed) return@launch

                btnLogin.isEnabled = true

                val authData = response.body()

                if (response.isSuccessful && authData != null) {
                    saveLoginSession(
                        authData.token,
                        authData.user.id,
                        authData.user.name,
                        authData.user.role ?: "user",
                        authData.user.rewardPoints
                    )

                    showStatus(
                        "Welcome, ${authData.user.name}!",
                        isError = false
                    )

                    startActivity(
                        Intent(this@LoginActivity, MainActivity::class.java)
                    )
                    finish()

                } else if (error?.code == "EMAIL_NOT_VERIFIED") {
                    startActivity(
                        Intent(
                            this@LoginActivity,
                            VerifyEmailActivity::class.java
                        ).putExtra(
                            VerifyEmailActivity.EXTRA_EMAIL,
                            error.email ?: email
                        )
                    )
                    finish()

                } else {
                    showStatus(
                        error?.message ?: "Login failed",
                        isError = true
                    )
                }

            } catch (e: Exception) {
                if (isFinishing || isDestroyed) return@launch

                btnLogin.isEnabled = true
                showStatus(
                    "Error: ${e.message ?: "Please try again."}",
                    isError = true
                )
            }
        }
    }

    private fun signInWithGoogle() {
        btnGoogleLogin.isEnabled = false
        btnLogin.isEnabled = false

        showStatus("Connecting to Google...", isError = false)

        lifecycleScope.launch {
            try {
                val idToken = GoogleSignInHelper(this@LoginActivity)
                    .getGoogleIdToken(
                        getString(R.string.default_web_client_id)
                    )

                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.apiService.googleAuth(
                        GoogleAuthRequest(idToken)
                    )
                }

                if (isFinishing || isDestroyed) return@launch

                val authData = response.body()

                if (response.isSuccessful && authData != null) {
                    saveLoginSession(
                        authData.token,
                        authData.user.id,
                        authData.user.name,
                        authData.user.role ?: "user",
                        authData.user.rewardPoints
                    )

                    showStatus(
                        "Welcome, ${authData.user.name}!",
                        isError = false
                    )

                    startActivity(
                        Intent(this@LoginActivity, MainActivity::class.java)
                    )
                    finish()

                } else {
                    val error = withContext(Dispatchers.IO) {
                        parseError(response.errorBody()?.string())
                    }

                    showStatus(error.message, isError = true)
                }

            } catch (e: Exception) {
                if (isFinishing || isDestroyed) return@launch

                showStatus(
                    "Google sign-in failed: " +
                            (e.message ?: "Please try again."),
                    isError = true
                )

            } finally {
                if (!isFinishing && !isDestroyed) {
                    btnGoogleLogin.isEnabled = true
                    btnLogin.isEnabled = true
                }
            }
        }
    }

    private fun saveLoginSession(
        token: String,
        userId: String,
        userName: String,
        role: String,
        rewardPoints: Int
    ) {
        val prefs = getSharedPreferences(
            "app_prefs",
            Context.MODE_PRIVATE
        )

        prefs.edit()
            .putString("token", token)
            .putString("userId", userId)
            .putString("userName", userName)
            .putString("role", role)
            .putInt("rewardPoints", rewardPoints)
            .apply()
    }
}
