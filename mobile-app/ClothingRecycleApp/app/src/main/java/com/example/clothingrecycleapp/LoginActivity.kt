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

class LoginActivity : AppCompatActivity() {

    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnLogin: Button
    private lateinit var tvGoToRegister: TextView
    private lateinit var tvLoginStatus: TextView

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
                tvLoginStatus.text = "Please fill in all fields"
                return@setOnClickListener
            }

            loginUser(email, password)
        }

        tvGoToRegister.setOnClickListener {
            startActivity(Intent(this, RegisterActivity::class.java))
            finish()
        }
    }

    private fun loginUser(email: String, password: String) {
        tvLoginStatus.text = "Logging in..."

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.loginUser(
                    LoginRequest(email, password)
                )

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val authData = response.body()!!

                        val prefs = getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
                        prefs.edit()
                            .putString("token", authData.token)
                            .putString("userId", authData.user.id)
                            .putString("userName", authData.user.name)
                            .putInt("rewardPoints", authData.user.rewardPoints)
                            .apply()

                        tvLoginStatus.text = "Welcome, ${authData.user.name}!"

                        startActivity(Intent(this@LoginActivity, MainActivity::class.java))
                        finish()
                    } else {
                        tvLoginStatus.text = "Login failed: ${response.errorBody()?.string()}"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    tvLoginStatus.text = "Error: ${e.message}"
                }
            }
        }
    }
}