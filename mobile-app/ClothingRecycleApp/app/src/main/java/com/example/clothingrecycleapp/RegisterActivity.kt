package com.example.clothingrecycleapp

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

class RegisterActivity : AppCompatActivity() {

    private lateinit var etName: EditText
    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnRegister: Button
    private lateinit var tvGoToLogin: TextView
    private lateinit var tvRegisterStatus: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_register)
        RetrofitClient.init(this)

        etName = findViewById(R.id.etName)
        etEmail = findViewById(R.id.etEmail)
        etPassword = findViewById(R.id.etPassword)
        btnRegister = findViewById(R.id.btnRegister)
        tvGoToLogin = findViewById(R.id.tvGoToLogin)
        tvRegisterStatus = findViewById(R.id.tvRegisterStatus)

        btnRegister.setOnClickListener {
            val name = etName.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
                tvRegisterStatus.text = "Please fill in all fields"
                return@setOnClickListener
            }

            registerUser(name, email, password)
        }

        tvGoToLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun registerUser(name: String, email: String, password: String) {
        tvRegisterStatus.text = "Registering..."

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.registerUser(
                    RegisterRequest(name, email, password)
                )

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        tvRegisterStatus.text = "Registration successful! Redirecting to login..."
                        startActivity(Intent(this@RegisterActivity, LoginActivity::class.java))
                        finish()
                    } else {
                        tvRegisterStatus.text = "Registration failed: ${response.errorBody()?.string()}"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    tvRegisterStatus.text = "Error: ${e.message}"
                }
            }
        }
    }
}