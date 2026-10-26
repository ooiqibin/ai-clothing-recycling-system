package com.example.clothingrecycleapp

import android.os.Bundle
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.fragment.app.Fragment
import coil.load
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ItemDetailFragment : Fragment(R.layout.fragment_item_detail) {

    companion object {
        private const val ARG_RESULT_ID = "resultId"
        fun newInstance(resultId: String): ItemDetailFragment {
            val fragment = ItemDetailFragment()
            fragment.arguments = Bundle().apply { putString(ARG_RESULT_ID, resultId) }
            return fragment
        }
    }

    private val recyclingTips =
        "♻️ How to recycle this item\n\n" +
                "• Wash it and let it dry.\n" +
                "• Remove buttons, zips or labels if you can.\n" +
                "• Take it to a textile or clothing recycling bin. Many shopping centres and " +
                "councils have one. The Recycling filter on the Map tab can help you find a point.\n" +
                "• Do not put it in general rubbish or with wet waste.\n\n" +
                "Recycling does not earn points, but it keeps fabric out of landfill."

    private val disposalTips =
        "🗑️ How to dispose of this item\n\n" +
                "• It is too damaged to reuse or recycle.\n" +
                "• Cotton scraps can still work as cleaning rags before you throw them away.\n" +
                "• Put the rest in your general waste, bagged so it stays dry.\n\n" +
                "Disposal does not earn points."

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

        // The photo-proof area is no longer used.
        view.findViewById<LinearLayout>(R.id.recyclableProofContainer).visibility = View.GONE

        // One "Done" button closes recyclable and damaged cases.
        val btnClose = view.findViewById<Button>(R.id.btnConfirmDisposal)

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.getHistoryItemDetail(resultId)
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

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
                            tvDetailStatusValue.text = finishedStatusText(item)
                            return@withContext
                        }

                        when (item.category) {
                            "reusable" -> {
                                tvDetailExplanation.text = "This item is still wearable. You can keep using it yourself, or donate it to someone who needs it."
                                tvDetailStatusLabel.text = "Reward"
                                tvDetailStatusValue.text = "+${item.potentialPoints} pts once an NGO verifies your donation"
                                reusableChoiceContainer.visibility = View.VISIBLE

                                btnKeepMyself.setOnClickListener {
                                    markSelfUse(resultId, tvDetailStatusLabel, tvDetailStatusValue, reusableChoiceContainer)
                                }
                                btnDonateIt.setOnClickListener {
                                    (activity as? MainActivity)?.navigateToTab(R.id.nav_donate)
                                }
                            }

                            "recyclable" -> {
                                tvDetailExplanation.text = recyclingTips
                                tvDetailStatusLabel.text = "Reward"
                                tvDetailStatusValue.text = "No points for recycling"
                                btnClose.text = "Done, I've recycled it"
                                btnClose.visibility = View.VISIBLE
                                btnClose.setOnClickListener {
                                    closeCase(resultId, "recycled", tvDetailExplanation, tvDetailStatusLabel, tvDetailStatusValue, btnClose)
                                }
                            }

                            "damaged" -> {
                                tvDetailExplanation.text = disposalTips
                                tvDetailStatusLabel.text = "Reward"
                                tvDetailStatusValue.text = "No points for disposal"
                                btnClose.text = "Done, I've disposed of it"
                                btnClose.visibility = View.VISIBLE
                                btnClose.setOnClickListener {
                                    closeCase(resultId, "disposed", tvDetailExplanation, tvDetailStatusLabel, tvDetailStatusValue, btnClose)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isAdded) Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun finishedStatusText(item: HistoryItem): String = when (item.status) {
        "donated" -> "Donated ✓  (+${item.pointsAwarded} pts)"
        "self_use" -> "Kept for yourself ✓"
        "recycled" -> "Recycled ✓"
        "disposed" -> "Disposed ✓"
        else -> item.status.replaceFirstChar { it.uppercase() }
    }

    private fun markSelfUse(id: String, label: TextView, value: TextView, container: View) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.markSelfUse(id)
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (response.isSuccessful) {
                        label.text = "Status"
                        value.text = "Kept for yourself ✓"
                        container.visibility = View.GONE
                    } else {
                        Toast.makeText(requireContext(), "Failed. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (isAdded) Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    // Recycled or disposed: closes the case. No points, no proof.
    private fun closeCase(
        id: String,
        action: String,
        explanation: TextView,
        label: TextView,
        value: TextView,
        button: Button
    ) {
        button.isEnabled = false

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.apiService.confirmAction(id, ConfirmActionRequest(action))
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext

                    if (response.isSuccessful) {
                        explanation.text = "Thank you for dealing with it responsibly! 🌍"
                        label.text = "Status"
                        value.text = if (action == "recycled") "Recycled ✓" else "Disposed ✓"
                        button.visibility = View.GONE
                        Toast.makeText(requireContext(), "Done. This case is closed.", Toast.LENGTH_SHORT).show()
                    } else {
                        button.isEnabled = true
                        Toast.makeText(requireContext(), "Failed. Try again.", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    if (!isAdded) return@withContext
                    button.isEnabled = true
                    Toast.makeText(requireContext(), "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}