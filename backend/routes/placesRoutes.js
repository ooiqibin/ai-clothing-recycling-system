const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const DEFAULT_RADIUS_METRES = 5000;
const MIN_RADIUS_METRES = 500;
const MAX_RADIUS_METRES = 10000;
const FRESH_MS = 7 * 24 * 60 * 60 * 1000; // complete results stay fresh for 7 days
const PARTIAL_FRESH_MS = 10 * 60 * 1000; // results missing the name search: retry after 10 min
const PER_SERVER_TIMEOUT_MS = 12000;
const QUERY_TIMEOUT_S = 10;
const USER_AGENT =
  'ClothingRecycleFYP/1.0 (Coventry University student project; contact: ooiqibin2004@gmail.com)';

const NAME_WORDS =
  'yayasan|persatuan|pertubuhan|foundation|charity|society|NGO|Red Crescent|Bulan Sabit|慈善|基金会|协会';

// "main" is fast and always runs. "extra" is a heavier bonus search.
const SEARCHES = {
  ngo: {
    main: ['["office"~"^(ngo|charity|association|foundation|non_profit)$"]'],
    extra: [
      `["name"~"${NAME_WORDS}",i]["shop"!~"."]["amenity"!~"^(restaurant|cafe|fast_food|bank|school|kindergarten|college|university|place_of_worship|social_facility)$"]`,
    ],
  },
  thrift: {
    main: ['["shop"="second_hand"]', '["shop"="charity"]'],
    extra: [],
  },
  recycling: {
    main: ['["amenity"="recycling"]', '["recycling_type"]'],
    extra: [],
  },
};

// Saved results survive restarts. The ".data" extension is deliberate:
// nodemon restarts on .json changes, which would restart the server
// every time a new result is saved.
const CACHE_FILE = path.join(__dirname, '..', 'places-cache.data');
let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
} catch {
  cache = {};
}

function saveCache() {
  fs.writeFile(CACHE_FILE, JSON.stringify(cache), (err) => {
    if (err) console.error('Cache save error:', err.message);
  });
}

function buildQuery(filters, lat, lon, radius) {
  const around = `around:${radius},${lat},${lon}`;
  const lines = filters.map((f) => `nwr(${around})${f};`).join('\n');
  return `[out:json][timeout:${QUERY_TIMEOUT_S}];\n(\n${lines}\n);\nout center;`;
}

async function fetchFromOverpass(query, servers) {
  let lastError;

  for (const url of servers) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json',
        },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(PER_SERVER_TIMEOUT_MS),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const json = await response.json();
      if (!Array.isArray(json.elements)) throw new Error('No elements array');

      return json.elements;
    } catch (err) {
      lastError = err;
      console.warn(`Overpass failed (${url}): ${err.message}`);
    }
  }

  throw lastError || new Error('All Overpass servers failed');
}

async function lookup(category, lat, lon, radius) {
  const search = SEARCHES[category];

  // The fast search must succeed. If it fails, the whole lookup fails.
  const mainElements = await fetchFromOverpass(
    buildQuery(search.main, lat, lon, radius),
    OVERPASS_URLS
  );

  let extraElements = [];
  let partial = false;

  if (search.extra.length > 0) {
    try {
      extraElements = await fetchFromOverpass(
        buildQuery(search.extra, lat, lon, radius),
        OVERPASS_URLS.slice(0, 2)
      );
    } catch (err) {
      partial = true;
      console.warn(`Extra name search skipped: ${err.message}`);
    }
  }

  // Combine both searches and remove duplicates.
  const seen = new Set();
  const elements = [];
  for (const e of [...mainElements, ...extraElements]) {
    const id = `${e.type}:${e.id}`;
    if (seen.has(id)) continue;
    seen.add(id);
    elements.push({
      type: e.type,
      id: e.id,
      lat: e.lat,
      lon: e.lon,
      center: e.center,
      tags: e.tags,
    });
  }

  return { data: { elements }, partial };
}

// If two requests ask for the same thing at once, only one goes out.
const inFlight = new Map();

router.get('/places', async (req, res) => {
  const category = String(req.query.category || '').toLowerCase();
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);

  let radius = Number(req.query.radius);
  if (!Number.isFinite(radius)) radius = DEFAULT_RADIUS_METRES;
  radius = Math.round(Math.min(MAX_RADIUS_METRES, Math.max(MIN_RADIUS_METRES, radius)));

  if (!SEARCHES[category] || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res
      .status(400)
      .json({ message: 'category (NGO, Thrift, Recycling), lat and lon are required' });
  }

  // Round to about 110 m so nearby requests share one saved result.
  const rLat = lat.toFixed(3);
  const rLon = lon.toFixed(3);
  const key = `v5:${category}:${rLat}:${rLon}:${radius}`;

  const hit = cache[key];
  const maxAge = hit && hit.partial ? PARTIAL_FRESH_MS : FRESH_MS;
  if (hit && Date.now() - hit.savedAt < maxAge) {
    res.set('X-Cache', hit.partial ? 'fresh-partial' : 'fresh');
    return res.json(hit.data);
  }

  try {
    if (!inFlight.has(key)) {
      const promise = lookup(category, rLat, rLon, radius).finally(() =>
        inFlight.delete(key)
      );
      inFlight.set(key, promise);
    }

    const { data, partial } = await inFlight.get(key);
    cache[key] = { savedAt: Date.now(), data, partial };
    saveCache();

    res.set('X-Cache', partial ? 'miss-partial' : 'miss');
    return res.json(data);
  } catch (err) {
    // Old saved results are better than an error.
    if (hit) {
      res.set('X-Cache', 'stale');
      return res.json(hit.data);
    }

    console.error('Places lookup failed:', err.message);
    return res
      .status(503)
      .json({ message: 'Place search is busy. Please try again shortly.' });
  }
});

module.exports = router;