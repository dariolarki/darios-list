const STORAGE_KEY = "darios-list.places.v2";
const SAVED_KEY = "darios-list.saved.v2";
const VISITED_KEY = "darios-list.visited.v1";
const VIEW_KEY = "darios-list.view.v2";
const LEGACY_KEYS = {
  places: "darios-list.places.v1",
  saved: "darios-list.saved.v1",
  view: "darios-list.view.v1",
};

const palette = [
  ["#0a36f5", "#071f9f"],
  ["#0a36f5", "#071f9f"],
  ["#0a36f5", "#071f9f"],
  ["#0a36f5", "#071f9f"],
  ["#0a36f5", "#071f9f"],
  ["#0a36f5", "#071f9f"],
];

const seedPlaces = window.DARIOS_LIST_PLACES || [];
const neighborhoodData = window.DARIOS_LIST_NEIGHBORHOODS || [];
const appConfig = window.DARIOS_LIST_CONFIG || {};
const canonicalPlaceAliases = {
  "apple-7221381082698316086": "kann",
  "apple-17531790366307368782": "ken-pizza",
  "apple-10074551116099932126": "nong",
  "apple-7373440988096002642": "paadee",
};
const portlandCenter = { lat: 45.5152, lng: -122.6784 };
const maps = window.DariosMaps || null;

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
  filtersToggleButton: document.querySelector("#filtersToggleButton"),
  filterGrid: document.querySelector("#filterGrid"),
  quickFilters: document.querySelector("#quickFilters"),
  resultHeading: document.querySelector("#resultHeading"),
  clearFiltersButton: document.querySelector("#clearFiltersButton"),
  placeList: document.querySelector("#placeList"),
  resultStatus: document.querySelector("#resultStatus"),
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
  guideViewButton: document.querySelector("#guideViewButton"),
  contentGrid: document.querySelector(".content-grid"),
  guidesPanel: document.querySelector("#guidesPanel"),
  guideSearch: document.querySelector("#guideSearch"),
  guideList: document.querySelector("#guideList"),
  guideDetail: document.querySelector("#guideDetail"),
  openRouteButton: document.querySelector("#openRouteButton"),
  connectionStatus: document.querySelector("#connectionStatus"),
};

const state = {
  places: loadPlaces(),
  saved: loadIdSet(SAVED_KEY, LEGACY_KEYS.saved),
  visited: loadIdSet(VISITED_KEY),
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
  activeView: "list",
  selectedNeighborhood: neighborhoodData[0]?.id || "",
  guideQuery: "",
  activePlaceId: "",
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
const filterTaxonomy = {
  moods: [
    "active",
    "calm",
    "casual",
    "celebratory",
    "cozy",
    "creative",
    "curious",
    "espresso",
    "focused",
    "fun",
    "moody",
    "quiet",
    "rainy",
    "reset",
    "social",
    "thoughtful",
    "warm",
  ],
  moments: [
    "brunch",
    "celebration",
    "community",
    "date",
    "dinner",
    "gift",
    "group",
    "lunch",
    "morning",
    "night",
    "quick",
    "rainy",
    "recovery",
    "run",
    "seasonal",
    "solo",
    "summer",
    "sunset",
    "visitor",
    "walk",
    "work",
    "workout",
  ],
};

const mapState = {
  map: null,
  markers: new Map(),
  loading: null,
};

function loadPlaces() {
  const stored = safeStorageGet(STORAGE_KEY) || safeStorageGet(LEGACY_KEYS.places);
  if (!stored) return seedPlaces.map(normalizePlace);
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return seedPlaces.map(normalizePlace);
    const seedById = new Map(seedPlaces.map((place) => [place.id, place]));
    return parsed
      .filter((place) => !canonicalPlaceAliases[place?.id])
      .map((place, index) => {
        const seed = seedById.get(place.id) || {};
        const locationFields = [
          "appleCategory",
          "address",
          "mapsUrl",
          "website",
          "phone",
          "lat",
          "lng",
          "coordinatesVerified",
          "coordinateStatus",
        ];
        const migrated = { ...place };
        locationFields.forEach((field) => {
          if ((migrated[field] === undefined || migrated[field] === null || migrated[field] === "") && seed[field] !== undefined) {
            migrated[field] = seed[field];
          }
        });
        return normalizePlace(migrated, index);
      });
  } catch {
    return seedPlaces.map(normalizePlace);
  }
}

function persistPlaces() {
  safeStorageSet(STORAGE_KEY, JSON.stringify(state.places));
}

function persistSaved() {
  safeStorageSet(SAVED_KEY, JSON.stringify([...state.saved]));
}

function persistVisited() {
  safeStorageSet(VISITED_KEY, JSON.stringify([...state.visited]));
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    showToast("This browser blocked local storage. Your change works for this session only.");
    return false;
  }
}

function loadIdSet(key, fallbackKey = "") {
  try {
    const value = JSON.parse(safeStorageGet(key) || (fallbackKey ? safeStorageGet(fallbackKey) : "") || "[]");
    return new Set(
      Array.isArray(value)
        ? value.map(String).map((id) => canonicalPlaceAliases[id] || id)
        : [],
    );
  } catch {
    return new Set();
  }
}

function uniqueValues(key, nested = false) {
  const values = state.places.flatMap((place) => (nested ? place[key] || [] : [place[key]]));
  return [...new Set(values)].filter(Boolean).sort((a, b) => a.localeCompare(b));
}

function fillSelect(select, label, values) {
  select.replaceChildren();
  const first = document.createElement("option");
  first.value = "all";
  first.textContent = label;
  select.append(first);
  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
}

function setupFilters() {
  fillSelect(els.categoryFilter, "Any category", uniqueValues("category"));
  fillSelect(els.neighborhoodFilter, "Any neighborhood", uniqueValues("neighborhood"));
  const availableMoods = new Set(uniqueValues("moods", true));
  const availableMoments = new Set(uniqueValues("moments", true));
  const moods = filterTaxonomy.moods.filter((value) => availableMoods.has(value));
  const moments = filterTaxonomy.moments.filter((value) => availableMoments.has(value));
  fillSelect(els.moodFilter, "Any mood", moods);
  fillSelect(els.momentFilter, "Any moment", moments);
  fillSelect(els.routeMood, "Any mood", moods);
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
  els.resultStatus.textContent = `${places.length} place${places.length === 1 ? "" : "s"} shown.`;
  els.emptyState.hidden = places.length > 0;
  renderPlaces(places);
  renderMap(places);
  renderRoute();
  renderGuides();
  renderQuickFilters();
  persistViewState();
}

function headingForFilters(count) {
  const active = Object.entries(state.filters).filter(
    ([key, value]) => key !== "sort" && value && value !== "all",
  );
  if (!active.length) return "All spots";
  if (state.filters.query) return `${count} match${count === 1 ? "" : "es"} for "${state.filters.query}"`;
  const label = active[0][1];
  return `${count} spot${count === 1 ? "" : "s"} for ${label}`;
}

function renderPlaces(places) {
  els.placeList.innerHTML = places
    .map((place, index) => {
      const saved = state.saved.has(place.id);
      const displayIndex = String(place.rank || index + 1).padStart(3, "0");
      return `
        <article class="place-card">
          <span class="place-index">${displayIndex}</span>
          <button class="place-primary" type="button" data-open="${escapeAttr(place.id)}" aria-label="Open ${escapeAttr(place.name)}">
            <strong>${escapeHtml(place.name)}</strong>
            <span>${escapeHtml(place.note)}</span>
          </button>
          <span class="place-data place-category">${escapeHtml(place.category)}</span>
          <span class="place-data place-neighborhood">${escapeHtml(place.neighborhood)}</span>
          <span class="place-data place-price">${escapeHtml(place.price)}</span>
          <span class="place-data place-status place-status-owner">${statusLabel(place.status)}</span>
          <div class="card-actions">
            <button class="save-button ${saved ? "is-saved" : ""}" type="button" data-save="${escapeAttr(place.id)}" aria-label="${saved ? "Remove" : "Save"} ${escapeAttr(place.name)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.5 4.5h11v15l-5.5-3-5.5 3v-15Z" />
              </svg>
              <span>${saved ? "Saved" : "Save"}</span>
            </button>
            <button class="details-button" type="button" data-open="${escapeAttr(place.id)}" aria-label="View details for ${escapeAttr(place.name)}">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
  observePlaceRows();
}

function renderPins(visiblePlaces) {
  els.pinLayer.innerHTML = visiblePlaces
    .map((place) => {
      const saved = state.saved.has(place.id) ? "is-saved" : "";
      return `
        <button
          class="map-pin ${saved}"
          style="left:${place.x}%;top:${place.y}%"
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
  if (mapState.map) {
    updateGoogleMarkers(visiblePlaces).catch(() => {
      showMapFallback("Map preview", "Verified map markers are temporarily unavailable.");
    });
  }
}

function googleMapsApiKey() {
  return String(appConfig.googleMapsApiKey || "").trim();
}

async function ensureGoogleMap() {
  if (mapState.map) {
    showGoogleMap();
    return true;
  }

  if (!maps || !googleMapsApiKey()) {
    showMapFallback("Map preview", "Live Google map turns on when the production key is configured.");
    return false;
  }

  if (mapState.loading) return mapState.loading;
  setMapStatus("Loading verified map", "Connecting the places with confirmed coordinates.");

  mapState.loading = (async () => {
    try {
      mapState.map = await maps.createMap(els.googleMap, {
        center: portlandCenter,
        zoom: 11,
      });
      showGoogleMap();
      await updateGoogleMarkers(filteredPlaces());
      return true;
    } catch {
      mapState.map = null;
      showMapFallback("Map preview", "Google Maps could not load, so the local preview is still active.");
      return false;
    } finally {
      mapState.loading = null;
    }
  })();
  return mapState.loading;
}

async function updateGoogleMarkers(visiblePlaces) {
  if (!maps || !mapState.map) return;
  const visibleIds = new Set(visiblePlaces.map((place) => place.id));
  const verifiedPlaces = state.places.filter((place) => maps.hasVerifiedCoordinates(place));
  const currentIds = new Set(verifiedPlaces.map((place) => place.id));

  for (const [id, marker] of mapState.markers) {
    if (!currentIds.has(id)) {
      marker.map = null;
      mapState.markers.delete(id);
    }
  }

  for (const place of verifiedPlaces) {
    const label = place.category.slice(0, 1).toUpperCase();
    let marker = mapState.markers.get(place.id);

    if (!marker) {
      marker = await maps.createAdvancedMarker({
        place,
        map: mapState.map,
        title: place.name,
        glyphText: label,
        scale: state.saved.has(place.id) ? 1.18 : 1,
        onClick: () => openDetail(place.id),
      });
      if (marker) mapState.markers.set(place.id, marker);
    }
    if (marker) marker.map = visibleIds.has(place.id) ? mapState.map : null;
  }

  if (els.contentGrid.classList.contains("is-map-only")) fitMapToPlaces(visiblePlaces);
}

function fitMapToPlaces(places) {
  if (!mapState.map || !maps) return;
  const verified = places
    .map((place) => maps.verifiedCoordinates(place))
    .filter(Boolean);
  if (!verified.length) return;

  if (verified.length === 1) {
    mapState.map.setCenter(verified[0]);
    mapState.map.setZoom(14);
    return;
  }

  const bounds = new google.maps.LatLngBounds();
  verified.forEach((position) => bounds.extend(position));
  mapState.map.fitBounds(bounds, 42);
}

function showGoogleMap() {
  els.googleMap.classList.add("is-active");
  els.mapFallback.classList.add("is-hidden");
  els.mapFallback.setAttribute("aria-hidden", "true");
}

function showMapFallback(title, message) {
  els.googleMap.classList.remove("is-active");
  els.mapFallback.classList.remove("is-hidden");
  els.mapFallback.removeAttribute("aria-hidden");
  setMapStatus(title, message);
}

function setMapStatus(title, message) {
  els.mapStatus.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
}

function activateView(view, options = {}) {
  const nextView = ["list", "map", "guides"].includes(view) ? view : "list";
  state.activeView = nextView;
  els.contentGrid.hidden = nextView === "guides";
  els.guidesPanel.hidden = nextView !== "guides";
  els.contentGrid.classList.toggle("is-map-only", nextView === "map");

  [
    [els.listViewButton, "list"],
    [els.mapViewButton, "map"],
    [els.guideViewButton, "guides"],
  ].forEach(([button, name]) => {
    const active = name === nextView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  if (nextView === "map") {
    ensureGoogleMap().then((ready) => {
      if (ready) renderMap(filteredPlaces());
    });
  }
  if (nextView === "guides") renderGuides();
  persistViewState();
  if (options.focus) {
    const heading = nextView === "guides" ? document.querySelector("#guidesTitle") : els.resultHeading;
    heading?.focus?.({ preventScroll: true });
  }
}

function renderGuides() {
  if (!neighborhoodData.length) {
    els.guideList.innerHTML = "";
    els.guideDetail.innerHTML = `
      <div class="guide-empty">
        <p class="eyebrow">Index unavailable</p>
        <h3>Neighborhood data needs to be generated.</h3>
      </div>
    `;
    return;
  }
  const query = state.guideQuery.trim().toLowerCase();
  const visible = neighborhoodData.filter((guide) => guide.name.toLowerCase().includes(query));
  if (!visible.some((guide) => guide.id === state.selectedNeighborhood)) {
    state.selectedNeighborhood = visible[0]?.id || neighborhoodData[0].id;
  }
  els.guideList.innerHTML = visible
    .map(
      (guide, index) => `
        <button class="guide-index-item ${guide.id === state.selectedNeighborhood ? "is-active" : ""}" type="button" data-guide="${escapeAttr(guide.id)}">
          <span>${String(index + 1).padStart(2, "0")}</span>
          <strong>${escapeHtml(guide.name)}</strong>
          <small>${guide.placeCount} place${guide.placeCount === 1 ? "" : "s"}</small>
        </button>
      `,
    )
    .join("");
  const guide = neighborhoodData.find((item) => item.id === state.selectedNeighborhood) || visible[0];
  if (!guide) {
    els.guideDetail.innerHTML = `<div class="guide-empty"><h3>No neighborhood matches.</h3><p>Try a broader search.</p></div>`;
    return;
  }
  const places = guide.placeIds
    .map((id) => state.places.find((place) => place.id === id))
    .filter(Boolean);
  const categoryLine = guide.topCategories
    .slice(0, 4)
    .map((item) => `${item.name} ${item.count}`)
    .join(" · ");
  const moments = guide.topMoments.slice(0, 6);
  els.guideDetail.innerHTML = `
    <header class="guide-detail-head">
      <p class="eyebrow">${String(neighborhoodData.indexOf(guide) + 1).padStart(2, "0")} / ${String(neighborhoodData.length).padStart(2, "0")}</p>
      <h3>${escapeHtml(guide.name)}</h3>
      <p>${guide.placeCount} field note${guide.placeCount === 1 ? "" : "s"} in the current list. ${escapeHtml(categoryLine || "More categorization pending.")}</p>
      <div class="guide-moments">
        ${moments.map((item) => `<span>${escapeHtml(item.name)} <b>${item.count}</b></span>`).join("")}
      </div>
      <div class="guide-actions">
        <button class="primary-action" type="button" data-view-neighborhood="${escapeAttr(guide.name)}">View places</button>
        <button class="text-button" type="button" data-map-neighborhood="${escapeAttr(guide.name)}">Map verified spots</button>
      </div>
    </header>
    <ol class="guide-place-list">
      ${places
        .map(
          (place, index) => `
            <li>
              <span>${String(index + 1).padStart(2, "0")}</span>
              <button type="button" data-open="${escapeAttr(place.id)}">
                <strong>${escapeHtml(place.name)}</strong>
                <small>${escapeHtml(place.category)} · ${escapeHtml(place.note || "Field note pending.")}</small>
              </button>
              <em>${maps?.hasVerifiedCoordinates(place) ? "Mapped" : "Location pending"}</em>
            </li>
          `,
        )
        .join("")}
    </ol>
    <p class="guide-method">This guide is generated from the places already in Dario’s List. It does not add invented neighborhood claims.</p>
  `;
}

function renderRoute() {
  const mood = els.routeMood.value;
  const length = Number(els.routeLength.value);
  const filteredPool = filteredPlaces();
  const pool = filteredPool.filter(
    (place) => mood === "all" || place.moods.includes(mood) || place.moments.includes(mood),
  );
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
  try {
    const routeUrl = maps?.buildGoogleRouteUrl(route.map(providerSafePlace), { travelMode: "walking" }) || "";
    els.openRouteButton.href = routeUrl;
    els.openRouteButton.hidden = !routeUrl;
  } catch {
    els.openRouteButton.hidden = true;
    els.routeStatus.textContent = route.length
      ? `${route.length} suggested stops. Connect verified locations to open this as a mapped route.`
      : "No route matches that mood yet.";
  }
}

function buildRoute(pool, length) {
  const categories = ["Coffee", "Market", "Books", "Culture", "Outdoors", "Dessert", "Dinner", "Drinks", "Walk", "Run", "Shop", "Fashion", "Brunch", "Lunch"];
  const neighborhoodCounts = pool.reduce((counts, place) => {
    counts.set(place.neighborhood, (counts.get(place.neighborhood) || 0) + 1);
    return counts;
  }, new Map());
  const anchorNeighborhood = [...neighborhoodCounts].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0];
  const neighborhoodPool = anchorNeighborhood
    ? pool.filter((place) => place.neighborhood === anchorNeighborhood)
    : pool;
  const routePool = neighborhoodPool.length >= Math.min(length, 3) ? neighborhoodPool : pool;
  const selected = [];
  const used = new Set();
  const shifted = [...categories.slice(state.routeSeed % categories.length), ...categories.slice(0, state.routeSeed % categories.length)];

  for (const category of shifted) {
    const options = routePool.filter((place) => place.category === category && !used.has(place.id));
    if (!options.length) continue;
    const option = options[(state.routeSeed + selected.length) % options.length];
    selected.push(option);
    used.add(option.id);
    if (selected.length === length) break;
  }

  if (selected.length < length) {
    for (const place of routePool) {
      if (!used.has(place.id)) selected.push(place);
      if (selected.length === length) break;
    }
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
  state.activePlaceId = id;
  renderDetail(id);
  if (!els.detailDialog.open) els.detailDialog.showModal();
  updateUrlState({ place: id });
  hydrateLiveDetail(place);
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
  if (key === "neighborhood") updateUrlState({ neighborhood: value === "all" ? "" : value });
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
  updateUrlState({ neighborhood: "" });
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

function toggleVisited(id) {
  if (state.visited.has(id)) {
    state.visited.delete(id);
  } else {
    state.visited.add(id);
  }
  persistVisited();
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
  const googlePlaceId = formData.get("googlePlaceId").toString().trim();
  const googleMatchStatus = formData.get("googleMatchStatus").toString();
  const coordinateStatus = formData.get("coordinateStatus").toString();
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const validCoordinates =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;
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
    google: {
      ...(existing?.google || {}),
      placeId: googlePlaceId,
      matchStatus: googlePlaceId ? googleMatchStatus : "pending",
      matchedAt: googlePlaceId && googleMatchStatus === "verified" ? now : existing?.google?.matchedAt || "",
    },
    geo:
      validCoordinates && coordinateStatus === "verified"
        ? {
            lat,
            lng,
            source: "manual",
            status: "verified",
            verifiedAt: now,
          }
        : null,
    lat: validCoordinates ? lat : null,
    lng: validCoordinates ? lng : null,
    coordinatesVerified: validCoordinates && coordinateStatus === "verified",
    coordinateStatus,
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
  fields.googlePlaceId.value = place?.google?.placeId || "";
  fields.googleMatchStatus.value = place?.google?.matchStatus || "pending";
  fields.lat.value = Number.isFinite(Number(place?.lat)) ? place.lat : "";
  fields.lng.value = Number.isFinite(Number(place?.lng)) ? place.lng : "";
  fields.coordinateStatus.value = maps?.hasVerifiedCoordinates(place) ? "verified" : "pending";
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
  const saved = state.saved.has(place.id);
  const visited = state.visited.has(place.id);
  const providerPlaceId = reviewedPlaceId(place);
  const nearby = nearbyPlaces(place, 5)
    .map(
      (item, index) => `
        <button class="nearby-item" type="button" data-open="${escapeAttr(item.id)}">
          <b>${String(index + 1).padStart(2, "0")}</b>
          <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${escapeHtml(item.neighborhood)}</small></span>
          <em>${item.distance === null ? "Area match" : `${item.distance.toFixed(1)} mi`}</em>
        </button>
      `,
    )
    .join("");
  const directionsUrl = placeRouteUrl(place);
  const websiteUrl = safeExternalUrl(place.website);
  const sourceDetail = [place.appleCategory, place.source].filter(Boolean).join(" · ") || "Imported place";
  els.detailContent.innerHTML = `
    <div class="detail-hero">
      <span>DL / ${String(place.rank || "—").padStart(3, "0")}</span>
      <strong>Portland field note</strong>
    </div>
    <div class="detail-body">
      <div class="detail-title-row">
        <div>
          <h2 id="detailTitle">${escapeHtml(place.name)}</h2>
          <div class="detail-meta">
            <span><b>Category</b>${escapeHtml(place.category)}</span>
            <span><b>Neighborhood</b>${escapeHtml(place.neighborhood)}</span>
            <span><b>Price</b>${escapeHtml(place.price)}</span>
            <span class="owner-only"><b>Status</b>${statusLabel(place.status)}</span>
          </div>
        </div>
      </div>
      <div class="detail-actions">
        <button class="detail-action ${saved ? "is-active" : ""}" type="button" data-save="${escapeAttr(place.id)}">${saved ? "Saved" : "Save"}</button>
        <button class="detail-action ${visited ? "is-active" : ""}" type="button" data-visited="${escapeAttr(place.id)}">${visited ? "Visited" : "Mark visited"}</button>
        <button class="detail-action" type="button" data-share="${escapeAttr(place.id)}">Share</button>
        ${directionsUrl ? `<a class="detail-action" href="${escapeAttr(directionsUrl)}" target="_blank" rel="noopener">Directions</a>` : ""}
        ${websiteUrl ? `<a class="detail-action" href="${escapeAttr(websiteUrl)}" target="_blank" rel="noopener">Official site</a>` : ""}
      </div>
      <section class="detail-editorial">
        <p class="eyebrow">Dario’s note</p>
        <p class="detail-note">${escapeHtml(place.note || "A personal field note is still pending.")}</p>
      </section>
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
          <strong>Location confidence</strong>
          <p>${maps?.hasVerifiedCoordinates(place) ? "Verified coordinates available for map and distance." : "Area preview only. Exact map position is pending verification."}</p>
        </div>
      </div>
      <div class="detail-network">
        <section class="live-place-panel" id="livePlacePanel">
          <div class="live-head">
            <div><p class="eyebrow">Live place details</p><h3>Current information</h3></div>
            <span>${providerPlaceId ? "Connecting…" : "Not connected"}</span>
          </div>
          <div id="livePlaceContent">
            <div class="live-empty">
              <strong>${providerPlaceId ? "Loading live details…" : "Curated details only"}</strong>
              <p>${providerPlaceId ? "Checking current provider information." : "This place needs a reviewed Google Place ID before live hours, phone, and photos can appear."}</p>
            </div>
          </div>
        </section>
        <section class="nearby-panel">
        <div>
          <p class="eyebrow">Pairings</p>
          <h3>Nearby ideas</h3>
        </div>
        <div class="nearby-list">${nearby || "<p>No nearby pairings yet.</p>"}</div>
        </section>
      </div>
      <section class="detail-provenance">
        <div><p class="eyebrow">Source / provenance</p><p>${escapeHtml(sourceDetail)}</p></div>
        <p>Live provider facts are requested only when this detail opens and are not stored by Dario’s List.</p>
      </section>
      <section class="owner-actions owner-only">
        <p class="eyebrow">Owner actions / local browser</p>
        <button class="text-button" type="button" data-edit="${escapeAttr(place.id)}">Edit</button>
        <button class="text-button danger-text" type="button" data-delete="${escapeAttr(place.id)}">Delete</button>
      </section>
    </div>
  `;
}

async function hydrateLiveDetail(place) {
  const panel = document.querySelector("#livePlacePanel");
  const content = document.querySelector("#livePlaceContent");
  const placeId = reviewedPlaceId(place);
  if (!panel || !content || !placeId) return;
  try {
    const livePlace = await maps.fetchPlaceDetails(placeId, {
      fields: [
        "businessStatus",
        "currentOpeningHours",
        "formattedAddress",
        "googleMapsURI",
        "location",
        "nationalPhoneNumber",
        "photos",
        "websiteURI",
      ],
    });
    if (state.activePlaceId !== place.id || !els.detailDialog.open) return;
    const live = maps.serializePlaceDetails(livePlace);
    const photo = livePlace.photos?.[0];
    const photoUrl = maps.freshPhotoUrl(photo, { maxWidth: 1200 });
    const attribution = live.photos?.[0]?.authorAttributions?.[0];
    const providerUrl = safeExternalUrl(live.googleMapsURI);
    const providerWebsite = safeExternalUrl(live.websiteURI);
    content.innerHTML = `
      ${photoUrl ? `
        <figure class="live-photo">
          <img src="${escapeAttr(photoUrl)}" alt="${escapeAttr(place.name)} from Google Places" />
          <figcaption>
            Photo${attribution?.displayName ? ` by ${escapeHtml(attribution.displayName)}` : ""} · Google Places
          </figcaption>
        </figure>
      ` : ""}
      <dl class="live-facts">
        <div><dt>Hours</dt><dd>${escapeHtml(live.currentOpeningHours?.weekdayDescriptions?.[new Date().getDay() ? new Date().getDay() - 1 : 6] || "See Google Maps")}</dd></div>
        <div><dt>Phone</dt><dd>${escapeHtml(live.nationalPhoneNumber || "Not provided")}</dd></div>
        <div><dt>Address</dt><dd>${escapeHtml(live.formattedAddress || place.address || "Not provided")}</dd></div>
        <div><dt>Business status</dt><dd>${escapeHtml(humanizeToken(live.businessStatus) || "Not provided")}</dd></div>
      </dl>
      <div class="live-links">
        ${providerUrl ? `<a href="${escapeAttr(providerUrl)}" target="_blank" rel="noopener">View on Google Maps</a>` : ""}
        ${providerWebsite ? `<a href="${escapeAttr(providerWebsite)}" target="_blank" rel="noopener">Website</a>` : ""}
      </div>
    `;
    panel.querySelector(".live-head > span").textContent = "Live data available";
  } catch {
    if (state.activePlaceId !== place.id || !els.detailDialog.open) return;
    content.innerHTML = `
      <div class="live-empty is-error">
        <strong>Live details unavailable</strong>
        <p>The curated note is still here. Current hours and phone could not be retrieved right now.</p>
        <button class="text-button" type="button" data-retry-live="${escapeAttr(place.id)}">Try again</button>
      </div>
    `;
    panel.querySelector(".live-head > span").textContent = "Connection failed";
  }
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
  return labels[status] || "Unreviewed";
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
  const others = state.places.filter((item) => item.id !== place.id);
  const verified = maps?.sortByVerifiedDistance(place, others, { unit: "miles" }) || [];
  if (verified.length) {
    return verified.slice(0, limit).map(({ place: item, distance }) => ({ ...item, distance }));
  }
  return others
    .filter((item) => item.neighborhood === place.neighborhood)
    .slice(0, limit)
    .map((item) => ({ ...item, distance: null }));
}

function placeRouteUrl(place) {
  const mapsUrl = safeExternalUrl(place.mapsUrl);
  if (mapsUrl) return mapsUrl;
  const coordinates = maps?.verifiedCoordinates(place);
  if (!coordinates) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordinates.lat},${coordinates.lng}`)}`;
}

function reviewedPlaceId(place) {
  if (place?.google?.matchStatus !== "verified") return "";
  return maps?.extractPlaceId(place) || "";
}

function providerSafePlace(place) {
  if (reviewedPlaceId(place)) return place;
  return { ...place, google: {}, googlePlaceId: "", placeId: "" };
}

function safeExternalUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function humanizeToken(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
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
  if (!file || file.size > 2_000_000) {
    alert("Choose a JSON file smaller than 2 MB.");
    return;
  }
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
  const mapsUrl = safeExternalUrl(
    place.mapsUrl ||
    (Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://maps.apple.com/?q=${encodeURIComponent(place.name || "Place")}&ll=${lat},${lng}`
      : ""),
  );
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
    website: safeExternalUrl(place.website),
    phone: place.phone || "",
    appleCategory: place.appleCategory || "",
    source: place.source || "",
    sourceRef: place.sourceRef || "",
    google: place.google && typeof place.google === "object" ? { ...place.google } : {},
    geo: place.geo && typeof place.geo === "object" ? { ...place.geo } : null,
    coordinatesVerified: place.coordinatesVerified === true,
    coordinateStatus: place.coordinateStatus || "",
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
    .slice(0, 500)
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
    <span>${escapeHtml(places.slice(0, 4).map((place) => place.name).join(", ") || "Paste lines to preview the import.")}</span>
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
  safeStorageSet(
    VIEW_KEY,
    JSON.stringify({
      filters: state.filters,
      activeView: state.activeView,
      selectedNeighborhood: state.selectedNeighborhood,
    }),
  );
}

function loadViewState() {
  try {
    const saved = JSON.parse(safeStorageGet(VIEW_KEY) || safeStorageGet(LEGACY_KEYS.view) || "{}");
    state.filters = { ...state.filters, ...saved.filters };
    state.activeView = ["list", "map", "guides"].includes(saved.activeView) ? saved.activeView : "list";
    state.selectedNeighborhood = saved.selectedNeighborhood || state.selectedNeighborhood;
  } catch {
    state.filters = { ...state.filters };
  }
}

function updateUrlState(changes = {}) {
  const url = new URL(window.location.href);
  Object.entries(changes).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  });
  history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

async function sharePlace(place) {
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set("place", place.id);
  const data = {
    title: `${place.name} — Dario’s List`,
    text: `${place.name} · ${place.category} · ${place.neighborhood}`,
    url: shareUrl.href,
  };
  try {
    if (navigator.share) {
      await navigator.share(data);
      return;
    }
    await navigator.clipboard.writeText(data.url);
    showToast("Place link copied.");
  } catch (error) {
    if (error?.name !== "AbortError") showToast("Could not share this place.");
  }
}

function showToast(message) {
  let toast = document.querySelector("#appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.className = "app-toast";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function updateConnectionStatus() {
  const online = navigator.onLine;
  els.connectionStatus.textContent = online
    ? "Online · live provider details available when connected"
    : "Offline · curated notes and local saves still work";
  els.connectionStatus.classList.toggle("is-offline", !online);
}

function configureOwnerMode() {
  const editorMode = appConfig.editorMode === true;
  document.body.classList.toggle("editor-mode", editorMode);
  if (!editorMode) state.filters.status = "all";
}

function hydrateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const placeId = params.get("place");
  const neighborhood = params.get("neighborhood");
  if (neighborhood && optionExists(els.neighborhoodFilter, neighborhood)) {
    state.filters.neighborhood = neighborhood;
    els.neighborhoodFilter.value = neighborhood;
  }
  if (placeId && state.places.some((place) => place.id === placeId)) {
    window.setTimeout(() => openDetail(placeId), 0);
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

let revealObserver;

function observePlaceRows() {
  const rows = [...document.querySelectorAll(".place-card")];
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    rows.forEach((row) => row.classList.add("is-visible"));
    return;
  }
  if (!revealObserver) {
    revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
  }
  rows.forEach((row) => revealObserver.observe(row));
}

function updateScrollProgress() {
  const available = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  const progress = Math.min(Math.max(window.scrollY / available, 0), 1);
  document.documentElement.style.setProperty("--scroll-progress", progress);
}

els.searchInput.addEventListener("input", (event) => setFilter("query", event.target.value));
els.categoryFilter.addEventListener("change", (event) => setFilter("category", event.target.value));
els.neighborhoodFilter.addEventListener("change", (event) => setFilter("neighborhood", event.target.value));
els.moodFilter.addEventListener("change", (event) => setFilter("mood", event.target.value));
els.momentFilter.addEventListener("change", (event) => setFilter("moment", event.target.value));
els.priceFilter.addEventListener("change", (event) => setFilter("price", event.target.value));
els.statusFilter.addEventListener("change", (event) => setFilter("status", event.target.value));
els.sortSelect.addEventListener("change", (event) => setFilter("sort", event.target.value));
els.filtersToggleButton.addEventListener("click", () => {
  const open = els.filterGrid.classList.toggle("is-open");
  els.filtersToggleButton.setAttribute("aria-expanded", String(open));
});
els.routeMood.addEventListener("change", renderRoute);
els.routeLength.addEventListener("change", renderRoute);
els.shuffleRouteButton.addEventListener("click", () => {
  state.routeSeed += 1;
  renderRoute();
});
els.copyRouteButton.addEventListener("click", copyRoute);
els.clearFiltersButton.addEventListener("click", resetFilters);
els.closeDetailButton.addEventListener("click", () => els.detailDialog.close());
els.detailDialog.addEventListener("close", () => {
  state.activePlaceId = "";
  updateUrlState({ place: "" });
});
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
  const visitedButton = event.target.closest("[data-visited]");
  const shareButton = event.target.closest("[data-share]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");
  const retryButton = event.target.closest("[data-retry-live]");
  const guideButton = event.target.closest("[data-guide]");
  const viewNeighborhoodButton = event.target.closest("[data-view-neighborhood]");
  const mapNeighborhoodButton = event.target.closest("[data-map-neighborhood]");
  if (openButton) openDetail(openButton.dataset.open);
  if (saveButton) toggleSaved(saveButton.dataset.save);
  if (visitedButton) toggleVisited(visitedButton.dataset.visited);
  if (shareButton) {
    const place = state.places.find((item) => item.id === shareButton.dataset.share);
    if (place) sharePlace(place);
  }
  if (editButton) openPlaceForm(editButton.dataset.edit);
  if (deleteButton) deletePlace(deleteButton.dataset.delete);
  if (retryButton) {
    const place = state.places.find((item) => item.id === retryButton.dataset.retryLive);
    if (place) {
      maps?.clearPlaceDetailCache();
      hydrateLiveDetail(place);
    }
  }
  if (guideButton) {
    state.selectedNeighborhood = guideButton.dataset.guide;
    renderGuides();
  }
  if (viewNeighborhoodButton || mapNeighborhoodButton) {
    const neighborhood = (viewNeighborhoodButton || mapNeighborhoodButton).dataset[
      viewNeighborhoodButton ? "viewNeighborhood" : "mapNeighborhood"
    ];
    state.filters.neighborhood = neighborhood;
    els.neighborhoodFilter.value = neighborhood;
    updateUrlState({ neighborhood });
    render();
    activateView(viewNeighborhoodButton ? "list" : "map");
  }
});
els.listViewButton.addEventListener("click", () => activateView("list"));
els.mapViewButton.addEventListener("click", () => activateView("map"));
els.guideViewButton.addEventListener("click", () => activateView("guides"));
els.guideSearch.addEventListener("input", (event) => {
  state.guideQuery = event.target.value;
  renderGuides();
});

loadViewState();
configureOwnerMode();
setupFilters();
syncFilterControls();
render();
activateView(state.activeView);
hydrateFromUrl();
updateConnectionStatus();
updateScrollProgress();
window.addEventListener("scroll", updateScrollProgress, { passive: true });
window.addEventListener("online", updateConnectionStatus);
window.addEventListener("offline", updateConnectionStatus);
if ("serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}
