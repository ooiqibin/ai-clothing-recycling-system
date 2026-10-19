package com.example.clothingrecycleapp

import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.DELETE

data class ClassificationResult(
    val resultId: String,
    val category: String,
    val confidence: Float,
    val potentialPoints: Int,
    val imageUrl: String
)

data class RegisterRequest(val name: String, val email: String, val password: String)
data class LoginRequest(val email: String, val password: String)
data class UserData(val id: String, val name: String, val email: String, val rewardPoints: Int, val role: String? = null)
data class NgoApplicationInfo(val status: String, val rejectionReason: String? = null)
data class AuthResponse(val token: String, val user: UserData, val ngoApplication: NgoApplicationInfo? = null)
data class RegisterNgoRequest(
    val name: String,
    val email: String,
    val password: String,
    val organisationName: String,
    val registrationNumber: String,
    val contactPhone: String,
    val address: String,
    val about: String
)

data class NgoCentreInfo(val name: String, val address: String?, val phone: String?, val openingHours: String?)
data class NgoTotals(val donations: Int, val items: Int, val points: Int)
data class NgoRecentDonation(val id: String, val donorName: String, val itemCount: Int, val points: Int, val verifiedAt: String?)
data class NgoToday(val donations: Int = 0, val items: Int = 0)
data class NgoDay(val day: String, val items: Int = 0, val donations: Int = 0)
data class NgoOverviewResponse(
    val centre: NgoCentreInfo,
    val totals: NgoTotals,
    val thisWeek: Int,
    val recent: List<NgoRecentDonation>,
    val today: NgoToday? = null,
    val pending: Int = 0,
    val carbonKg: Double = 0.0,
    val perDay: List<NgoDay> = emptyList()
)

data class HistoryItem(
    val _id: String,
    val category: String,
    val confidence: Float,
    val status: String,
    val potentialPoints: Int,
    val pointsAwarded: Int,
    val imageFilename: String,
    val imageUrl: String,
    val createdAt: String
)


data class NgoApplicationResponse(val application: NgoApplicationInfo?)

data class HistoryResponse(val history: List<HistoryItem>)
data class HistoryItemResponse(val item: HistoryItem)

data class RewardItem(
    val id: String,
    val title: String,
    val description: String? = null,
    val partnerName: String? = null,
    val pointsCost: Int,
    val stock: Int? = null,
    val soldOut: Boolean = false,
    val perUserLimit: Int? = null,
    val validDays: Int = 30,
    val terms: String? = null,
    val redeemedByMe: Int = 0
)
data class RewardsResponse(val rewards: List<RewardItem>)

data class CouponItem(
    val id: String,
    val code: String,
    val rewardTitle: String,
    val partnerName: String? = null,
    val terms: String? = null,
    val pointsSpent: Int,
    val status: String,
    val expiresAt: String? = null,
    val usedAt: String? = null,
    val createdAt: String? = null
)
data class CouponsResponse(val coupons: List<CouponItem>)
data class CouponResponse(val coupon: CouponItem, val totalRewardPoints: Int = 0)

data class MeResponse(val user: UserData)

data class ConfirmActionRequest(val action: String)
data class ConfirmActionResponse(val status: String, val pointsAwarded: Int, val totalRewardPoints: Int)

data class PrepareDonationResponse(val verificationCode: String, val status: String)

data class VerifyRequest(val verificationCode: String)
data class VerifyResponse(val itemCount: Int, val pointsAwarded: Int, val donorName: String)

data class DonationItem(
    val _id: String,
    val category: String,
    val confidence: Float,
    val potentialPoints: Int,
    val imageFilename: String,
    val imageUrl: String,
    val createdAt: String
)

data class ActiveBatchCentre(val name: String, val address: String? = null)

data class ActiveBatch(
    val verificationCode: String,
    val totalPoints: Int,
    val items: List<DonationItem>,
    val centre: ActiveBatchCentre? = null
)

data class DonationBasketResponse(
    val pendingItems: List<DonationItem>,
    val activeBatch: ActiveBatch?
)

data class PrepareBatchRequest(val itemIds: List<String>, val centerId: String)
data class PrepareBatchResponse(val verificationCode: String, val totalPoints: Int, val itemCount: Int, val centreName: String? = null)

data class DonationCentreItem(val _id: String, val name: String, val address: String? = null)
data class DonationCentresResponse(val centers: List<DonationCentreItem>)

data class SelfUseResponse(val status: String, val pointsAwarded: Int)
data class RecycleProofResponse(val status: String, val pointsAwarded: Int, val totalRewardPoints: Int)

data class EcoTipItem(
    val id: String,
    val title: String,
    val content: String,
    val category: String,
    val status: String,
    val rejectionReason: String? = null,
    val author: String? = null,
    val createdAt: String? = null,
    val publishedAt: String? = null
)
data class EcoTipsResponse(val tips: List<EcoTipItem>)
data class EcoTipResponse(val tip: EcoTipItem)
data class CreateEcoTipRequest(val title: String, val content: String, val category: String)
data class MessageResponse(val message: String? = null)

interface ApiService {

    @Multipart
    @POST("api/classify")
    suspend fun classifyClothing(@Part image: MultipartBody.Part): Response<ClassificationResult>

    @POST("api/auth/register")
    suspend fun registerUser(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("api/auth/register-ngo")
    suspend fun registerNgo(@Body request: RegisterNgoRequest): Response<AuthResponse>

    @POST("api/auth/login")
    suspend fun loginUser(@Body request: LoginRequest): Response<AuthResponse>

    @GET("api/history")
    suspend fun getHistory(): Response<HistoryResponse>

    @GET("api/user/me")
    suspend fun getMe(): Response<MeResponse>

    @GET("api/ngo/application")
    suspend fun getMyNgoApplication(): Response<NgoApplicationResponse>

    @GET("api/ngo/overview")
    suspend fun getNgoOverview(): Response<NgoOverviewResponse>

    @POST("api/history/{id}/confirm")
    suspend fun confirmAction(@Path("id") id: String, @Body request: ConfirmActionRequest): Response<ConfirmActionResponse>

    @GET("api/history/{id}")
    suspend fun getHistoryItemDetail(@Path("id") id: String): Response<HistoryItemResponse>

    @POST("api/history/{id}/prepare-donation")
    suspend fun prepareDonation(@Path("id") id: String): Response<PrepareDonationResponse>

    @POST("api/verify")
    suspend fun verifyDonation(@Body request: VerifyRequest): Response<VerifyResponse>

    @GET("api/donation-basket")
    suspend fun getDonationBasket(): Response<DonationBasketResponse>

    @POST("api/donation-basket/prepare")
    suspend fun prepareDonationBatch(@Body request: PrepareBatchRequest): Response<PrepareBatchResponse>

    @GET("api/donation-centers")
    suspend fun getDonationCentres(): Response<DonationCentresResponse>

    @GET("api/rewards")
    suspend fun getRewards(): Response<RewardsResponse>

    @POST("api/rewards/{id}/redeem")
    suspend fun redeemReward(@Path("id") id: String): Response<CouponResponse>

    @GET("api/coupons/mine")
    suspend fun getMyCoupons(): Response<CouponsResponse>

    @POST("api/coupons/{id}/use")
    suspend fun useCoupon(@Path("id") id: String): Response<CouponResponse>

    @GET("api/eco-tips")
    suspend fun getEcoTips(): Response<EcoTipsResponse>

    @GET("api/ngo/eco-tips")
    suspend fun getMyEcoTips(): Response<EcoTipsResponse>

    @POST("api/ngo/eco-tips")
    suspend fun createEcoTip(@Body request: CreateEcoTipRequest): Response<EcoTipResponse>

    @DELETE("api/ngo/eco-tips/{id}")
    suspend fun deleteMyEcoTip(@Path("id") id: String): Response<MessageResponse>

    @POST("api/history/{id}/self-use")
    suspend fun markSelfUse(@Path("id") id: String): Response<SelfUseResponse>

    @Multipart
    @POST("api/history/{id}/recycle-proof")
    suspend fun submitRecycleProof(
        @Path("id") id: String,
        @Part proof: MultipartBody.Part
    ): Response<RecycleProofResponse>

}   