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
data class AuthResponse(val token: String, val user: UserData)

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

data class HistoryResponse(val history: List<HistoryItem>)
data class HistoryItemResponse(val item: HistoryItem)
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

data class ActiveBatch(
    val verificationCode: String,
    val totalPoints: Int,
    val items: List<DonationItem>
)

data class DonationBasketResponse(
    val pendingItems: List<DonationItem>,
    val activeBatch: ActiveBatch?
)

data class PrepareBatchRequest(val itemIds: List<String>)
data class PrepareBatchResponse(val verificationCode: String, val totalPoints: Int, val itemCount: Int)

data class SelfUseResponse(val status: String, val pointsAwarded: Int)
data class RecycleProofResponse(val status: String, val pointsAwarded: Int, val totalRewardPoints: Int)

interface ApiService {

    @Multipart
    @POST("api/classify")
    suspend fun classifyClothing(@Part image: MultipartBody.Part): Response<ClassificationResult>

    @POST("api/auth/register")
    suspend fun registerUser(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("api/auth/login")
    suspend fun loginUser(@Body request: LoginRequest): Response<AuthResponse>

    @GET("api/history")
    suspend fun getHistory(): Response<HistoryResponse>

    @GET("api/user/me")
    suspend fun getMe(): Response<MeResponse>

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

    @POST("api/history/{id}/self-use")
    suspend fun markSelfUse(@Path("id") id: String): Response<SelfUseResponse>

    @Multipart
    @POST("api/history/{id}/recycle-proof")
    suspend fun submitRecycleProof(
        @Path("id") id: String,
        @Part proof: MultipartBody.Part
    ): Response<RecycleProofResponse>

}   