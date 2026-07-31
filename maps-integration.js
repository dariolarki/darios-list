(function initDariosMaps(global) {
  "use strict";

  const DEFAULT_CENTER = Object.freeze({ lat: 45.5152, lng: -122.6784 });
  const DEFAULT_ZOOM = 11;
  const DEFAULT_TIMEOUT_MS = 15000;
  const DEFAULT_VERSION = "weekly";
  const GOOGLE_CACHE_SOURCE = "google_cache";
  const GOOGLE_COORDINATE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

  const CORE_PLACE_FIELDS = Object.freeze([
    "businessStatus",
    "formattedAddress",
    "googleMapsURI",
    "location",
    "primaryType",
  ]);

  const FULL_PLACE_FIELDS = Object.freeze([
    ...CORE_PLACE_FIELDS,
    "currentOpeningHours",
    "nationalPhoneNumber",
    "photos",
    "rating",
    "regularOpeningHours",
    "userRatingCount",
    "websiteURI",
  ]);

  const ALLOWED_PLACE_FIELDS = new Set(FULL_PLACE_FIELDS);
  const TRUSTED_COORDINATE_SOURCES = new Set([
    "apple",
    "first_party",
    "manual",
    GOOGLE_CACHE_SOURCE,
  ]);
  const TRAVEL_MODES = new Set(["driving", "walking", "bicycling", "transit", "two-wheeler"]);

  const runtime = {
    apiPromise: null,
    coreLibrariesPromise: null,
    placesLibraryPromise: null,
    placeDetailPromises: new Map(),
    phase: "idle",
    lastError: null,
    config: {
      apiKey: "",
      mapId: "",
      version: DEFAULT_VERSION,
    },
  };

  class DariosMapsError extends Error {
    constructor(code, message, cause) {
      super(message);
      this.name = "DariosMapsError";
      this.code = code;
      if (cause) this.cause = cause;
    }
  }

  function readPageConfig() {
    const config = global.DARIOS_LIST_CONFIG || {};
    return {
      apiKey: String(config.googleMapsApiKey || "").trim(),
      mapId: String(config.googleMapId || "").trim(),
    };
  }

  function configure(options = {}) {
    const currentConfig = effectiveConfig();
    runtime.config = {
      apiKey: String(options.apiKey ?? currentConfig.apiKey).trim(),
      mapId: String(options.mapId ?? currentConfig.mapId).trim(),
      version: String(options.version || currentConfig.version || DEFAULT_VERSION).trim(),
    };
    return getStatus();
  }

  function publicError(error) {
    if (!error) return null;
    return Object.freeze({
      code: error.code || "MAPS_ERROR",
      message: error.message || "Google Maps could not be loaded.",
    });
  }

  function getStatus() {
    const config = effectiveConfig();
    return Object.freeze({
      phase: runtime.phase,
      configured: Boolean(config.apiKey),
      hasMapId: Boolean(config.mapId),
      error: publicError(runtime.lastError),
    });
  }

  function effectiveConfig() {
    const pageConfig = readPageConfig();
    return {
      apiKey: runtime.config.apiKey || pageConfig.apiKey,
      mapId: runtime.config.mapId || pageConfig.mapId,
      version: runtime.config.version || DEFAULT_VERSION,
    };
  }

  function setFailure(error) {
    const normalized =
      error instanceof DariosMapsError
        ? error
        : new DariosMapsError("MAPS_LOAD_FAILED", "Google Maps could not be loaded.", error);
    runtime.phase = "failed";
    runtime.lastError = normalized;
    return normalized;
  }

  function waitForExistingScript(script, timeoutMs) {
    return new Promise((resolve, reject) => {
      let finished = false;
      const timeout = global.setTimeout(() => {
        finish(
          reject,
          new DariosMapsError(
            "MAPS_LOAD_TIMEOUT",
            "Google Maps did not finish loading before the timeout.",
          ),
        );
      }, timeoutMs);

      function finish(callback, value) {
        if (finished) return;
        finished = true;
        global.clearTimeout(timeout);
        script.removeEventListener("load", handleLoad);
        script.removeEventListener("error", handleError);
        callback(value);
      }

      function handleLoad() {
        if (global.google?.maps?.importLibrary) {
          finish(resolve);
        } else {
          finish(
            reject,
            new DariosMapsError(
              "MAPS_IMPORT_LIBRARY_MISSING",
              "Google Maps loaded without importLibrary support.",
            ),
          );
        }
      }

      function handleError() {
        finish(
          reject,
          new DariosMapsError("MAPS_SCRIPT_FAILED", "The Google Maps script failed to load."),
        );
      }

      script.addEventListener("load", handleLoad, { once: true });
      script.addEventListener("error", handleError, { once: true });
    });
  }

  function loadMapsApi(options = {}) {
    if (global.google?.maps?.importLibrary) return Promise.resolve();
    if (runtime.apiPromise) return runtime.apiPromise;

    const config = effectiveConfig();
    if (!config.apiKey) {
      const error = setFailure(
        new DariosMapsError(
          "MISSING_API_KEY",
          "A browser-restricted Google Maps API key is not configured.",
        ),
      );
      return Promise.reject(error);
    }

    runtime.phase = "loading";
    runtime.lastError = null;
    const timeoutMs = positiveNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS);
    const existingScript = document.querySelector(
      'script[data-darios-maps-api], script[data-google-maps="true"]',
    );

    if (existingScript) {
      runtime.apiPromise = waitForExistingScript(existingScript, timeoutMs).catch((error) => {
        runtime.apiPromise = null;
        throw setFailure(error);
      });
      return runtime.apiPromise;
    }

    runtime.apiPromise = new Promise((resolve, reject) => {
      const callbackName = `__dariosMapsReady_${Date.now().toString(36)}`;
      const script = document.createElement("script");
      let finished = false;
      const timeout = global.setTimeout(() => {
        finish(
          reject,
          new DariosMapsError(
            "MAPS_LOAD_TIMEOUT",
            "Google Maps did not finish loading before the timeout.",
          ),
        );
      }, timeoutMs);

      function cleanup() {
        global.clearTimeout(timeout);
        try {
          delete global[callbackName];
        } catch {
          global[callbackName] = undefined;
        }
      }

      function finish(callback, value) {
        if (finished) return;
        finished = true;
        cleanup();
        callback(value);
      }

      global[callbackName] = () => {
        if (!global.google?.maps?.importLibrary) {
          finish(
            reject,
            new DariosMapsError(
              "MAPS_IMPORT_LIBRARY_MISSING",
              "Google Maps loaded without importLibrary support.",
            ),
          );
          return;
        }
        finish(resolve);
      };

      const params = new URLSearchParams({
        key: config.apiKey,
        loading: "async",
        callback: callbackName,
        v: config.version,
        auth_referrer_policy: "origin",
      });
      if (config.mapId) params.set("map_ids", config.mapId);

      script.async = true;
      script.dataset.dariosMapsApi = "true";
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.addEventListener(
        "error",
        () =>
          finish(
            reject,
            new DariosMapsError("MAPS_SCRIPT_FAILED", "The Google Maps script failed to load."),
          ),
        { once: true },
      );
      document.head.append(script);
    }).catch((error) => {
      runtime.apiPromise = null;
      throw setFailure(error);
    });

    return runtime.apiPromise;
  }

  async function loadCoreLibraries(options = {}) {
    if (runtime.coreLibrariesPromise) return runtime.coreLibrariesPromise;

    runtime.coreLibrariesPromise = (async () => {
      await loadMapsApi(options);
      try {
        const [mapsLibrary, markerLibrary] = await Promise.all([
          global.google.maps.importLibrary("maps"),
          global.google.maps.importLibrary("marker"),
        ]);
        runtime.phase = "ready";
        runtime.lastError = null;
        return Object.freeze({
          Map: mapsLibrary.Map,
          InfoWindow: mapsLibrary.InfoWindow,
          AdvancedMarkerElement: markerLibrary.AdvancedMarkerElement,
          PinElement: markerLibrary.PinElement,
        });
      } catch (error) {
        throw new DariosMapsError(
          "MAPS_LIBRARY_FAILED",
          "The Google Maps map or marker library could not be loaded.",
          error,
        );
      }
    })().catch((error) => {
      runtime.coreLibrariesPromise = null;
      throw setFailure(error);
    });

    return runtime.coreLibrariesPromise;
  }

  async function loadPlacesLibrary(options = {}) {
    if (runtime.placesLibraryPromise) return runtime.placesLibraryPromise;

    runtime.placesLibraryPromise = (async () => {
      await loadMapsApi(options);
      try {
        const placesLibrary = await global.google.maps.importLibrary("places");
        runtime.phase = "ready";
        runtime.lastError = null;
        return Object.freeze({ Place: placesLibrary.Place });
      } catch (error) {
        throw new DariosMapsError(
          "PLACES_LIBRARY_FAILED",
          "The Google Places library could not be loaded.",
          error,
        );
      }
    })().catch((error) => {
      runtime.placesLibraryPromise = null;
      throw setFailure(error);
    });

    return runtime.placesLibraryPromise;
  }

  async function safeLoad(options = {}) {
    try {
      const coreLibraries = await loadCoreLibraries(options);
      const placesLibrary = options.includePlaces ? await loadPlacesLibrary(options) : {};
      const libraries = Object.freeze({ ...coreLibraries, ...placesLibrary });
      return Object.freeze({ ok: true, libraries, status: getStatus() });
    } catch (error) {
      return Object.freeze({ ok: false, error: publicError(error), status: getStatus() });
    }
  }

  async function createMap(element, options = {}) {
    if (!(element instanceof Element)) {
      throw new DariosMapsError("INVALID_MAP_ELEMENT", "A valid map container is required.");
    }
    const config = effectiveConfig();
    const { Map } = await loadCoreLibraries(options);
    const mapOptions = {
      center: options.center || DEFAULT_CENTER,
      zoom: positiveNumber(options.zoom, DEFAULT_ZOOM),
      clickableIcons: false,
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      ...options.mapOptions,
    };
    if (config.mapId) mapOptions.mapId = config.mapId;
    return new Map(element, mapOptions);
  }

  function isFiniteCoordinate(value) {
    return Number.isFinite(Number(value));
  }

  function isUnexpiredGoogleCoordinate(geo, now = Date.now()) {
    if (geo.source !== GOOGLE_CACHE_SOURCE) return true;
    const expiresAt = Date.parse(geo.expiresAt || "");
    const verifiedAt = Date.parse(geo.verifiedAt || "");
    if (Number.isFinite(expiresAt)) return expiresAt > now;
    return Number.isFinite(verifiedAt) && verifiedAt + GOOGLE_COORDINATE_MAX_AGE_MS > now;
  }

  function validLatLng(lat, lng) {
    const numericLat = Number(lat);
    const numericLng = Number(lng);
    return (
      Number.isFinite(numericLat) &&
      Number.isFinite(numericLng) &&
      numericLat >= -90 &&
      numericLat <= 90 &&
      numericLng >= -180 &&
      numericLng <= 180
    );
  }

  function verifiedCoordinates(place, options = {}) {
    if (!place || typeof place !== "object") return null;
    const now = options.now instanceof Date ? options.now.getTime() : Number(options.now) || Date.now();
    const geo = place.geo && typeof place.geo === "object" ? place.geo : null;

    if (
      geo &&
      validLatLng(geo.lat, geo.lng) &&
      TRUSTED_COORDINATE_SOURCES.has(String(geo.source || "")) &&
      (geo.verified === true || geo.status === "verified") &&
      isUnexpiredGoogleCoordinate(geo, now)
    ) {
      return Object.freeze({ lat: Number(geo.lat), lng: Number(geo.lng) });
    }

    const legacyVerified =
      place.coordinatesVerified === true ||
      place.coordinateStatus === "verified" ||
      place.source === "Apple Maps shared Portland guide";
    if (legacyVerified && validLatLng(place.lat, place.lng)) {
      return Object.freeze({ lat: Number(place.lat), lng: Number(place.lng) });
    }

    return null;
  }

  function hasVerifiedCoordinates(place, options = {}) {
    return Boolean(verifiedCoordinates(place, options));
  }

  async function createAdvancedMarker(options = {}) {
    const placePosition = verifiedCoordinates(options.place);
    const explicitPosition =
      options.positionVerified === true &&
      validLatLng(options.position?.lat, options.position?.lng)
        ? Object.freeze({
            lat: Number(options.position.lat),
            lng: Number(options.position.lng),
          })
        : null;
    const position = placePosition || explicitPosition;
    if (!position || !validLatLng(position.lat, position.lng)) return null;

    const config = effectiveConfig();
    if (!config.mapId && !options.allowMissingMapId) {
      throw new DariosMapsError(
        "MISSING_MAP_ID",
        "A Google map ID is required before creating Advanced Markers.",
      );
    }

    const { AdvancedMarkerElement, PinElement } = await loadCoreLibraries(options);
    const pin = new PinElement({
      background: options.background || "#0a36f5",
      borderColor: options.borderColor || "#fffdf8",
      glyphColor: options.glyphColor || "#fffdf8",
      glyphText: String(options.glyphText || "").slice(0, 2),
      scale: positiveNumber(options.scale, 1),
    });
    const marker = new AdvancedMarkerElement({
      map: options.map || null,
      position,
      title: String(options.title || options.place?.name || "Dario's List place"),
      content: pin.element || pin,
      gmpClickable: options.clickable !== false,
      zIndex: Number.isFinite(Number(options.zIndex)) ? Number(options.zIndex) : undefined,
    });
    if (typeof options.onClick === "function") {
      marker.addListener("click", options.onClick);
    }
    return marker;
  }

  function extractPlaceId(placeOrId) {
    if (typeof placeOrId === "string") return placeOrId.trim();
    if (!placeOrId || typeof placeOrId !== "object") return "";
    return String(
      placeOrId.google?.placeId ||
        placeOrId.googlePlaceId ||
        placeOrId.placeId ||
        "",
    ).trim();
  }

  function resolveFields(options = {}) {
    const profile = options.profile || "core";
    const fields = options.fields || (profile === "full" ? FULL_PLACE_FIELDS : CORE_PLACE_FIELDS);
    if (!Array.isArray(fields) || !fields.length) {
      throw new DariosMapsError("INVALID_PLACE_FIELDS", "At least one Place field is required.");
    }
    const uniqueFields = [...new Set(fields.map((field) => String(field).trim()))].sort();
    if (uniqueFields.includes("*")) {
      throw new DariosMapsError(
        "UNSAFE_PLACE_FIELDS",
        "Wildcard Place fields are not allowed in production.",
      );
    }
    const unsupported = uniqueFields.filter((field) => !ALLOWED_PLACE_FIELDS.has(field));
    if (unsupported.length) {
      throw new DariosMapsError(
        "UNSUPPORTED_PLACE_FIELDS",
        `Unsupported Place fields: ${unsupported.join(", ")}.`,
      );
    }
    return uniqueFields;
  }

  function fetchPlaceDetails(placeOrId, options = {}) {
    const placeId = extractPlaceId(placeOrId);
    if (!placeId) {
      return Promise.reject(
        new DariosMapsError("MISSING_PLACE_ID", "A verified Google Place ID is required."),
      );
    }

    let fields;
    try {
      fields = resolveFields(options);
    } catch (error) {
      return Promise.reject(error);
    }
    const cacheKey = `${placeId}::${fields.join(",")}`;
    if (runtime.placeDetailPromises.has(cacheKey)) {
      return runtime.placeDetailPromises.get(cacheKey);
    }

    const request = (async () => {
      const { Place } = await loadPlacesLibrary(options);
      const place = new Place({ id: placeId });
      try {
        const result = await place.fetchFields({ fields });
        return result?.place || place;
      } catch (error) {
        throw new DariosMapsError(
          "PLACE_DETAILS_FAILED",
          "Live place details are temporarily unavailable.",
          error,
        );
      }
    })();

    runtime.placeDetailPromises.set(cacheKey, request);
    request.catch(() => runtime.placeDetailPromises.delete(cacheKey));
    return request;
  }

  function clearPlaceDetailCache() {
    runtime.placeDetailPromises.clear();
  }

  function serializeAuthorAttribution(attribution) {
    if (!attribution) return null;
    if (typeof attribution === "string") {
      return Object.freeze({ displayName: attribution, uri: "", photoURI: "" });
    }
    return Object.freeze({
      displayName: String(attribution.displayName || ""),
      uri: safeHttpUrl(attribution.uri),
      photoURI: safeHttpUrl(attribution.photoURI),
    });
  }

  function serializePhotoMetadata(photo) {
    if (!photo) return null;
    return Object.freeze({
      widthPx: finiteOrNull(photo.widthPx),
      heightPx: finiteOrNull(photo.heightPx),
      googleMapsURI: safeHttpUrl(photo.googleMapsURI),
      flagContentURI: safeHttpUrl(photo.flagContentURI),
      authorAttributions: Object.freeze(
        (photo.authorAttributions || []).map(serializeAuthorAttribution).filter(Boolean),
      ),
    });
  }

  function freshPhotoUrl(photo, options = {}) {
    if (!photo || typeof photo.getURI !== "function") return "";
    const photoOptions = {};
    if (positiveNumber(options.maxWidth, 0)) photoOptions.maxWidth = Number(options.maxWidth);
    if (positiveNumber(options.maxHeight, 0)) photoOptions.maxHeight = Number(options.maxHeight);
    return safeHttpUrl(photo.getURI(photoOptions));
  }

  function serializeOpeningPoint(point) {
    if (!point) return null;
    return Object.freeze({
      day: finiteOrNull(point.day),
      hour: finiteOrNull(point.hour),
      minute: finiteOrNull(point.minute),
      date: point.date ? String(point.date) : "",
      truncated: Boolean(point.truncated),
    });
  }

  function serializeOpeningHours(hours) {
    if (!hours) return null;
    return Object.freeze({
      weekdayDescriptions: Object.freeze(
        (hours.weekdayDescriptions || []).map((description) => String(description)),
      ),
      periods: Object.freeze(
        (hours.periods || []).map((period) =>
          Object.freeze({
            open: serializeOpeningPoint(period.open),
            close: serializeOpeningPoint(period.close),
          }),
        ),
      ),
    });
  }

  function serializePlaceDetails(place) {
    if (!place) return null;
    const location = place.location;
    const lat = typeof location?.lat === "function" ? location.lat() : location?.lat;
    const lng = typeof location?.lng === "function" ? location.lng() : location?.lng;
    return Object.freeze({
      cachePolicy: "session-only",
      id: String(place.id || ""),
      businessStatus: String(place.businessStatus || ""),
      formattedAddress: String(place.formattedAddress || ""),
      googleMapsURI: safeHttpUrl(place.googleMapsURI),
      primaryType: String(place.primaryType || ""),
      location: validLatLng(lat, lng)
        ? Object.freeze({ lat: Number(lat), lng: Number(lng) })
        : null,
      currentOpeningHours: serializeOpeningHours(place.currentOpeningHours),
      regularOpeningHours: serializeOpeningHours(place.regularOpeningHours),
      nationalPhoneNumber: String(place.nationalPhoneNumber || ""),
      rating: finiteOrNull(place.rating),
      userRatingCount: finiteOrNull(place.userRatingCount),
      websiteURI: safeHttpUrl(place.websiteURI),
      attributions: Object.freeze(
        (place.attributions || []).map(serializeAuthorAttribution).filter(Boolean),
      ),
      photos: Object.freeze((place.photos || []).map(serializePhotoMetadata).filter(Boolean)),
    });
  }

  function verifiedRouteStop(stop) {
    const extractedPlaceId = extractPlaceId(stop);
    const nestedGoogle = stop?.google && typeof stop.google === "object" ? stop.google : null;
    const placeIdVerified =
      (nestedGoogle?.placeId && nestedGoogle.matchStatus === "verified") ||
      (stop?.googlePlaceId && stop.googlePlaceIdVerified === true) ||
      (stop?.placeId && stop.placeIdVerified === true);
    const placeId = placeIdVerified ? extractedPlaceId : "";
    const coordinates = verifiedCoordinates(stop);
    if (!placeId && !coordinates) return null;
    const label = String(stop?.name || stop?.address || "").trim();
    const query = coordinates
      ? `${coordinates.lat},${coordinates.lng}`
      : label || `place_id:${placeId}`;
    return Object.freeze({ query, placeId });
  }

  function buildGoogleRouteUrl(stops, options = {}) {
    if (!Array.isArray(stops) || stops.length < 2) {
      throw new DariosMapsError("INVALID_ROUTE", "A route requires at least two verified stops.");
    }
    if (stops.length > 11) {
      throw new DariosMapsError(
        "ROUTE_TOO_LONG",
        "Google Maps route URLs support at most nine intermediate stops in this app.",
      );
    }

    const verifiedStops = stops.map(verifiedRouteStop);
    const unresolvedIndex = verifiedStops.findIndex((stop) => !stop);
    if (unresolvedIndex !== -1) {
      throw new DariosMapsError(
        "UNVERIFIED_ROUTE_STOP",
        `Route stop ${unresolvedIndex + 1} has no verified Place ID or coordinates.`,
      );
    }

    const mode = String(options.travelMode || "walking").toLowerCase();
    if (!TRAVEL_MODES.has(mode)) {
      throw new DariosMapsError("INVALID_TRAVEL_MODE", `Unsupported travel mode: ${mode}.`);
    }

    const origin = verifiedStops[0];
    const destination = verifiedStops[verifiedStops.length - 1];
    const waypoints = verifiedStops.slice(1, -1);
    const params = new URLSearchParams({
      api: "1",
      origin: origin.query,
      destination: destination.query,
      travelmode: mode,
    });
    if (options.navigate) params.set("dir_action", "navigate");
    if (origin.placeId) params.set("origin_place_id", origin.placeId);
    if (destination.placeId) params.set("destination_place_id", destination.placeId);
    if (waypoints.length) {
      params.set("waypoints", waypoints.map((stop) => stop.query).join("|"));
      if (waypoints.every((stop) => stop.placeId)) {
        params.set("waypoint_place_ids", waypoints.map((stop) => stop.placeId).join("|"));
      }
    }
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function haversineDistance(first, second, options = {}) {
    const a = verifiedCoordinates(first, options);
    const b = verifiedCoordinates(second, options);
    if (!a || !b) return null;

    const earthRadiusMeters = 6371008.8;
    const lat1 = degreesToRadians(a.lat);
    const lat2 = degreesToRadians(b.lat);
    const deltaLat = degreesToRadians(b.lat - a.lat);
    const deltaLng = degreesToRadians(b.lng - a.lng);
    const sinLat = Math.sin(deltaLat / 2);
    const sinLng = Math.sin(deltaLng / 2);
    const value =
      sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    const meters =
      earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
    if (options.unit === "kilometers") return meters / 1000;
    if (options.unit === "miles") return meters / 1609.344;
    return meters;
  }

  function sortByVerifiedDistance(origin, places, options = {}) {
    if (!Array.isArray(places)) return [];
    return places
      .map((place) => ({ place, distance: haversineDistance(origin, place, options) }))
      .filter((item) => item.distance !== null)
      .sort((a, b) => a.distance - b.distance);
  }

  function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function finiteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function safeHttpUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), global.location?.href);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch {
      return "";
    }
  }

  configure();

  global.DariosMaps = Object.freeze({
    version: "1.0.0",
    CORE_PLACE_FIELDS,
    FULL_PLACE_FIELDS,
    DariosMapsError,
    configure,
    getStatus,
    safeLoad,
    loadCoreLibraries,
    loadPlacesLibrary,
    createMap,
    createAdvancedMarker,
    verifiedCoordinates,
    hasVerifiedCoordinates,
    extractPlaceId,
    fetchPlaceDetails,
    clearPlaceDetailCache,
    serializeAuthorAttribution,
    serializePhotoMetadata,
    serializePlaceDetails,
    freshPhotoUrl,
    buildGoogleRouteUrl,
    haversineDistance,
    sortByVerifiedDistance,
  });
})(window);
