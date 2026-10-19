package com.example.clothingrecycleapp

import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class RegisterActivity : AppCompatActivity() {

    private lateinit var etName: EditText
    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnRegister: Button
    private lateinit var tvGoToLogin: TextView
    private lateinit var tvRegisterStatus: TextView
    private lateinit var tvNameLabel: TextView

    private lateinit var cbRegisterAsNgo: CheckBox
    private lateinit var ngoFieldsContainer: LinearLayout
    private lateinit var etOrgName: EditText
    private lateinit var etRegNumber: EditText
    private lateinit var etOrgPhone: EditText
    private lateinit var etOrgAddress: EditText
    private lateinit var etOrgAbout: EditText

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
        tvNameLabel = findViewById(R.id.tvNameLabel)

        cbRegisterAsNgo = findViewById(R.id.cbRegisterAsNgo)
        ngoFieldsContainer = findViewById(R.id.ngoFieldsContainer)
        etOrgName = findViewById(R.id.etOrgName)
        etRegNumber = findViewById(R.id.etRegNumber)
        etOrgPhone = findViewById(R.id.etOrgPhone)
        etOrgAddress = findViewById(R.id.etOrgAddress)
        etOrgAbout = findViewById(R.id.etOrgAbout)

        cbRegisterAsNgo.setOnCheckedChangeListener { _, isChecked ->
            ngoFieldsContainer.visibility = if (isChecked) View.VISIBLE else View.GONE
            tvNameLabel.text = if (isChecked) "Contact Person Name" else "Full Name"
            btnRegister.text = if (isChecked) "Submit NGO Application  →" else "Join EcoThread  →"
            tvRegisterStatus.text = ""
        }

        btnRegister.setOnClickListener {
            val name = etName.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
                tvRegisterStatus.text = "Please fill in all fields"
                return@setOnClickListener
            }

            if (!cbRegisterAsNgo.isChecked) {
                registerUser(name, email, password)
                return@setOnClickListener
            }

            // NGO application: check the extra details first.
            val organisationName = etOrgName.text.toString().trim()
            val registrationNumber = etRegNumber.text.toString().trim()
            val contactPhone = etOrgPhone.text.toString().trim()
            val address = etOrgAddress.text.toString().trim()
            val about = etOrgAbout.text.toString().trim()

            when {
                organisationName.isEmpty() || registrationNumber.isEmpty() ||
                        contactPhone.isEmpty() || address.isEmpty() ->
                    tvRegisterStatus.text =
                        "Please fill in the organisation name, registration number, phone and address"

                !Patterns.EMAIL_ADDRESS.matcher(email).matches() ->
                    tvRegisterStatus.text = "Please enter a valid email address"

                password.length < 6 ->
                    tvRegisterStatus.text = "Password must be at least 6 characters"

                else -> registerNgo(
                    RegisterNgoRequest(
                        name = name,
                        email = email,
                        password = password,
                        organisationName = organisationName,
                        registrationNumber = registrationNumber,
                        contactPhone = contactPhone,
                        address = address,
                        about = about
                    )
                )
            }
        }

        tvGoToLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun registerUser(name: String, email: String, password: String) {
        tvRegisterStatus.text = "Registering..."
        btnRegister.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.registerUser(
                    RegisterRequest(name, email, password)
                )

                // Read the error here, while we are still off the main thread.
                val errorText =
                    if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    btnRegister.isEnabled = true

                    if (response.isSuccessful && response.body() != null) {
                        tvRegisterStatus.text = "Registration successful! Redirecting to login..."
                        startActivity(Intent(this@RegisterActivity, LoginActivity::class.java))
                        finish()
                    } else {
                        tvRegisterStatus.text = "Registration failed: $errorText"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    btnRegister.isEnabled = true
                    tvRegisterStatus.text = "Error: ${e.message}"
                }
            }
        }
    }

    private fun registerNgo(request: RegisterNgoRequest) {
        tvRegisterStatus.text = "Submitting application..."
        btnRegister.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.registerNgo(request)

                val errorText =
                    if (response.isSuccessful) null else readErrorMessage(response.errorBody()?.string())

                withContext(Dispatchers.Main) {
                    btnRegister.isEnabled = true

                    if (response.isSuccessful && response.body() != null) {
                        tvRegisterStatus.text = ""
                        showApplicationSubmittedDialog()
                    } else {
                        tvRegisterStatus.text = "Application failed: $errorText"
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    btnRegister.isEnabled = true
                    tvRegisterStatus.text = "Error: ${e.message}"
                }
            }
        }
    }

    private fun showApplicationSubmittedDialog() {
        AlertDialog.Builder(this)
            .setTitle("Application submitted")
            .setMessage(
                "Thank you! An admin will review your organisation's details.\n\n" +
                        "You can log in now. NGO features, such as verifying donations, " +
                        "unlock once your application is approved."
            )
            .setCancelable(false)
            .setPositiveButton("Go to Login") { _, _ ->
                startActivity(Intent(this, LoginActivity::class.java))
                finish()
            }
            .show()
    }

    // The backend sends errors as {"error": "message"}.
    private fun readErrorMessage(raw: String?): String {
        return try {
            JSONObject(raw ?: "").optString("error").ifBlank { "Something went wrong" }
        } catch (e: Exception) {
            raw?.take(200) ?: "Something went wrong"
        }
    }
}