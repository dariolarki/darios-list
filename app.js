const STORAGE_KEY = "darios-list.places.v1";
const SAVED_KEY = "darios-list.saved.v1";
const VIEW_KEY = "darios-list.view.v1";

const palette = [
  ["#8b4a2f", "#d98f56"],
  ["#2f5f8f", "#71a7c9"],
  ["#4f6f52", "#a7b75c"],
  ["#bd3f2d", "#eaa25f"],
  ["#6d578f", "#c49ad6"],
  ["#b87926", "#e5c46b"],
];

const seedPlaces = window.DARIOS_LIST_PLACES || [];
const appConfig = window.DARIOS_LIST_CONFIG || {};
const portlandCenter = { lat: 45.5152, lng: -122.6784 };
const approximateMapBounds = {
  north: 45.64,
  south: 45.32,
  west: -122.96,
  east: -122.48,
};

const els = {
  visibleCount: document.querySelector("#visibleCount"),
  savedCount: document.querySelector("#savedCount"),
  totalCount: document.querySelector("#totalCount"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  neighborhoodFilter: document.querySelector("#neighborhoodFilter"),
  moodFilter: document.querySelector("#moodFilter"),
  momentFilter: document.querySelector("#momentFilter"),
  priceFilter: document.querySelector("#priceFilter"),
  statusFilter: document.querySelector("#statusFilter"),
  sortSelect: document.querySelector("#sortSelect"),
  quickFilters: document.querySelector("#quickFilters"),
  resultHeading: document.querySelector("#resultHeading"),
  clearFiltersButton: document.querySelector("#clearFiltersButton"),
  placeList: document.querySelector("#placeList"),
  emptyState: document.querySelector("#emptyState"),
  googleMap: document.querySelector("#googleMap"),
  mapFallback: document.querySelector("#mapFallback"),
  mapStatus: document.querySelector("#mapStatus"),
  pinLayer: document.querySelector("#pinLayer"),
  routeMood: document.querySelector("#routeMood"),
  routeLength: document.querySelector("#routeLength"),
  routeList: document.querySelector("#routeList"),
  routeStatus: document.querySelector("#routeStatus"),
  shuffleRouteButton: document.querySelector("#shuffleRouteButton"),
  copyRouteButton: document.querySelector("#copyRouteButton"),
  detailDialog: document.querySelector("#detailDialog"),
  detailContent: document.querySelector("#detailContent"),
  closeDetailButton: document.querySelector("#closeDetailButton"),
  addDialog: document.querySelector("#addDialog"),
  addPlaceButton: document.querySelector("#addPlaceButton"),
  addPlaceForm: document.querySelector("#addPlaceForm"),
  placeFormEyebrow: document.querySelector("#placeFormEyebrow"),
  addTitle: document.querySelector("#addTitle"),
  savePlaceButton: document.querySelector("#savePlaceButton"),
  deletePlaceButton: document.querySelector("#deletePlaceButton"),
  cancelAddButton: document.querySelector("#cancelAddButton"),
  importDialog: document.querySelector("#importDialog"),
  bulkImportText: document.querySelector("#bulkImportText"),
  importPreview: document.querySelector("#importPreview"),
  chooseJsonButton: document.querySelector("#chooseJsonButton"),
  cancelImportButton: document.querySelector("#cancelImportButton"),
  commitImportButton: document.querySelector("#commitImportButton"),
  importButton: document.querySelector("#importButton"),
  exportButton: document.querySelector("#exportButton"),
  importFile: document.querySelector("#importFile"),
  listViewButton: document.querySelector("#listViewButton"),
  mapViewButton: document.querySelector("#mapViewButton"),
  contentGrid: document.querySelector(".content-grid"),
};

const state = {
  places: loadPlaces(),
  saved: new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || "[]")),
  filters: {
    query: "",
    category: "all",
    neighborhood: "all",
    mood: "all",
    moment: "all",
    price: "all",
    status: "all",
    sort: "curated",
  },
  routeSeed: 0,
  currentRoute: [],
};

const quickFilters = [
  ["visitor", "Visitor day"],
  ["espresso", "Espresso crawl"],
  ["rainy", "Rain plan"],
  ["date", "Date night"],
  ["run", "Post-run"],
  ["solo", "Solo reset"],
  ["gift", "Gift hunt"],
];

const mapState = {
  map: null,
  infoWindow: null,
  markers: new Map(),
  loader: null,
};

function loadPlaces() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return seedPlaces.map(normalizePlace);
  try {
    return JSON.parse(stored).map(normalizePlace);
  } catch {
    return seedPlaces.map(normalizePlace);
  }
}

function persistPlaces() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.places));
}

function persistSaved() {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...state.saved]));
}

function uniqueValues(key, nested = false) {
  const values = state.places.flatMap((place) => (nested ? place[key] || [] : [place[key]]));
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, label, values) {
  select.innerHTML = [`<option value="all">${label}</option>`, ...values.map((value) => `<option value="${escapeAttr(value)}">${value}</option>`)].join("");
}

function setupFilters() {
  fillSelect(els.categoryFilter, "Any category", uniqueValues("category"));
  fillSelect(els.neighborhoodFilter, "Any neighborhood", uniqueValues("neighborhood"));
  fillSelect(els.moodFilter, "Any mood", uniqueValues("moods", true));
  fillSelect(els.momentFilter, "Any moment", uniqueValues("moments", true));
  fillSelect(els.routeMood, "Any mood", uniqueValues("moods", true));
  renderQuickFilters();
}

function renderQuickFilters() {
  els.quickFilters.innerHTML = quickFilters
    .map(([value, label]) => {
      const active = state.filters.mood === value || state.filters.moment === value;
      return `<button class="chip ${active ? "is-active" : ""}" type="button" data-quick="${value}">${label}</button>`;
    })
    .join("");
}

function placeMatches(place) {
  const query = state.filters.query.trim().toLowerCase();
  const searchable = [
    place.name,
    place.category,
    place.neighborhood,
    place.price,
    place.status,
    place.best,
    place.avoid,
    place.order,
    place.note,
    place.address,
    place.appleCategory,
    place.source,
    place.phone,
    ...place.tags,
    ...place.moods,
    ...place.moments,
  ]
    .join(" ")
    .toLowerCase();

  const matchesQuery = !query || searchable.includes(query);
  const matchesCategory = state.filters.category === "all" || place.category === state.filters.category;
  const matchesNeighborhood = state.filters.neighborhood === "all" || place.neighborhood === state.filters.neighborhood;
  const matchesMood = state.filters.mood === "all" || place.moods.includes(state.filters.mood);
  const matchesMoment = state.filters.moment === "all" || place.moments.includes(state.filters.moment);
  const matchesPrice = state.filters.price === "all" || place.price === state.filters.price;
  const matchesStatus =
    state.filters.status === "all" ||
    (state.filters.status === "saved" && state.saved.has(place.id)) ||
    place.status === state.filters.status;

  return matchesQuery && matchesCategory && matchesNeighborhood && matchesMood && matchesMoment && matchesPrice && matchesStatus;
}

function filteredPlaces() {
  return sortPlaces(state.places.filter(placeMatches));
}

function sortPlaces(places) {
  const sorted = [...places];
  const priceRank = { $: 1, $$: 2, $$$: 3, $$$$: 4 };
  sorted.sort((a, b) => {
    if (state.filters.sort === "name") return a.name.localeCompare(b.name);
    if (state.filters.sort === "neighborhood") return a.neighborhood.localeCompare(b.neighborhood) || a.name.localeCompare(b.name);
    if (state.filters.sort === "category") return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
    if (state.filters.sort === "price") return (priceRank[a.price] || 2) - (priceRank[b.price] || 2) || a.name.localeCompare(b.name);
    if (state.filters.sort === "saved") return Number(state.saved.has(b.id)) - Number(state.saved.has(a.id)) || a.name.localeCompare(b.name);
    if (state.filters.sort === "newest") return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    return (a.rank || 9999) - (b.rank || 9999) || a.name.localeCompare(b.name);
  });
  return sorted;
}

function render() {
  const places = filteredPlaces();
  els.visibleCount.textContent = places.length;
  els.savedCount.textContent = state.saved.size;
  els.totalCount.textContent = state.places.length;
  els.resultHeading.textContent = headingForFilters(places.length);
  els.emptyState.hidden = places.length > 0;
  renderPlaces(places);
  renderMap(places);
  renderRoute();
  renderQuickFilters();
  persistViewState();
}

function headingForFilters(count) {
  const active = Object.entries(state.filters).filter(([, value]) => value && value !== "all");
  if (!active.length) return "All spots";
  if (state.filters.query) return `${count} match${count === 1 ? "" : "es"} for "${state.filters.query}"`;
  const label = active[0][1];
  return `${count} spot${count === 1 ? "" : "s"} for ${label}`;
}

function renderPlaces(places) {
  els.placeList.innerHTML = places
    .map((place, index) => {
      const [a, b] = colorsFor(place);
      const saved = state.saved.has(place.id);
      const tags = place.tags.slice(0, 3).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
      return `
        <article class="place-card" style="--accent-a:${a};--accent-b:${b}">
          <button class="place-art" type="button" data-open="${escapeAttr(place.id)}" aria-label="Open ${escapeAttr(place.name)}"></button>
          <div class="place-body">
            <div class="place-meta">
              <span>${escapeHtml(place.category)}</span>
              <span>${escapeHtml(place.neighborhood)}</span>
              <span>${escapeHtml(place.price)}</span>
              <span>${statusLabel(place.status)}</span>
            </div>
            <h3>${escapeHtml(place.name)}</h3>
            <p class="place-note">${escapeHtml(place.note)}</p>
            <div class="tag-row">${tags}</div>
            <div class="card-actions">
              <button class="save-button ${saved ? "is-saved" : ""}" type="button" data-save="${escapeAttr(place.id)}">
                ${saved ? "Saved" : "Save"}
              </button>
              <button class="text-button" type="button" data-open="${escapeAttr(place.id)}">Details</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderPins(visiblePlaces) {
  const visibleIds = new Set(visiblePlaces.map((place) => place.id));
  els.pinLayer.innerHTML = state.places
    .map((place) => {
      const muted = visibleIds.has(place.id) ? "" : "is-muted";
      const saved = state.saved.has(place.id) ? "is-saved" : "";
      return `
        <button
          class="map-pin ${muted} ${saved}"
          style="left:${place.x}%;top:${place.y}%;--pin:${colorsFor(place)[0]}"
          type="button"
          data-open="${escapeAttr(place.id)}"
          title="${escapeAttr(place.name)}"
          aria-label="Open ${escapeAttr(place.name)}"
        >
          ${escapeHtml(place.category.slice(0, 1))}
        </button>
      `;
    })
    .join("");
}

function renderMap(visiblePlaces) {
  renderPins(visiblePlaces);
  if (!googleMapsApiKey()) {
    showMapFallback("Map preview", "Live Google map turns on when the production key is configured.");
  }
  if (mapState.map) updateGoogleMarkers(visiblePlaces);
}

function googleMapsApiKey() {
  return String(appConfig.googleMapsApiKey || "").trim();
}

async function ensureGoogleMap() {
  if (mapState.map) {
    showGoogleMap();
    return true;
  }

  const key = googleMapsApiKey();
  if (!key) {
    showMapFallback("Map preview", "Live Google map turns on when the production key is configured.");
    return false;
  }

  setMapStatus("Loading map", "Pulling in Google Maps.");

  try {
    await loadGoogleMapsScript(key);
    if (!window.google?.maps?.Map) throw new Error("Google Maps did not initialize.");

    mapState.map = new google.maps.Map(els.googleMap, {
      center: portlandCenter,
      zoom: 11,
      clickableIcons: false,
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      styles: [
        { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
        { featureType: "poi.business", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ saturation: -60 }, { lightness: 20 }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#9fb9c6" }] },
        { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f2eee4" }] },
      ],
    });
    mapState.infoWindow = new google.maps.InfoWindow();
    showGoogleMap();
    updateGoogleMarkers(filteredPlaces());
    return true;
  } catch {
    showMapFallback("Map preview", "Google Maps could not load, so the local preview is still active.");
    return false;
  }
}

function loadGoogleMapsScript(key) {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (mapState.loader) return mapState.loader;

  mapState.loader = new Promise((resolve, reject) => {
    const callbackName = "initDariosListMap";
    window[callbackName] = () => resolve();

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callbackName}&v=weekly`;
    script.addEventListener("error", () => reject(new Error("Google Maps script failed to load.")));
    document.head.append(script);
  });

  return mapState.loader;
}

function updateGoogleMarkers(visiblePlaces) {
  const visibleIds = new Set(visiblePlaces.map((place) => place.id));
  const currentIds = new Set(state.places.map((place) => place.id));

  for (const [id, marker] of mapState.markers) {
    if (!currentIds.has(id)) {
      marker.setMap(null);
      mapState.markers.delete(id);
    }
  }

  for (const place of state.places) {
    const position = coordsForPlace(place);
    const label = place.category.slice(0, 1).toUpperCase();
    let marker = mapState.markers.get(place.id);

    if (!marker) {
      marker = new google.maps.Marker({
        position,
        map: mapState.map,
        title: place.name,
        label: {
          text: label,
          color: "#fffdf8",
          fontSize: "11px",
          fontWeight: "900",
        },
        icon: googleMarkerIcon(place),
      });
      marker.addListener("click", () => openDetail(place.id));
      mapState.markers.set(place.id, marker);
    } else {
      marker.setPosition(position);
      marker.setTitle(place.name);
      marker.setLabel({
        text: label,
        color: "#fffdf8",
        fontSize: "11px",
        fontWeight: "900",
      });
      marker.setIcon(googleMarkerIcon(place));
    }

    marker.setVisible(visibleIds.has(place.id));
  }

  if (els.contentGrid.classList.contains("is-map-only")) fitMapToPlaces(visiblePlaces);
}

function googleMarkerIcon(place) {
  const saved = state.saved.has(place.id);
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: saved ? 11 : 9,
    fillColor: colorsFor(place)[0],
    fillOpacity: 0.96,
    strokeColor: saved ? "#b87926" : "#fffdf8",
    strokeOpacity: 1,
    strokeWeight: saved ? 3 : 2,
  };
}

function fitMapToPlaces(places) {
  if (!mapState.map || !places.length) return;

  if (places.length === 1) {
    mapState.map.setCenter(coordsForPlace(places[0]));
    mapState.map.setZoom(14);
    return;
  }

  const bounds = new google.maps.LatLngBounds();
  places.forEach((place) => bounds.extend(coordsForPlace(place)));
  mapState.map.fitBounds(bounds, 42);
}

function coordsForPlace(place) {
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  if (place.lat !== null && place.lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }

  const x = clamp(Number(place.x) || 50, 0, 100);
  const y = clamp(Number(place.y) || 50, 0, 100);
  const seed = Math.abs(hashCode(place.id || place.name));
  const latJitter = (((seed % 100) / 100) - 0.5) * 0.006;
  const lngJitter = ((((seed >> 7) % 100) / 100) - 0.5) * 0.008;
  const latRange = approximateMapBounds.north - approximateMapBounds.south;
  const lngRange = approximateMapBounds.east - approximateMapBounds.west;

  return {
    lat: approximateMapBounds.north - (y / 100) * latRange + latJitter,
    lng: approximateMapBounds.west + (x / 100) * lngRange + lngJitter,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function showGoogleMap() {
  els.googleMap.classList.add("is-active");
  els.mapFallback.classList.add("is-hidden");
}

function showMapFallback(title, message) {
  els.googleMap.classList.remove("is-active");
  els.mapFallback.classList.remove("is-hidden");
  setMapStatus(title, message);
}

function setMapStatus(title, message) {
  els.mapStatus.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

function activateMapView() {
  els.contentGrid.classList.add("is-map-only");
  els.mapViewButton.classList.add("is-active");
  els.listViewButton.classList.remove("is-active");
  els.mapViewButton.setAttribute("aria-pressed", "true");
  els.listViewButton.setAttribute("aria-pressed", "false");
  ensureGoogleMap().then((ready) => {
    if (ready) renderMap(filteredPlaces());
  });
}

function renderRoute() {
  const mood = els.routeMood.value;
  const length = Number(els.routeLength.value);
  const pool = state.places.filter((place) => mood === "all" || place.moods.includes(mood) || place.moments.includes(mood));
  const route = buildRoute(pool, length);
  state.currentRoute = route;

  els.routeList.innerHTML = route
    .map((place, index) => {
      return `
        <li>
          <span>${index + 1}</span>
          <button class="text-button route-link" type="button" data-open="${escapeAttr(place.id)}">
            <strong>${escapeHtml(place.name)}</strong>
            <small>${escapeHtml(place.category)} · ${escapeHtml(place.neighborhood)} · ${escapeHtml(place.best)}</small>
          </button>
        </li>
      `;
    })
    .join("");
  els.routeStatus.textContent = route.length ? `${route.length} stops ready to copy.` : "No route matches that mood yet.";
}

function buildRoute(pool, length) {
  const categories = ["Coffee", "Market", "Books", "Culture", "Outdoors", "Dessert", "Dinner", "Drinks", "Walk", "Run", "Shop", "Fashion", "Brunch", "Lunch"];
  const selected = [];
  const used = new Set();
  const shifted = [...categories.slice(state.routeSeed % categories.length), ...categories.slice(0, state.routeSeed % categories.length)];

  for (const category of shifted) {
    const options = pool.filter((place) => place.category === category && !used.has(place.id));
    if (!options.length) continue;
    const option = options[(state.routeSeed + selected.length) % options.length];
    selected.push(option);
    used.add(option.id);
    if (selected.length === length) break;
  }

  if (selected.length < length) {
    for (const place of pool) {
      if (!used.has(place.id)) selected.push(place);
      if (selected.length === length) break;
    }
  }

  return selected;
}

function openDetail(id) {
  const place = state.places.find((item) => item.id === id);
  if (!place) return;
  renderDetail(id);
  if (!els.detailDialog.open) els.detailDialog.showModal();
}

function colorsFor(place) {
  const index = Math.abs(hashCode(place.category + place.neighborhood)) % palette.length;
  return palette[index];
}

function hashCode(value) {
  return [...value].reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}

function setFilter(key, value) {
  state.filters[key] = value;
  render();
}

function resetFilters() {
  state.filters = {
    query: "",
    category: "all",
    neighborhood: "all",
    mood: "all",
    moment: "all",
    price: "all",
    status: "all",
    sort: "curated",
  };
  els.searchInput.value = "";
  els.categoryFilter.value = "all";
  els.neighborhoodFilter.value = "all";
  els.moodFilter.value = "all";
  els.momentFilter.value = "all";
  els.priceFilter.value = "all";
  els.statusFilter.value = "all";
  els.sortSelect.value = "curated";
  render();
}

function toggleSaved(id) {
  if (state.saved.has(id)) {
    state.saved.delete(id);
  } else {
    state.saved.add(id);
  }
  persistSaved();
  render();
  if (els.detailDialog.open) renderDetail(id);
}

function addOrUpdatePlace(formData) {
  const editId = els.addPlaceForm.dataset.editId;
  const place = placeFromForm(formData, editId);
  if (!place.name) return;

  if (editId) {
    state.places = state.places.map((item) => (item.id === editId ? place : item));
  } else {
    state.places = [place, ...state.places];
  }

  persistPlaces();
  setupFilters();
  syncFilterControls();
  render();
  openDetail(place.id);
}

function placeFromForm(formData, editId = "") {
  const name = formData.get("name").toString().trim();
  const category = formData.get("category").toString().trim();
  const neighborhood = formData.get("neighborhood").toString().trim();
  const tags = splitList(formData.get("tags").toString());
  const existing = state.places.find((place) => place.id === editId);
  const point = existing || inferPoint(neighborhood || name);
  const now = new Date().toISOString();
  return normalizePlace({
    ...existing,
    id: editId || `${slugify(name)}-${Date.now().toString(36)}`,
    name,
    category,
    neighborhood,
    price: formData.get("price").toString(),
    status: formData.get("status").toString(),
    moments: splitList(formData.get("moments").toString()),
    moods: splitList(formData.get("moods").toString()),
    tags,
    best: formData.get("best").toString().trim() || "Worth testing in the field.",
    avoid: formData.get("avoid").toString().trim() || "Unknown until you try it.",
    order: formData.get("order").toString().trim() || "Add your move after visiting.",
    note: formData.get("note").toString().trim(),
    address: formData.get("address").toString().trim(),
    mapsUrl: formData.get("mapsUrl").toString().trim(),
    website: formData.get("website").toString().trim(),
    x: Number(point.x),
    y: Number(point.y),
    rank: existing?.rank || 0,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
}

function openPlaceForm(id = "") {
  const place = state.places.find((item) => item.id === id);
  if (els.detailDialog.open) els.detailDialog.close();
  els.addPlaceForm.dataset.editId = id;
  els.placeFormEyebrow.textContent = place ? "Edit spot" : "New spot";
  els.addTitle.textContent = place ? `Edit ${place.name}` : "Add a place";
  els.savePlaceButton.textContent = place ? "Save changes" : "Save spot";
  els.deletePlaceButton.hidden = !place;

  const fields = els.addPlaceForm.elements;
  fields.name.value = place?.name || "";
  fields.category.value = place?.category || "";
  fields.neighborhood.value = place?.neighborhood || "";
  fields.price.value = place?.price || "$$";
  fields.status.value = place?.status || "unreviewed";
  fields.address.value = place?.address || "";
  fields.mapsUrl.value = place?.mapsUrl || "";
  fields.website.value = place?.website || "";
  fields.note.value = place?.note || "";
  fields.best.value = place?.best || "";
  fields.order.value = place?.order || "";
  fields.avoid.value = place?.avoid || "";
  fields.tags.value = (place?.tags || []).join(", ");
  fields.moods.value = (place?.moods || []).join(", ");
  fields.moments.value = (place?.moments || []).join(", ");
  els.addDialog.showModal();
}

function deletePlace(id) {
  const place = state.places.find((item) => item.id === id);
  if (!place) return;
  const confirmed = window.confirm(`Delete ${place.name} from the list?`);
  if (!confirmed) return;
  state.places = state.places.filter((item) => item.id !== id);
  state.saved.delete(id);
  persistPlaces();
  persistSaved();
  setupFilters();
  syncFilterControls();
  render();
  if (els.detailDialog.open) els.detailDialog.close();
  if (els.addDialog.open) els.addDialog.close();
}

function renderDetail(id) {
  const place = state.places.find((item) => item.id === id);
  if (!place) return;
  const [a, b] = colorsFor(place);
  const saved = state.saved.has(place.id);
  const nearby = nearbyPlaces(place, 4)
    .map(
      (item) => `
        <button class="nearby-item" type="button" data-open="${escapeAttr(item.id)}">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.category)} · ${escapeHtml(item.neighborhood)}</span>
        </button>
      `,
    )
    .join("");
  const links = [
    place.mapsUrl ? `<a href="${escapeAttr(place.mapsUrl)}" target="_blank" rel="noopener">Maps</a>` : "",
    place.website ? `<a href="${escapeAttr(place.website)}" target="_blank" rel="noopener">Website</a>` : "",
    place.phone ? `<a href="tel:${escapeAttr(String(place.phone).replace(/[^\d+]/g, ""))}">Call</a>` : "",
  ].filter(Boolean);
  const sourceDetail = [place.appleCategory, place.source].filter(Boolean).join(" · ") || "Imported place";
  els.detailContent.innerHTML = `
    <div class="detail-hero" style="--accent-a:${a};--accent-b:${b}"></div>
    <div class="detail-body">
      <div class="detail-meta">
        <span>${escapeHtml(place.category)}</span>
        <span>${escapeHtml(place.neighborhood)}</span>
        <span>${escapeHtml(place.price)}</span>
        <span>${statusLabel(place.status)}</span>
      </div>
      <h2 id="detailTitle">${escapeHtml(place.name)}</h2>
      <div class="detail-actions">
        <button class="save-button ${saved ? "is-saved" : ""}" type="button" data-save="${escapeAttr(place.id)}">${saved ? "Saved" : "Save"}</button>
        <button class="text-button" type="button" data-edit="${escapeAttr(place.id)}">Edit</button>
        <button class="text-button danger-text" type="button" data-delete="${escapeAttr(place.id)}">Delete</button>
        ${links.join("")}
      </div>
      <p class="detail-note">${escapeHtml(place.note)}</p>
      <div class="detail-tags">
        ${[...place.tags, ...place.moods, ...place.moments].map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
      <div class="detail-grid">
        <div class="detail-fact">
          <strong>Best for</strong>
          <p>${escapeHtml(place.best)}</p>
        </div>
        <div class="detail-fact">
          <strong>Order / do</strong>
          <p>${escapeHtml(place.order)}</p>
        </div>
        <div class="detail-fact">
          <strong>Not for</strong>
          <p>${escapeHtml(place.avoid)}</p>
        </div>
        <div class="detail-fact">
          <strong>Address / area</strong>
          <p>${escapeHtml(place.address || place.neighborhood)}</p>
        </div>
        <div class="detail-fact">
          <strong>Source</strong>
          <p>${escapeHtml(sourceDetail)}</p>
        </div>
        <div class="detail-fact">
          <strong>Boundary</strong>
          <p>Verify hours and closures before publishing or sending someone across town.</p>
        </div>
      </div>
      <div class="nearby-panel">
        <div>
          <p class="eyebrow">Pairings</p>
          <h3>Nearby ideas</h3>
        </div>
        <div class="nearby-list">${nearby || "<p>No nearby pairings yet.</p>"}</div>
      </div>
    </div>
  `;
}

function splitList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function statusLabel(status) {
  const labels = {
    unreviewed: "Unreviewed",
    favorite: "Favorite",
    revisit: "Revisit",
    try: "Want to try",
    seasonal: "Seasonal",
    verify: "Needs verification",
  };
  return labels[status] || status || "Unreviewed";
}

function slugify(value) {
  return String(value || "place")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function inferPoint(value) {
  const text = String(value || "").toLowerCase();
  const anchors = [
    [["nw", "forest", "washington"], 20, 35],
    [["pearl", "powell", "burnside"], 35, 41],
    [["downtown", "west end"], 38, 49],
    [["mississippi", "williams", "piedmont"], 55, 31],
    [["alberta", "concordia", "vernon"], 68, 32],
    [["hollywood", "grant"], 75, 41],
    [["buckman", "kerns", "central eastside"], 57, 51],
    [["belmont", "laurelhurst"], 69, 57],
    [["hawthorne", "division", "clinton"], 70, 64],
    [["tabor", "montavilla"], 79, 62],
    [["waterfront", "river"], 49, 57],
  ];
  const match = anchors.find(([keywords]) => keywords.some((keyword) => text.includes(keyword)));
  if (match) return { x: match[1], y: match[2] };
  const seed = Math.abs(hashCode(text));
  return { x: 25 + (seed % 55), y: 24 + ((seed >> 3) % 50) };
}

function nearbyPlaces(place, limit = 4) {
  return state.places
    .filter((item) => item.id !== place.id)
    .map((item) => ({
      ...item,
      distance: Math.hypot(Number(item.x) - Number(place.x), Number(item.y) - Number(place.y)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
}

function routeText() {
  if (!state.currentRoute.length) return "No route selected.";
  const mood = els.routeMood.value === "all" ? "any mood" : els.routeMood.value;
  const lines = state.currentRoute.map((place, index) => {
    const move = place.order ? ` - ${place.order}` : "";
    return `${index + 1}. ${place.name} (${place.category}, ${place.neighborhood})${move}`;
  });
  return [`Dario's List route (${mood})`, ...lines].join("\n");
}

async function copyRoute() {
  const text = routeText();
  try {
    await navigator.clipboard.writeText(text);
    els.routeStatus.textContent = "Route copied.";
  } catch {
    const helper = document.createElement("textarea");
    helper.value = text;
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    els.routeStatus.textContent = "Route copied.";
  }
}

function exportPlaces() {
  const payload = JSON.stringify(state.places, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "darios-list-places.json";
  link.click();
  URL.revokeObjectURL(url);
}

function importPlaces(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!Array.isArray(imported)) throw new Error("Expected an array of places.");
      state.places = imported.map(normalizePlace);
      persistPlaces();
      setupFilters();
      resetFilters();
      els.importDialog.close();
    } catch (error) {
      alert(`Could not import places: ${error.message}`);
    }
  });
  reader.readAsText(file);
}

function normalizePlace(place, index) {
  const point = inferPoint(`${place.neighborhood || ""} ${place.name || ""}`);
  const createdAt = place.createdAt || new Date(Date.now() - (index || 0) * 1000).toISOString();
  const tags = Array.isArray(place.tags) ? place.tags : splitList(place.tags);
  const moods = Array.isArray(place.moods) ? place.moods : splitList(place.moods);
  const moments = Array.isArray(place.moments) ? place.moments : splitList(place.moments);
  const lat = Number(place.lat);
  const lng = Number(place.lng);
  const mapsUrl =
    place.mapsUrl ||
    (Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://maps.apple.com/?q=${encodeURIComponent(place.name || "Place")}&ll=${lat},${lng}`
      : "");
  return {
    id: place.id || `imported-${index || 0}-${Date.now().toString(36)}`,
    name: place.name || "Untitled place",
    category: place.category || "Place",
    neighborhood: place.neighborhood || "Portland",
    price: place.price || "$$",
    status: place.status || "unreviewed",
    moments: moments.length ? moments : ["solo"],
    moods: moods.length ? moods : ["curious"],
    tags,
    best: place.best || "Worth checking.",
    avoid: place.avoid || "Unknown.",
    order: place.order || "Add a note after visiting.",
    note: place.note || "",
    address: place.address || "",
    mapsUrl,
    website: place.website || "",
    phone: place.phone || "",
    appleCategory: place.appleCategory || "",
    source: place.source || "",
    sourceRef: place.sourceRef || "",
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    x: Number(place.x) || point.x,
    y: Number(place.y) || point.y,
    rank: Number.isFinite(Number(place.rank)) ? Number(place.rank) : (index || 0) + 1,
    createdAt,
    updatedAt: place.updatedAt || createdAt,
  };
}

function parseBulkText(value) {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^https?:\/\/\S+$/i.test(line))
    .map((line, index) => parseBulkLine(line, index))
    .filter((place) => place.name);
}

function parseBulkLine(line, index) {
  const mapsUrl = line.match(/https?:\/\/\S+/i)?.[0] || "";
  const cleaned = line.replace(/https?:\/\/\S+/gi, "").trim();
  const parts = cleaned
    .split(/\s+\|\s+|\s+[-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const name = parts[0] || cleaned;
  const category = parts[1] || guessCategory(cleaned);
  const neighborhood = parts[2] || "Portland";
  const note = parts.slice(3).join(" · ");
  const tags = splitList(parts.slice(1).join(", "));
  const point = inferPoint(`${neighborhood} ${name}`);
  const now = new Date(Date.now() + index * 1000).toISOString();
  return normalizePlace({
    id: `${slugify(name)}-${Date.now().toString(36)}-${index}`,
    name,
    category,
    neighborhood,
    price: "$$",
    status: "unreviewed",
    moments: tags.filter((tag) => ["morning", "lunch", "dinner", "night", "date", "solo", "visitor", "rainy"].includes(tag)),
    moods: tags.length ? tags : ["curious"],
    tags,
    best: "Imported from your list. Add the real use-case after visiting.",
    avoid: "Unknown until you annotate it.",
    order: "Add your move after visiting.",
    note: note || "Imported from a rough list. Needs Dario note.",
    mapsUrl,
    x: point.x,
    y: point.y,
    rank: 0,
    createdAt: now,
    updatedAt: now,
  });
}

function guessCategory(value) {
  const text = value.toLowerCase();
  if (/coffee|espresso|cafe|café/.test(text)) return "Coffee";
  if (/bar|cocktail|wine|brewery|beer/.test(text)) return "Drinks";
  if (/pizza|restaurant|dinner|sushi|thai|taco|ramen|pasta/.test(text)) return "Dinner";
  if (/brunch|breakfast|bakery/.test(text)) return "Brunch";
  if (/park|garden|trail|run|walk/.test(text)) return "Walk";
  if (/shop|store|market|books|book/.test(text)) return "Shop";
  if (/theatre|movie|museum|gallery/.test(text)) return "Culture";
  return "Place";
}

function renderImportPreview() {
  const places = parseBulkText(els.bulkImportText.value);
  els.importPreview.innerHTML = `
    <strong>${places.length} place${places.length === 1 ? "" : "s"} ready</strong>
    <span>${places.slice(0, 4).map((place) => place.name).join(", ") || "Paste lines to preview the import."}</span>
  `;
  els.commitImportButton.disabled = places.length === 0;
}

function commitBulkImport() {
  const incoming = parseBulkText(els.bulkImportText.value);
  const existingKeys = new Set(state.places.map((place) => `${place.name}|${place.neighborhood}`.toLowerCase()));
  const fresh = incoming.filter((place) => !existingKeys.has(`${place.name}|${place.neighborhood}`.toLowerCase()));
  if (!fresh.length) {
    els.importPreview.innerHTML = "<strong>No new places found</strong><span>Everything in that paste already looks imported.</span>";
    return;
  }
  state.places = [...fresh, ...state.places];
  persistPlaces();
  setupFilters();
  resetFilters();
  els.bulkImportText.value = "";
  renderImportPreview();
  els.importDialog.close();
}

function persistViewState() {
  localStorage.setItem(VIEW_KEY, JSON.stringify({ filters: state.filters }));
}

function loadViewState() {
  try {
    const saved = JSON.parse(localStorage.getItem(VIEW_KEY) || "{}");
    state.filters = { ...state.filters, ...saved.filters };
  } catch {
    state.filters = { ...state.filters };
  }
}

function syncFilterControls() {
  els.searchInput.value = state.filters.query;
  els.categoryFilter.value = optionExists(els.categoryFilter, state.filters.category) ? state.filters.category : "all";
  els.neighborhoodFilter.value = optionExists(els.neighborhoodFilter, state.filters.neighborhood) ? state.filters.neighborhood : "all";
  els.moodFilter.value = optionExists(els.moodFilter, state.filters.mood) ? state.filters.mood : "all";
  els.momentFilter.value = optionExists(els.momentFilter, state.filters.moment) ? state.filters.moment : "all";
  els.priceFilter.value = state.filters.price;
  els.statusFilter.value = state.filters.status;
  els.sortSelect.value = state.filters.sort;
}

function optionExists(select, value) {
  return [...select.options].some((option) => option.value === value);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

els.searchInput.addEventListener("input", (event) => setFilter("query", event.target.value));
els.categoryFilter.addEventListener("change", (event) => setFilter("category", event.target.value));
els.neighborhoodFilter.addEventListener("change", (event) => setFilter("neighborhood", event.target.value));
els.moodFilter.addEventListener("change", (event) => setFilter("mood", event.target.value));
els.momentFilter.addEventListener("change", (event) => setFilter("moment", event.target.value));
els.priceFilter.addEventListener("change", (event) => setFilter("price", event.target.value));
els.statusFilter.addEventListener("change", (event) => setFilter("status", event.target.value));
els.sortSelect.addEventListener("change", (event) => setFilter("sort", event.target.value));
els.routeMood.addEventListener("change", renderRoute);
els.routeLength.addEventListener("change", renderRoute);
els.shuffleRouteButton.addEventListener("click", () => {
  state.routeSeed += 1;
  renderRoute();
});
els.copyRouteButton.addEventListener("click", copyRoute);
els.clearFiltersButton.addEventListener("click", resetFilters);
els.closeDetailButton.addEventListener("click", () => els.detailDialog.close());
els.addPlaceButton.addEventListener("click", () => openPlaceForm());
els.cancelAddButton.addEventListener("click", () => els.addDialog.close());
els.deletePlaceButton.addEventListener("click", () => deletePlace(els.addPlaceForm.dataset.editId));
els.importButton.addEventListener("click", () => {
  renderImportPreview();
  els.importDialog.showModal();
});
els.chooseJsonButton.addEventListener("click", () => els.importFile.click());
els.cancelImportButton.addEventListener("click", () => els.importDialog.close());
els.bulkImportText.addEventListener("input", renderImportPreview);
els.commitImportButton.addEventListener("click", commitBulkImport);
els.exportButton.addEventListener("click", exportPlaces);
els.importFile.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) importPlaces(file);
  event.target.value = "";
});
els.addPlaceForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  els.addDialog.close();
  addOrUpdatePlace(formData);
  event.currentTarget.reset();
});
els.quickFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-quick]");
  if (!button) return;
  const value = button.dataset.quick;
  const moments = uniqueValues("moments", true);
  const moods = uniqueValues("moods", true);
  if (moments.includes(value)) {
    els.momentFilter.value = state.filters.moment === value ? "all" : value;
    state.filters.moment = els.momentFilter.value;
  }
  if (moods.includes(value)) {
    els.moodFilter.value = state.filters.mood === value ? "all" : value;
    state.filters.mood = els.moodFilter.value;
  }
  render();
});
document.addEventListener("click", (event) => {
  const openButton = event.target.closest("[data-open]");
  const saveButton = event.target.closest("[data-save]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  if (openButton) openDetail(openButton.dataset.open);
  if (saveButton) toggleSaved(saveButton.dataset.save);
  if (editButton) openPlaceForm(editButton.dataset.edit);
  if (deleteButton) deletePlace(deleteButton.dataset.delete);
});
els.listViewButton.addEventListener("click", () => {
  els.contentGrid.classList.remove("is-map-only");
  els.listViewButton.classList.add("is-active");
  els.mapViewButton.classList.remove("is-active");
  els.listViewButton.setAttribute("aria-pressed", "true");
  els.mapViewButton.setAttribute("aria-pressed", "false");
});
els.mapViewButton.addEventListener("click", () => {
  activateMapView();
});

loadViewState();
setupFilters();
syncFilterControls();
render();
