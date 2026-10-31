package com.example.clothingrecycleapp

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.preference.PreferenceManager
import android.util.Log
import android.view.View
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.app.ActivityCompat
import androidx.fragment.app.Fragment
import org.json.JSONObject
import org.osmdroid.config.Configuration
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.CopyrightOverlay
import org.osmdroid.views.overlay.Marker
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import kotlin.concurrent.thread
import kotlin.math.roundToInt

class MapFragment : Fragment(R.layout.fragment_map) {

    companion object {
        private const val TAG = "MapFragment"

        // Free key from https://carto.com/basemaps/apikey
        private val CARTO_API_KEY: String = BuildConfig.CARTO_API_KEY

        private val API_BASE_URL: String = BuildConfig.SERVER_URL.trimEnd('/')
        private const val ADMIN_ENDPOINT = "/api/donation-centers"

        // How far to look for places (the backend allows up to 10000).
        private const val SEARCH_RADIUS_METRES = 10000
        private const val SEARCH_DEBOUNCE_MS = 600L

        private const val PREFS_NAME = "app_prefs"
        private const val TOKEN_KEY = "token"
    }

    // Map pictures from CARTO (based on OpenStreetMap data).
    private val cartoTiles = XYTileSource(
        "CartoVoyager",
        0, 19, 256, ".png?key=$CARTO_API_KEY",
        arrayOf(
            "https://a.basemaps.cartocdn.com/rastertiles/voyager/",
            "https://b.basemaps.cartocdn.com/rastertiles/voyager/",
            "https://c.basemaps.cartocdn.com/rastertiles/voyager/",
            "https://d.basemaps.cartocdn.com/rastertiles/voyager/"
        ),
        "© OpenStreetMap contributors © CARTO"
    )

    private lateinit var map: MapView
    private lateinit var resultName: TextView
    private lateinit var resultInfo: TextView

    private var locationManager: LocationManager? = null
    private var locationListener: LocationListener? = null

    private var currentLatitude = 0.0
    private var currentLongitude = 0.0
    private var hasRealLocation = false
    private var hasSearched = false
    private var lastSearchLat = 0.0
    private var lastSearchLon = 0.0

    private var selectedCategory = "NGO"

    // Markers: the blue dot for the device, and one per place found.
    private var myLocationMarker: Marker? = null
    private val placeMarkers = mutableListOf<Marker>()

    // Results per category for the current location (avoids repeat requests).
    private val placeCache = mutableMapOf<String, List<Place>>()

    // Street addresses looked up from coordinates (so each is only fetched once).
    private val addressLookupCache = ConcurrentHashMap<String, String>()

    private val searchGeneration = AtomicInteger(0)

    @Volatile private var overpassFailed = false
    @Volatile private var adminFailed = false

    private val locationPermissionLauncher =
        registerForActivityResult(
            ActivityResultContracts.RequestMultiplePermissions()
        ) { result ->
            if (result.values.any { it }) {
                requestCurrentLocation()
            } else {
                resultName.text = "Location needed"
                resultInfo.text = "Allow location access to find nearby places"
            }
        }

    override fun onAttach(context: Context) {
        super.onAttach(context)

        Configuration.getInstance().load(
            context.applicationContext,
            PreferenceManager.getDefaultSharedPreferences(
                context.applicationContext
            )
        )

        Configuration.getInstance().userAgentValue =
            "ClothingRecycleFYP/1.0 (Coventry University student project; contact: ooiqibin2004@gmail.com)"

        Configuration.getInstance().additionalHttpRequestProperties["Referer"] =
            "https://github.com/ooiqibin/ai-clothing-recycling-system.git"
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        map = view.findViewById(R.id.map)
        resultName = view.findViewById(R.id.tvResultName)
        resultInfo = view.findViewById(R.id.tvResultInfo)

        map.setTileSource(cartoTiles)
        map.setMultiTouchControls(true)
        map.controller.setZoom(3.0)

        // Keep map attribution visible on the map.
        map.overlays.add(CopyrightOverlay(requireContext()))

        setupMapTileLogging()
        setupButtons(view)
        setupCategoryChips(view)

        resultName.text = "Finding your location..."
        resultInfo.text = "Please wait"

        requestCurrentLocation()
    }

    private fun setupMapTileLogging() {
        Log.d(TAG, "Tile source: ${map.tileProvider.tileSource.name()}")
        Log.d(
            TAG,
            "Tile User-Agent: ${Configuration.getInstance().userAgentValue}"
        )
        Log.d(TAG, "Map attribution overlay added")
    }

    private fun setupButtons(view: View) {
        view.findViewById<View>(R.id.btnMyLocation)
            .setOnClickListener {
                if (hasRealLocation) {
                    map.controller.animateTo(
                        GeoPoint(currentLatitude, currentLongitude)
                    )
                }
                requestCurrentLocation()
            }

        view.findViewById<View>(R.id.btnNearby)
            .setOnClickListener {
                // Nearby always asks for fresh results.
                searchPlaces(selectedCategory, forceRefresh = true)
            }

        view.findViewById<View>(R.id.btnNearest)
            .setOnClickListener {
                findNearestPlace()
            }
    }

    private fun setupCategoryChips(view: View) {
        view.findViewById<View>(R.id.chipNgo)
            .setOnClickListener {
                selectedCategory = "NGO"
                searchPlaces(selectedCategory)
            }

        view.findViewById<View>(R.id.chipThrift)
            .setOnClickListener {
                selectedCategory = "Thrift"
                searchPlaces(selectedCategory)
            }

        view.findViewById<View>(R.id.chipRecycling)
            .setOnClickListener {
                selectedCategory = "Recycling"
                searchPlaces(selectedCategory)
            }
    }

    // Device location

    private fun requestCurrentLocation() {
        val context = context ?: return

        val hasFineLocation =
            ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

        val hasCoarseLocation =
            ActivityCompat.checkSelfPermission(
                context,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

        if (!hasFineLocation && !hasCoarseLocation) {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
            return
        }

        try {
            val manager =
                context.getSystemService(Context.LOCATION_SERVICE)
                        as LocationManager
            locationManager = manager

            val lastKnown = listOf(
                LocationManager.GPS_PROVIDER,
                LocationManager.NETWORK_PROVIDER
            ).firstNotNullOfOrNull { provider ->
                try {
                    if (manager.isProviderEnabled(provider)) {
                        manager.getLastKnownLocation(provider)
                    } else {
                        null
                    }
                } catch (e: SecurityException) {
                    null
                }
            }

            if (lastKnown != null) {
                updateLocation(lastKnown)
            }

            val provider = when {
                manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ->
                    LocationManager.NETWORK_PROVIDER

                manager.isProviderEnabled(LocationManager.GPS_PROVIDER) ->
                    LocationManager.GPS_PROVIDER

                else -> null
            }

            if (provider == null) {
                Log.d(TAG, "No location provider available")
                if (!hasRealLocation) {
                    resultName.text = "Location is turned off"
                    resultInfo.text = "Turn on location in your device settings"
                }
                return
            }

            stopLocationUpdates()

            val listener = object : LocationListener {
                override fun onLocationChanged(location: Location) {
                    if (!isAdded) return
                    activity?.runOnUiThread { updateLocation(location) }
                    stopLocationUpdates()
                }
            }
            locationListener = listener

            manager.requestLocationUpdates(provider, 0L, 0f, listener)
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission error: ${e.message}", e)
        } catch (e: Exception) {
            Log.e(TAG, "Unable to obtain current location: ${e.message}", e)
        }
    }

    private fun stopLocationUpdates() {
        try {
            locationListener?.let { locationManager?.removeUpdates(it) }
        } catch (_: SecurityException) {
        }
        locationListener = null
    }

    private fun updateLocation(location: Location) {
        currentLatitude = location.latitude
        currentLongitude = location.longitude
        hasRealLocation = true

        val point = GeoPoint(currentLatitude, currentLongitude)

        // Zoom out a little so the wider search area is visible.
        map.controller.setZoom(13.0)
        map.controller.animateTo(point)
        showMyLocationMarker(point)

        Log.d(
            TAG,
            "Current location: $currentLatitude, $currentLongitude"
        )

        val movedFarEnough = !hasSearched || distanceMetres(
            lastSearchLat, lastSearchLon,
            currentLatitude, currentLongitude
        ) > 100

        if (movedFarEnough) {
            hasSearched = true
            lastSearchLat = currentLatitude
            lastSearchLon = currentLongitude
            placeCache.clear()
            searchPlaces(selectedCategory)
        }
    }

    private fun createLocationDot(): Drawable {
        val density = resources.displayMetrics.density
        val size = (22 * density).toInt()

        return GradientDrawable().apply {
            shape = GradientDrawable.OVAL
            setColor(Color.parseColor("#1A73E8"))
            setStroke((3 * density).toInt(), Color.WHITE)
            setSize(size, size)
        }
    }

    private fun showMyLocationMarker(point: GeoPoint) {
        val marker = myLocationMarker ?: Marker(map).apply {
            icon = createLocationDot()
            title = "You are here"
            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_CENTER)
            myLocationMarker = this
        }

        marker.position = point
        bringMyLocationToFront()
    }

    private fun bringMyLocationToFront() {
        myLocationMarker?.let { marker ->
            map.overlays.remove(marker)
            map.overlays.add(marker)
        }
        map.invalidate()
    }

    // Searching

    private fun searchPlaces(category: String, forceRefresh: Boolean = false) {
        if (!hasRealLocation) {
            resultName.text = "Waiting for location"
            resultInfo.text = "Tap My Location once GPS is ready"
            return
        }
        // Use saved results when we already searched category here.
        if (!forceRefresh) {
            val cached = placeCache[category]
            if (cached != null) {
                searchGeneration.incrementAndGet() // cancel any older search
                overpassFailed = false
                adminFailed = false
                displayPlaces(category, cached)
                return
            }
        }

        val generation = searchGeneration.incrementAndGet()
        val latitude = currentLatitude
        val longitude = currentLongitude

        overpassFailed = false
        adminFailed = false

        resultName.text = "Searching..."
        resultInfo.text = "Looking for $category places nearby"

        thread(name = "MapPlaceSearch") {
            // Wait briefly so rapid taps only send the last search.
            Thread.sleep(SEARCH_DEBOUNCE_MS)
            if (searchGeneration.get() != generation) return@thread

            var overpassPlaces: List<Place> = emptyList()
            var attempt = 0

            while (attempt < 2) {
                attempt++
                try {
                    overpassPlaces = getOverpassPlaces(
                        category,
                        latitude,
                        longitude,
                        generation
                    )
                    overpassFailed = false
                    break
                } catch (e: Exception) {
                    Log.e(TAG, "Place search attempt $attempt failed for $category", e)
                    overpassFailed = true
                    if (searchGeneration.get() != generation) return@thread
                    if (attempt < 2) Thread.sleep(3000)
                }
            }

            if (searchGeneration.get() != generation) {
                Log.d(TAG, "Cancelled outdated $category search")
                return@thread
            }

            // Admin donation centres only belong in NGO and Recycling searches.
            val adminPlaces =
                if (category == "NGO" || category == "Recycling") {
                    getAdminPlaces()
                } else {
                    emptyList()
                }

            if (searchGeneration.get() != generation) {
                Log.d(TAG, "Cancelled outdated $category search")
                return@thread
            }

            val combined = (overpassPlaces + adminPlaces)
                .distinctBy {
                    "${it.name.lowercase(Locale.ROOT)}:" +
                            "${"%.4f".format(Locale.US, it.latitude)}:" +
                            "${"%.4f".format(Locale.US, it.longitude)}"
                }

            activity?.runOnUiThread {
                if (!isAdded || searchGeneration.get() != generation) {
                    return@runOnUiThread
                }

                // Only save results from a successful search.
                if (!overpassFailed) {
                    placeCache[category] = combined
                }

                displayPlaces(category, combined)

                Log.d(
                    TAG,
                    "Displayed ${combined.size} places for $category; " +
                            "search failed=$overpassFailed, " +
                            "admin failed=$adminFailed"
                )
            }
        }
    }

    // Asks your own backend, which asks OpenStreetMap and saves the answer.
    private fun getOverpassPlaces(
        category: String,
        latitude: Double,
        longitude: Double,
        generation: Int
    ): List<Place> {
        if (searchGeneration.get() != generation) return emptyList()

        var connection: HttpURLConnection? = null

        try {
            val url = URL(
                "$API_BASE_URL/api/places" +
                        "?category=${URLEncoder.encode(category, "UTF-8")}" +
                        "&lat=$latitude&lon=$longitude" +
                        "&radius=$SEARCH_RADIUS_METRES"
            )
            Log.d(TAG, "Asking backend for $category places")

            connection = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 110000
                setRequestProperty("Accept", "application/json")
            }

            val status = connection.responseCode

            if (status !in 200..299) {
                val errorText = try {
                    connection.errorStream?.bufferedReader()?.use {
                        it.readText()
                    }.orEmpty()
                } catch (_: Exception) {
                    ""
                }

                throw java.io.IOException(
                    "Backend HTTP $status: ${errorText.take(300)}"
                )
            }

            val cacheState = connection.getHeaderField("X-Cache")

            val body = connection.inputStream.bufferedReader().use {
                it.readText()
            }

            val elements = JSONObject(body).optJSONArray("elements")
                ?: return emptyList()

            val places = mutableListOf<Place>()

            for (i in 0 until elements.length()) {
                val element = elements.optJSONObject(i) ?: continue
                val tags = element.optJSONObject("tags") ?: JSONObject()

                val lat: Double
                val lon: Double

                if (element.has("lat") && element.has("lon")) {
                    lat = element.optDouble("lat", Double.NaN)
                    lon = element.optDouble("lon", Double.NaN)
                } else {
                    val center = element.optJSONObject("center") ?: continue
                    lat = center.optDouble("lat", Double.NaN)
                    lon = center.optDouble("lon", Double.NaN)
                }

                if (!lat.isFinite() || !lon.isFinite()) continue

                val name = tags.optString("name")
                    .takeIf { it.isNotBlank() }
                    ?: category

                places.add(
                    Place(
                        name = name,
                        address = buildAddress(tags),
                        latitude = lat,
                        longitude = lon,
                        source = "OpenStreetMap"
                    )
                )
            }

            Log.d(
                TAG,
                "Backend returned ${places.size} places for $category (cache: $cacheState)"
            )

            return places
        } catch (e: Exception) {
            Log.e(TAG, "Backend place search failed for $category: ${e.message}")
            overpassFailed = true
            throw e
        } finally {
            connection?.disconnect()
        }
    }

    private fun buildAddress(tags: JSONObject): String {
        val full = tags.optString("addr:full")
        if (full.isNotBlank()) return full

        val streetLine = listOf(
            tags.optString("addr:housenumber"),
            tags.optString("addr:street")
        ).filter { it.isNotBlank() }.joinToString(" ")

        return listOf(
            streetLine,
            tags.optString("addr:suburb"),
            tags.optString("addr:city"),
            tags.optString("addr:postcode")
        ).filter { it.isNotBlank() }.joinToString(", ")
    }

    private fun getAdminPlaces(): List<Place> {
        val context = context ?: return emptyList()

        val token = context.getSharedPreferences(
            PREFS_NAME,
            Context.MODE_PRIVATE
        ).getString(TOKEN_KEY, null)
            ?.removePrefix("Bearer ")
            ?.trim()

        if (token.isNullOrBlank()) {
            Log.w(TAG, "No login token found. Check app_prefs and token.")
            return emptyList()
        }

        var connection: HttpURLConnection? = null

        return try {
            val url = URL("$API_BASE_URL$ADMIN_ENDPOINT")

            connection =
                (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 10000
                    setRequestProperty("Accept", "application/json")
                    setRequestProperty("Authorization", "Bearer $token")
                }

            val status = connection.responseCode

            if (status !in 200..299) {
                val errorText = try {
                    connection.errorStream?.bufferedReader()?.use {
                        it.readText()
                    }.orEmpty()
                } catch (_: Exception) {
                    ""
                }

                throw java.io.IOException(
                    "Admin API HTTP $status: ${errorText.take(300)}"
                )
            }

            val body = connection.inputStream.bufferedReader().use {
                it.readText()
            }

            val root = JSONObject(body)
            val centers = root.optJSONArray("centers")

            if (centers == null) {
                Log.w(TAG, "Admin API response does not contain a centers array")
                emptyList()
            } else {
                val places = mutableListOf<Place>()

                for (i in 0 until centers.length()) {
                    val item = centers.optJSONObject(i) ?: continue

                    val name = item.optString("name").trim()
                    val latitude = item.optDouble("latitude", Double.NaN)
                    val longitude = item.optDouble("longitude", Double.NaN)
                    val address = item.optString("address", "").trim()

                    if (
                        name.isBlank() ||
                        !latitude.isFinite() ||
                        !longitude.isFinite()
                    ) {
                        Log.w(TAG, "Skipping invalid admin donation centre at index $i")
                        continue
                    }

                    places.add(
                        Place(
                            name = name,
                            address = address,
                            latitude = latitude,
                            longitude = longitude,
                            source = "Admin donation centre"
                        )
                    )
                }

                Log.d(TAG, "Loaded ${places.size} admin donation centres")
                places
            }
        } catch (e: Exception) {
            adminFailed = true
            Log.e(TAG, "Failed to load admin donation centres: ${e.message}", e)
            emptyList()
        } finally {
            connection?.disconnect()
        }
    }

    // Showing results
    private fun displayPlaces(category: String, places: List<Place>) {
        // Remove only the place markers, never the blue "You are here" dot.
        placeMarkers.forEach { map.overlays.remove(it) }
        placeMarkers.clear()

        places.forEach { place ->
            val marker = Marker(map)
            marker.position = GeoPoint(place.latitude, place.longitude)
            marker.title = place.name
            marker.snippet = place.address.ifBlank { "Tap to look up address" }
            marker.relatedObject = place
            marker.setAnchor(
                Marker.ANCHOR_CENTER,
                Marker.ANCHOR_BOTTOM
            )
            marker.setOnMarkerClickListener { m, _ ->
                showPlaceDetails(place, m)
                true
            }
            placeMarkers.add(marker)
            map.overlays.add(marker)
        }

        // Keep the blue dot on top and redraw the map.
        bringMyLocationToFront()

        if (places.isEmpty()) {
            resultName.text = if (overpassFailed && adminFailed) {
                "Search temporarily unavailable"
            } else {
                "No places found"
            }

            resultInfo.text = when {
                overpassFailed && adminFailed ->
                    "Both place search and admin centre requests failed. Check Logcat."

                overpassFailed ->
                    "Place search is busy. Tap Nearby to try again."

                adminFailed ->
                    "Admin donation centres could not be loaded."

                else ->
                    "No $category places were found within " +
                            "${formatDistance(SEARCH_RADIUS_METRES.toDouble())} of your location."
            }

            return
        }

        val nearest = places.minByOrNull {
            distanceMetres(
                currentLatitude,
                currentLongitude,
                it.latitude,
                it.longitude
            )
        }

        if (nearest != null) {
            resultName.text = nearest.name
            resultInfo.text =
                "${formatDistance(distanceMetres(currentLatitude, currentLongitude, nearest.latitude, nearest.longitude))} away\n" +
                        "${nearest.address.ifBlank { "Tap its marker to look up the address" }}\n" +
                        "${places.size} places found"
        }
    }

    private fun findNearestPlace() {
        if (placeMarkers.isEmpty()) {
            Toast.makeText(
                requireContext(),
                "Search for places first",
                Toast.LENGTH_SHORT
            ).show()
            return
        }

        val nearest = placeMarkers.minByOrNull { marker ->
            distanceMetres(
                currentLatitude,
                currentLongitude,
                marker.position.latitude,
                marker.position.longitude
            )
        } ?: return

        map.controller.animateTo(nearest.position)

        val place = nearest.relatedObject as? Place
        if (place != null) {
            showPlaceDetails(place, nearest)
        } else {
            nearest.showInfoWindow()
        }
    }

    private fun lookupAddress(latitude: Double, longitude: Double): String {
        val fallback = "Address not available (%.5f, %.5f)"
            .format(Locale.US, latitude, longitude)

        val ctx = context ?: return fallback
        if (!Geocoder.isPresent()) return fallback

        return try {
            @Suppress("DEPRECATION")
            val results = Geocoder(ctx, Locale.getDefault())
                .getFromLocation(latitude, longitude, 1)

            results?.firstOrNull()?.getAddressLine(0)
                ?.takeIf { it.isNotBlank() }
                ?: fallback
        } catch (e: Exception) {
            Log.e(TAG, "Address lookup failed: ${e.message}")
            fallback
        }
    }

    private fun showPlaceDetails(place: Place, marker: Marker) {
        val distance = formatDistance(
            distanceMetres(
                currentLatitude,
                currentLongitude,
                place.latitude,
                place.longitude
            )
        )

        resultName.text = place.name

        fun show(address: String) {
            marker.snippet = address
            resultInfo.text = "$distance away\n$address"
            marker.showInfoWindow()
        }

        if (place.address.isNotBlank()) {
            show(place.address)
            return
        }

        val key = "%.5f,%.5f".format(Locale.US, place.latitude, place.longitude)
        val known = addressLookupCache[key]
        if (known != null) {
            show(known)
            return
        }

        show("Looking up address...")

        thread(name = "AddressLookup") {
            val address = lookupAddress(place.latitude, place.longitude)
            addressLookupCache[key] = address

            activity?.runOnUiThread {
                if (isAdded && placeMarkers.contains(marker)) {
                    show(address)
                }
            }
        }
    }

    private fun distanceMetres(
        lat1: Double,
        lon1: Double,
        lat2: Double,
        lon2: Double
    ): Double {
        val results = FloatArray(1)

        Location.distanceBetween(
            lat1,
            lon1,
            lat2,
            lon2,
            results
        )

        return results[0].toDouble()
    }

    private fun formatDistance(metres: Double): String {
        return if (metres < 1000) {
            "${metres.roundToInt()} m"
        } else {
            String.format(Locale.getDefault(), "%.1f km", metres / 1000)
        }
    }

    // Lifecycle

    override fun onResume() {
        super.onResume()
        if (::map.isInitialized) {
            map.onResume()
        }
    }

    override fun onPause() {
        if (::map.isInitialized) {
            map.onPause()
        }
        super.onPause()
    }

    override fun onDestroyView() {
        searchGeneration.incrementAndGet()
        stopLocationUpdates()

        // The map view is about to be destroyed, so forget everything tied to it.
        placeMarkers.clear()
        myLocationMarker = null
        placeCache.clear()
        hasSearched = false

        if (::map.isInitialized) {
            map.onDetach()
        }

        locationManager = null
        super.onDestroyView()
    }

    private data class Place(
        val name: String,
        val address: String,
        val latitude: Double,
        val longitude: Double,
        val source: String
    )
}