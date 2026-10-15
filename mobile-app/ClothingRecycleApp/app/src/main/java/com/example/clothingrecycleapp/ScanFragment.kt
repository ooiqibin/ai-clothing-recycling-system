package com.example.clothingrecycleapp

import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream

class ScanFragment : Fragment(R.layout.fragment_scan) {

    private lateinit var imagePreview: ImageView
    private lateinit var btnClassify: Button
    private lateinit var scanStatusText: TextView
    private var selectedImageFile: File? = null

    private val takePhotoLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        bitmap?.let {
            val file = File(requireContext().cacheDir, "clothing_${System.currentTimeMillis()}.jpg")
            FileOutputStream(file).use { out -> it.compress(Bitmap.CompressFormat.JPEG, 90, out) }
            selectedImageFile = file
            imagePreview.setImageBitmap(it)
            btnClassify.isEnabled = true
        }
    }

    private val pickImageLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        uri?.let {
            val inputStream = requireContext().contentResolver.openInputStream(it)
            val file = File(requireContext().cacheDir, "clothing_${System.currentTimeMillis()}.jpg")
            inputStream?.use { input -> FileOutputStream(file).use { output -> input.copyTo(output) } }
            selectedImageFile = file
            imagePreview.setImageURI(it)
            btnClassify.isEnabled = true
        }
    }

    private val requestCameraPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) takePhotoLauncher.launch(null) else Toast.makeText(requireContext(), "Camera permission is required", Toast.LENGTH_SHORT).show() }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        imagePreview = view.findViewById(R.id.imagePreview)
        btnClassify = view.findViewById(R.id.btnClassify)
        scanStatusText = view.findViewById(R.id.scanStatusText)
        val btnTakePhoto = view.findViewById<Button>(R.id.btnTakePhoto)
        val btnChooseGallery = view.findViewById<Button>(R.id.btnChooseGallery)

        btnTakePhoto.setOnClickListener {
            if (ContextCompat.checkSelfPermission(requireContext(), android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                takePhotoLauncher.launch(null)
            } else {
                requestCameraPermission.launch(android.Manifest.permission.CAMERA)
            }
        }

        btnChooseGallery.setOnClickListener { pickImageLauncher.launch("image/*") }

        btnClassify.setOnClickListener {
            selectedImageFile?.let { file -> uploadImageForClassification(file) }
        }
    }

    private fun uploadImageForClassification(file: File) {
        scanStatusText.text = "Classifying..."
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val requestFile = file.asRequestBody("image/jpeg".toMediaTypeOrNull())
                val imagePart = MultipartBody.Part.createFormData("image", file.name, requestFile)
                val response = RetrofitClient.apiService.classifyClothing(imagePart)

                withContext(Dispatchers.Main) {
                    if (response.isSuccessful && response.body() != null) {
                        val result = response.body()!!
                        // Hand off to the Item Detail screen, which now handles all category-specific actions
                        (activity as? MainActivity)?.openItemDetail(result.resultId)
                    } else if (response.code() == 409) {
                        scanStatusText.text = "You've already submitted this exact item before."
                    } else {
                        scanStatusText.text = "Classification failed. Try again."
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) { scanStatusText.text = "Error: ${e.message}" }
            }
        }
    }
}