# Dario's List

A local-first, editorial Portland field guide with a production-safe public mode and a browser-local owner mode.

The default list now includes the pruned original prototype places, manually added spots, and records from the shared Apple Maps Portland guide fetched on May 26, 2026. Apple returned data for 35 of the guide's 36 refs; one stale/empty ref is intentionally omitted from `places.js`. Four duplicate imported/original pairs were merged into canonical records, preserving Dario’s notes while adding the verified location fields. The current seed has 101 places.

## Current Functionality

- Search across names, notes, neighborhoods, tags, moods, moments, and status.
- Filter by category, neighborhood, mood, moment, price, and saved/status.
- Sort by curated order, name, neighborhood, category, price, saved first, or newest.
- Switch between list, map-focused, and data-derived neighborhood guide views.
- Save places and mark visits locally in the browser.
- Share deep links to individual place details.
- Open detailed field notes with provider-aware live-data states, provenance, safe links, and verified-distance pairings.
- Build a geographically coherent short route from the active filters, copy it as text, and open it in Google Maps only when every stop is verified.
- Use an installable offline shell, a dedicated offline page, and a plain-language data/privacy page.
- Keep add, edit, delete, import, and export controls in an explicitly enabled owner mode.
- Export all places as JSON.
- Import JSON or paste rough text into the bulk importer.
- Use Google Maps Advanced Markers when both `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAP_ID` are configured, with the clearly labeled stylized map as a fallback.
- Run deterministic schema/security validation and neighborhood-artifact drift checks with `npm run check`.

## Public and owner modes

`config.js` enables `editorMode: true` for local work. Production builds default to public, read-only mode. Set `EDITOR_MODE=true` only for a private owner build:

```sh
EDITOR_MODE=true npm run build
```

This flag is a presentation boundary, not authentication. Do not deploy an owner build as a protected admin system. Owner changes are browser-local and should be exported as JSON before clearing site data or changing devices.

## Build and verification

```sh
npm run check
npm run build
```

`npm run check` hard-fails unsafe schema/URL problems and reports editorial, duplicate, coordinate, and publication-readiness gaps without inventing fixes. `npm run build` creates `dist/`, writes deployment configuration from environment variables, and copies the app, generated guide data, offline shell, privacy page, manifest, service worker, and map integration.

Before a public launch:

1. Review the duplicate-entity report and merge only after choosing the canonical records.
2. Replace drafting prompts with Dario-authored notes.
3. Verify exact coordinates and Google Place IDs through reviewed candidate matching; never accept first-result search matches automatically.
4. Configure a restricted Maps browser key, map ID, quotas, alerts, and production origin.
5. Test the final deployed origin on desktop and mobile, including live place details, attribution, offline reload, deep links, and response headers.

## Google Maps and Places foundation

`maps-integration.js` exposes the production integration as `window.DariosMaps`. It is intentionally separate from the current application entrypoint so the UI can migrate without coupling place-data policy, Google loading, or marker behavior to the view code.

The module provides:

- Lazy Maps JavaScript API loading and on-demand `importLibrary("maps")`, `importLibrary("marker")`, and `importLibrary("places")` calls.
- `AdvancedMarkerElement` and `PinElement` creation with a production map ID.
- Strict verified-coordinate helpers. The Google map path must never convert the stylized `x` and `y` fields into latitude/longitude.
- Session-only Promise caching for `Place.fetchFields()`. The module never writes live Google Place details to local storage.
- A conservative core Place Details field set and an explicit full-detail field set. Wildcard fields are rejected.
- Google Maps directions URLs built only from verified Google Place IDs or verified coordinates.
- Haversine distance and verified-distance sorting.
- Serializable place/photo/author attribution metadata without downloading or caching photo pixels.
- Typed failure codes plus `safeLoad()` and `getStatus()` for non-blocking fallback UI.

Load `config.js` before `maps-integration.js`, then call the module from the application:

```html
<script src="./config.js"></script>
<script src="./maps-integration.js"></script>
```

```js
const result = await window.DariosMaps.safeLoad({ includePlaces: false });
if (!result.ok) {
  // Keep the local stylized map or another honest unavailable state visible.
}
```

### Cloud project and environment

The repository commits an empty `config.js` for local development. `npm run build` generates the deployed file from:

- `GOOGLE_MAPS_API_KEY`: public browser key used by the Maps JavaScript API and Places Library.
- `GOOGLE_MAP_ID`: production web map ID required by Advanced Markers.

Enable billing and these APIs in the same Google Cloud project:

1. **Maps JavaScript API**
2. **Places API (New)**

Enable **Geocoding API** or **Routes API** only when the application actually calls them. The current foundation uses key-free [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started) for directions and does not need either API for that feature.

Official setup and loading references:

- [Load the Maps JavaScript API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api)
- [Advanced Marker migration](https://developers.google.com/maps/documentation/javascript/advanced-markers/migration)
- [Add an Advanced Marker and configure a map ID](https://developers.google.com/maps/documentation/javascript/advanced-markers/add-marker)
- [Place Details with `Place.fetchFields()`](https://developers.google.com/maps/documentation/javascript/place-details)
- [Place data fields and their billing tiers](https://developers.google.com/maps/documentation/javascript/place-class-data-fields)

### API-key restrictions

Browser keys are visible in downloaded JavaScript by design. Before production:

1. Apply a **Websites** application restriction to the exact production origins, including both apex and `www` domains if both are served.
2. Apply API restrictions for **Maps JavaScript API** and **Places API (New)** only.
3. Use a separate low-quota key for local development and staging.
4. Do not authorize the production key for a broad `https://*.vercel.app/*` wildcard.
5. Set per-API quota limits and alerts, then create a Cloud Billing budget. A budget alert does not stop spend; an API quota can stop requests.
6. Consider [Firebase App Check for the Place class](https://developers.google.com/maps/documentation/javascript/places-app-check) before a public launch.

See Google's [API security best practices](https://developers.google.com/maps/api-security-best-practices) and [cost-management guidance](https://developers.google.com/maps/billing-and-pricing/manage-costs).

### Data and caching policy

Persist Dario's editorial content separately from Google live content. A production place record may persist a Google Place ID:

```js
google: {
  placeId: "ChIJ...",
  matchStatus: "verified",
  matchedAt: "2026-07-30T00:00:00.000Z",
  placeIdRefreshedAt: "2026-07-30T00:00:00.000Z"
}
```

Google Place IDs may be stored and should be refreshed when older than 12 months. Live Google hours, ratings, rating counts, phone numbers, websites, status, and photo data stay in the current browser session and are fetched only when needed.

If coordinates come from Google Places or Geocoding, they must have a verification marker and a cache expiry no later than 30 days:

```js
geo: {
  lat: 45.5152,
  lng: -122.6784,
  source: "google_cache",
  status: "verified",
  verifiedAt: "2026-07-30T00:00:00.000Z",
  expiresAt: "2026-08-29T00:00:00.000Z"
}
```

Coordinates from a durable authorized source should identify that source (`apple`, `first_party`, or `manual`) and use `status: "verified"`. Unresolved records do not receive a Google marker. The existing `x` and `y` values remain valid only for the clearly labeled stylized fallback; they are never production latitude/longitude.

Policy references:

- [Place ID storage and refresh](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Maps JavaScript API policies and attribution](https://developers.google.com/maps/documentation/javascript/policies)
- [Places API policies and caching restrictions](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Current Google Maps Platform service-specific terms](https://cloud.google.com/maps-platform/terms/maps-service-terms)

### Live details and photos

Use the core profile for lightweight detail/map state and the full profile only after a user opens a place:

```js
const livePlace = await window.DariosMaps.fetchPlaceDetails(place, {
  profile: "full",
});
const displayData = window.DariosMaps.serializePlaceDetails(livePlace);
```

The full profile requests current and regular opening hours, rating and rating count, business status, phone, website, formatted address, Google Maps URI, and photo metadata. It does not request reviews, AI summaries, atmosphere fields, or `["*"]`.

`serializePlaceDetails()` and `serializePhotoMetadata()` deliberately omit photo pixel URLs. Generate a fresh display URL only when the image will render:

```js
const photoUrl = window.DariosMaps.freshPhotoUrl(livePlace.photos[0], {
  maxWidth: 1200,
});
```

Do not persist the returned URL or image. Display the photo's available author attribution near the expanded image, retain its Google Maps source link and reporting link, and render every returned Place attribution. See [Place Photos requirements](https://developers.google.com/maps/documentation/javascript/place-photos).

### Pricing and quotas

Google Maps Platform pricing changes over time. Check the [current official pricing table](https://developers.google.com/maps/billing-and-pricing/pricing) before launch. At the time this foundation was written, the monthly free usage caps and first paid tier per 1,000 events included:

- Dynamic Maps: 10,000 free, then $7.
- Place Details Essentials: 10,000 free, then $5.
- Place Details Pro: 5,000 free, then $17.
- Place Details Enterprise: 1,000 free, then $20.
- Place Details photo pixel loads: 1,000 free, then $7.
- Geocoding: 10,000 free, then $5.

Hours, phone, rating, and website fields can move a Place Details request into the Enterprise tier. Fetch the full profile only after explicit user interaction, reuse the session Promise cache, never request all fields, and set conservative production quotas.

## Bulk Paste Format

The importer accepts one place per line.

```text
Name
Name | Category | Neighborhood | Note
Name - Category - Neighborhood - Note
Name | Category | Neighborhood | tag, tag, tag
```

If the line includes a Maps URL, the importer stores it as `mapsUrl`.

## Place Fields

Each place can include:

- `name`
- `category`
- `neighborhood`
- `price`
- `status`
- `moments`
- `moods`
- `tags`
- `best`
- `avoid`
- `order`
- `note`
- `address`
- `mapsUrl`
- `website`
- `phone`
- `appleCategory`
- `source`
- `sourceRef`
- `lat` and `lng`
- `x` and `y` map position

The current Portland map is stylized, so `x` and `y` remain display positions even when exact `lat` and `lng` coordinates are present.
