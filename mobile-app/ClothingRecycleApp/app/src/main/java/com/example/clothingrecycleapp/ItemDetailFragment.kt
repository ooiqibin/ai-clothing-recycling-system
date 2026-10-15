package com.example.clothingrecycleapp

import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.fragment.app.Fragment
import coil.load
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream

class ItemDetailFragment : Fragment(R.layout.fragment_item_detail) {

    companion object {
        private const val ARG_RESULT_ID = "resultId"
        fun newInstance(resultId: String): ItemDetailFragment {
            val fragment = ItemDetailFragment()
            fragment.arguments = Bundle().apply { putString(ARG_RESULT_ID, resultId) }
            return fragment
        }
    }

    private var proofFile: File? = null
    private lateinit var ivProofPreview: ImageView

    private val takeProofPhotoLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        bitmap?.let {
            val file = File(requireContext().cacheDir, "proof_${System.currentTimeMillis()}.jpg")
            FileOutputStream(file).use { out -> it.compress(Bitmap.CompressFormat.JPEG, 90, out) }
            proofFile = file
            ivProofPreview.visibility = View.VISIBLE
            ivProofPreview.setImageBitmap(it)
            view?.findViewById<Button>(R.id.btnSubmitProof)?.isEnabled = true
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val resultId = arguments?.getString(ARG_RESULT_ID) ?: return

        val ivDetailImage = view.findViewById<ImageView>(R.id.ivDetailImage)
        val tvDetailCategory = view.findViewById<TextView>(R.id.tvDetailCategory)
        val tvDetailExplanation = view.findViewById<TextView>(R.id.tvDetailExplanation)
        val tvDetailStatusLabel = view.findViewById<TextView>(R.id.tvDetailStatusLabel)
        val tvDetailStatusValue = view.findViewById<TextView>(R.id.tvDetailStatusValue)

        val reusableChoiceContainer = view.findViewById<LinearLayout>(R.id.reusableChoiceContainer)
        val btnKeepMyself = view.findViewById<Button>(R.id.btnKeepMyself)
        val btnDonateIt = view.findViewById<Button>(R.id.btnDonateIt)

        val recyclableProofContainer = view.findViewById<LinearLayout>(R.id.recyclableProofContainer)
        val btnTakeProofPhoto = view.findViewById<Button>(R.id.btnTakeProofPhoto)
        val btnSubmitProof = view.findViewById<Button>(R.id.btnSubmitProof)
        ivProofPreview = view.findViewById(R.id.ivProofPreview)

        val btnConfirmDisposal = view.findViewById<Button>(R.id.btnConfirmDisposal)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getHistoryItemDetail(resultId)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val item = response.body()!!.item
                        tvDetailCategory.text = item.category.uppercase()
                        ivDetailImage.load(Constants.SERVER_BASE_URL + item.imageUrl) { crossfade(true) }

                        if (item.status == "awaiting_verification") {
                            tvDetailExplanation.text = "You've prepared this item for donation. Show your verification code to an NGO staff member in the Donate tab to complete it."
                            tvDetailStatusLabel.text = "Status"
                            tvDetailStatusValue.text = "Awaiting NGO Verification (+${item.potentialPoints} pts once verified)"
                            return@withContext
                        }

                        if (item.status != "pending") {
                            tvDetailExplanation.text = ""
                            tvDetailStatusLabel.text = "Status"
                            tvDetailStatusValue.text = "${item.status.replaceFirstChar { it.uppercase() }} ✓  (+${item.pointsAwarded} pts)"
                            return@withContext
                        }

                        tvDetailStatusLabel.text = "Potential reward"
                        tvDetailStatusValue.text = "+${item.potentialPoints} pts"

                        when (item.category) {
                            "reusable" -> {
                                tvDetailExplanation.text = "This item is still wearable. You can keep using it yourself, or donate it to someone who needs it."
                                reusableChoiceContainer.visibility = View.VISIBLE

                                btnKeepMyself.setOnClickListener { markSelfUse(resultId, tvDetailStatusLabel, tvDetailStatusValue, reusableChoiceContainer) }
                                btnDonateIt.setOnClickListener {
                                    (activity as? MainActivity)?.navigateToTab(R.id.nav_donate)
                                }
                            }
                            "recyclable" -> {
                                tvDetailExplanation.text = "This fabric can be broken down and turned into new material, such as insulation or new fabric fiber. Recycle it, then take a photo showing it's been dropped off or processed, to confirm and earn your points."
                                recyclableProofContainer.visibility = View.VISIBLE

                                btnTakeProofPhoto.setOnClickListener { takeProofPhotoLauncher.launch(null) }
                                btnSubmitProof.setOnClickListener {
                                    proofFile?.let { submitRecycleProof(resultId, it, tvDetailStatusLabel, tvDetailStatusValue, recyclableProofContainer) }
                                }
                            }
                            "damaged" -> {
                                tvDetailExplanation.text = "This item is too damaged to reuse or recycle. Please dispose of it responsibly."
                                btnConfirmDisposal.visibility = View.VISIBLE
                                btnConfirmDisposal.setOnClickListener {
                                    confirmDisposal(resultId, tvDetailStatusLabel, tvDetailStatusValue, btnConfirmDisposal)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun markSelfUse(id: String, label: TextView, value: TextView, container: View) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.markSelfUse(id)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful) {
                        label.text = "Status"
                        value.text = "Kept for yourself ✓  (0 pts)"
                        container.visibility = View.GONE
                    } else {
                        Toast.makeText(requireContext(), "Failed. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show() }
            }
        }
    }

    private fun submitRecycleProof(id: String, file: File, label: TextView, value: TextView, container: View) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val requestFile = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                val part = MultipartBody.Part.createFormData("proof", file.name, requestFile)
                val response = RetrofitClient.apiService.submitRecycleProof(id, part)
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        (activity as? MainActivity)?.setPointsDisplay(body.totalRewardPoints)
                        val prefs = requireContext().getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
                        prefs.edit().putInt("rewardPoints", body.totalRewardPoints).apply()

                        label.text = "Status"
                        value.text = "Recycled ✓  (+${body.pointsAwarded} pts)"
                        container.visibility = View.GONE
                        Toast.makeText(requireContext(), "+${body.pointsAwarded} pts earned!", Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(requireContext(), "Failed to submit proof. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show() }
            }
        }
    }

    private fun confirmDisposal(id: String, label: TextView, value: TextView, button: Button) {
        button.isEnabled = false
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.confirmAction(id, ConfirmActionRequest("disposed"))
                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        (activity as? MainActivity)?.setPointsDisplay(body.totalRewardPoints)
                        val prefs = requireContext().getSharedPreferences("app_prefs", android.content.Context.MODE_PRIVATE)
                        prefs.edit().putInt("rewardPoints", body.totalRewardPoints).apply()

                        label.text = "Status"
                        value.text = "Disposed ✓  (+${body.pointsAwarded} pts)"
                        button.visibility = View.GONE
                    } else {
                        button.isEnabled = true
                        Toast.makeText(requireContext(), "Failed. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    button.isEnabled = true
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}