package com.example.clothingrecycleapp

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.fragment.app.Fragment
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class NgoAccountFragment : Fragment(R.layout.fragment_ngo_account) {

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val tvName = view.findViewById<TextView>(R.id.tvAccName)
        val tvEmail = view.findViewById<TextView>(R.id.tvAccEmail)
        val tvCentre = view.findViewById<TextView>(R.id.tvAccCentre)

        view.findViewById<Button>(R.id.btnLogout).setOnClickListener { logout() }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val me = RetrofitClient.apiService.getMe()
                val overview = RetrofitClient.apiService.getNgoOverview()

                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    me.body()?.user?.let {
                        tvName.text = it.name
                        tvEmail.text = it.email
                    }
                    tvCentre.text = overview.body()?.centre?.name ?: "Not linked to a centre yet"
                }
            } catch (e: Exception) {
                // Keep the placeholders if this cannot be loaded.
            }
        }
    }

    private fun logout() {
        val prefs = requireContext().getSharedPreferences("app_prefs", Context.MODE_PRIVATE)
        prefs.edit()
            .remove("token")
            .remove("role")
            .remove("rewardPoints")
            .apply()

        startActivity(
            Intent(requireContext(), LoginActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
    }
}