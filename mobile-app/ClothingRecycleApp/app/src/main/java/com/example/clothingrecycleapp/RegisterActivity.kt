
package com.example.clothingrecycleapp

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class RegisterActivity : AppCompatActivity() {

    private lateinit var etName: EditText
    private lateinit var etEmail: EditText
    private lateinit var etPassword: EditText
    private lateinit var btnRegister: Button
    private lateinit var btnGoogleRegister: Button
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
        btnGoogleRegister = findViewById(R.id.btnGoogleRegister)
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

        // Toggle the NGO application fields
        cbRegisterAsNgo.setOnCheckedChangeListener { _, isChecked ->
            ngoFieldsContainer.visibility =
                if (isChecked) View.VISIBLE else View.GONE

            tvNameLabel.text =
                if (isChecked) "Contact Person Name" else "Full Name"

            btnRegister.text =
                if (isChecked) {
                    "Submit NGO Application  →"
                } else {
                    "Join EcoThread  →"
                }

            tvRegisterStatus.text = ""
        }

        // Normal registration or NGO application
        btnRegister.setOnClickListener {
            val name = etName.text.toString().trim()
            val email = etEmail.text.toString().trim()
            val password = etPassword.text.toString().trim()

            if (name.isEmpty() || email.isEmpty() || password.isEmpty()) {
                tvRegisterStatus.text = "Please fill in all fields"
                return@setOnClickListener
            }

            if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
                tvRegisterStatus.text = "Please enter a valid email address"
                return@setOnClickListener
            }

            if (password.length < 9) {
                tvRegisterStatus.text =
                    "Password must be at least 9 characters"
                return@setOnClickListener
            }

            if (!cbRegisterAsNgo.isChecked) {
                registerUser(name, email, password)
                return@setOnClickListener
            }

            // NGO application: validate the additional details
            val organisationName =
                etOrgName.text.toString().trim()
            val registrationNumber =
                etRegNumber.text.toString().trim()
            val contactPhone =
                etOrgPhone.text.toString().trim()
            val address =
                etOrgAddress.text.toString().trim()
            val about =
                etOrgAbout.text.toString().trim()

            when {
                organisationName.isEmpty() ||
                        registrationNumber.isEmpty() ||
                        contactPhone.isEmpty() ||
                        address.isEmpty() -> {

                    tvRegisterStatus.text =
                        "Please fill in the organisation name, " +
                                "registration number, phone and address"
                }

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

        // Google registration is for normal users
        btnGoogleRegister.setOnClickListener {
            signInWithGoogle()
        }

        // Navigate back to login
        tvGoToLogin.setOnClickListener {
            startActivity(Intent(this, LoginActivity::class.java))
            finish()
        }
    }

    private fun registerUser(
        name: String,
        email: String,
        password: String
    ) {
        tvRegisterStatus.text = "Registering..."
        btnRegister.isEnabled = false

        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.apiService.registerUser(
                        RegisterRequest(name, email, password)
                    )
                }

                val errorText = if (response.isSuccessful) {
                    null
                } else {
                    withContext(Dispatchers.IO) {
                        readErrorMessage(response.errorBody()?.string())
                    }
                }

                if (isFinishing || isDestroyed) return@launch

                btnRegister.isEnabled = true

                if (response.isSuccessful && response.body() != null) {
                    tvRegisterStatus.text = ""
                    openVerifyScreen(email, isNgo = false)
                } else {
                    tvRegisterStatus.text =
                        "Registration failed: " +
                                (errorText ?: "Something went wrong")
                }

            } catch (e: Exception) {
                if (isFinishing || isDestroyed) return@launch

                btnRegister.isEnabled = true
                tvRegisterStatus.text =
                    "Error: ${e.message ?: "Please try again."}"
            }
        }
    }

    private fun registerNgo(request: RegisterNgoRequest) {
        tvRegisterStatus.text = "Submitting application..."
        btnRegister.isEnabled = false

        lifecycleScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    RetrofitClient.apiService.registerNgo(request)
                }

                val errorText = if (response.isSuccessful) {
                    null
                } else {
                    withContext(Dispatchers.IO) {
                        readErrorMessage(response.errorBody()?.string())
                    }
                }

                if (isFinishing || isDestroyed) return@launch

                btnRegister.isEnabled = true

                if (response.isSuccessful && response.body() != null) {
                    tvRegisterStatus.text = ""
                    openVerifyScreen(request.email, isNgo = true)
                } else {
                    tvRegisterStatus.text =
                        "Application failed: " +
                                (errorText ?: "Something went wrong")
                }

            } catch (e: Exception) {
                if (isFinishing || isDestroyed) return@launch

                btnRegister.isEnabled = true
                tvRegisterStatus.text =
                    "Error: ${e.message ?: "Please try again."}"
            }
        }
    }

    private fun signInWithGoogle() {
        if (cbRegisterAsNgo.isChecked) {
            tvRegisterStatus.text =
                "Google registration is for normal users. " +
                        "Please use the NGO application form."
            return
        }

        btnGoogleRegister.isEnabled = false
        btnRegister.isEnabled = false
        tvRegisterStatus.text = "Connecting to Google..."

        lifecycleScope.launch {
            try {
                val idToken = GoogleSignInHelper(this@RegisterActivity)
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
                        token = authData.token,
                        userId = authData.user.id,
                        userName = authData.user.name,
                        role = authData.user.role ?: "user",
                        rewardPoints = authData.user.rewardPoints
                    )

                    startActivity(
                        Intent(this@RegisterActivity, MainActivity::class.java)
                    )
                    finish()

                } else {
                    val errorText = withContext(Dispatchers.IO) {
                        readErrorMessage(response.errorBody()?.string())
                    }

                    tvRegisterStatus.text = errorText
                }

            } catch (e: Exception) {
                if (isFinishing || isDestroyed) return@launch

                tvRegisterStatus.text =
                    "Google sign-in failed: " +
                            (e.message ?: "Please try again.")

            } finally {
                if (!isFinishing && !isDestroyed) {
                    btnGoogleRegister.isEnabled = true
                    btnRegister.isEnabled = true
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

    private fun openVerifyScreen(email: String, isNgo: Boolean) {
        startActivity(
            Intent(this, VerifyEmailActivity::class.java)
                .putExtra(VerifyEmailActivity.EXTRA_EMAIL, email)
                .putExtra(VerifyEmailActivity.EXTRA_IS_NGO, isNgo)
        )
        finish()
    }

    // The backend sends errors as {"error": "message"}.
    private fun readErrorMessage(raw: String?): String {
        return try {
            JSONObject(raw ?: "")
                .optString("error")
                .ifBlank { "Something went wrong" }
        } catch (e: Exception) {
            raw?.take(200) ?: "Something went wrong"
        }
    }
}
