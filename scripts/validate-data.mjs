import { loadPlaces, normalizeEntityName, compareText } from "./place-data.mjs";

const REQUIRED_STRING_FIELDS = ["id", "name", "category", "neighborhood", "price", "status"];
const REQUIRED_ARRAY_FIELDS = ["moments", "moods", "tags"];
const EDITORIAL_FIELDS = ["note", "best", "order", "avoid"];
const URL_FIELDS = ["mapsUrl", "website"];
const PLACEHOLDER_PATTERNS = [
  /\badd dario(?:'|’)?s (?:take|ranking|notes?)\b/i,
  /\badd (?:the|your) move\b/i,
  /\bneeds? dario(?:'|’)?s?\b/i,
  /\bneeds? verification\b/i,
  /\bverify hours(?:, current status)?\b/i,
  /\bunknown until\b/i,
  /\bworth (?:checking|testing in the field)\b/i,
  /\badd (?:a|the) note after visiting\b/i,
  /\bimported from (?:your|a rough) list\b/i,
];
const PUBLISHABLE_STATUSES = new Set(["favorite", "revisit", "seasonal"]);
const PORTLAND_METRO_BOUNDS = {
  north: 45.75,
  south: 45.25,
  west: -123.15,
  east: -122.2,
};

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPresent(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

function issue(severity, code, message, place = null, field = null) {
  return {
    severity,
    code,
    message,
    ...(place ? { placeId: place.id || null, placeName: place.name || null } : {}),
    ...(field ? { field } : {}),
  };
}

function validHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function hasPlaceholderEditorial(place) {
  const text = EDITORIAL_FIELDS.map((field) => place[field] || "").join(" ");
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function exactCoordinates(place) {
  if (!isPresent(place.lat) && !isPresent(place.lng)) return null;
  if (!isPresent(place.lat) || !isPresent(place.lng)) return false;

  const lat = Number(place.lat);
  const lng = Number(place.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function percentage(count, total) {
  return total ? Number(((count / total) * 100).toFixed(1)) : 0;
}

function coverage(places, predicate) {
  const count = places.filter(predicate).length;
  return { count, total: places.length, percent: percentage(count, places.length) };
}

function summarizeIssues(issues) {
  const counts = {};
  for (const entry of issues) counts[entry.code] = (counts[entry.code] || 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => compareText(a, b)));
}

let places;
try {
  places = await loadPlaces();
} catch (error) {
  console.error(
    JSON.stringify(
      {
        schemaVersion: 1,
        result: "failed",
        hardErrorCount: 1,
        hardErrors: [issue("error", "dataset_load_failed", error.message)],
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

if (places) {
  const hardErrors = [];
  const contentGaps = [];
  const idOwners = new Map();
  const normalizedEntities = new Map();

  places.forEach((place, index) => {
    if (!place || typeof place !== "object" || Array.isArray(place)) {
      hardErrors.push(issue("error", "invalid_record", `Record ${index} must be an object.`));
      return;
    }

    for (const field of REQUIRED_STRING_FIELDS) {
      if (!isNonEmptyString(place[field])) {
        hardErrors.push(issue("error", "missing_required_field", `${field} must be a non-empty string.`, place, field));
      }
    }

    for (const field of REQUIRED_ARRAY_FIELDS) {
      if (!Array.isArray(place[field]) || place[field].some((value) => !isNonEmptyString(value))) {
        hardErrors.push(issue("error", "invalid_array_field", `${field} must be an array of non-empty strings.`, place, field));
      }
    }

    if (isNonEmptyString(place.id)) {
      if (idOwners.has(place.id)) {
        hardErrors.push(
          issue(
            "error",
            "duplicate_id",
            `ID ${place.id} is also used by ${idOwners.get(place.id)}.`,
            place,
            "id",
          ),
        );
      } else {
        idOwners.set(place.id, place.name || `record ${index}`);
      }
    }

    for (const field of URL_FIELDS) {
      if (isPresent(place[field]) && !validHttpUrl(place[field])) {
        hardErrors.push(
          issue("error", "unsafe_or_invalid_url", `${field} must use a valid http or https URL.`, place, field),
        );
      }
    }

    const coordinateState = exactCoordinates(place);
    if (coordinateState === false) {
      hardErrors.push(
        issue(
          "error",
          "invalid_coordinates",
          "lat and lng must be supplied together as finite values in global coordinate ranges.",
          place,
        ),
      );
    } else if (coordinateState === true) {
      const lat = Number(place.lat);
      const lng = Number(place.lng);
      if (
        lat > PORTLAND_METRO_BOUNDS.north ||
        lat < PORTLAND_METRO_BOUNDS.south ||
        lng > PORTLAND_METRO_BOUNDS.east ||
        lng < PORTLAND_METRO_BOUNDS.west
      ) {
        contentGaps.push(
          issue("warning", "coordinates_outside_portland_metro", "Coordinates fall outside the launch-region review bounds.", place),
        );
      }
    }

    for (const field of ["x", "y"]) {
      if (isPresent(place[field])) {
        const value = Number(place[field]);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          hardErrors.push(issue("error", "invalid_fallback_coordinate", `${field} must be between 0 and 100.`, place, field));
        }
      }
    }

    for (const field of EDITORIAL_FIELDS) {
      if (!isNonEmptyString(place[field])) {
        contentGaps.push(issue("warning", "missing_editorial_field", `${field} is empty.`, place, field));
      }
    }

    if (hasPlaceholderEditorial(place)) {
      contentGaps.push(
        issue("warning", "placeholder_editorial_copy", "Editorial copy still contains a drafting or verification prompt.", place),
      );
    }

    const normalizedName = normalizeEntityName(place.name);
    if (normalizedName) {
      const group = normalizedEntities.get(normalizedName) || [];
      group.push({
        id: place.id,
        name: place.name,
        neighborhood: place.neighborhood,
        address: place.address || "",
      });
      normalizedEntities.set(normalizedName, group);
    }
  });

  const duplicateEntities = [...normalizedEntities.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([normalizedName, entries]) => ({
      normalizedName,
      entries: entries.sort((a, b) => compareText(a.id, b.id)),
    }))
    .sort((a, b) => compareText(a.normalizedName, b.normalizedName));

  for (const duplicate of duplicateEntities) {
    contentGaps.push({
      severity: "warning",
      code: "possible_duplicate_entity",
      message: `${duplicate.entries.length} records normalize to "${duplicate.normalizedName}".`,
      placeIds: duplicate.entries.map((entry) => entry.id),
    });
  }

  const placeholderPlaces = places
    .filter(hasPlaceholderEditorial)
    .map((place) => ({ id: place.id, name: place.name }))
    .sort((a, b) => compareText(a.name, b.name));

  const readinessCriteria = {
    reviewedStatus: (place) => PUBLISHABLE_STATUSES.has(place.status),
    exactCoordinates: (place) => exactCoordinates(place) === true,
    address: (place) => isNonEmptyString(place.address),
    mapsUrl: (place) => isNonEmptyString(place.mapsUrl) && validHttpUrl(place.mapsUrl),
    website: (place) => isNonEmptyString(place.website) && validHttpUrl(place.website),
    completeEditorial: (place) =>
      EDITORIAL_FIELDS.every((field) => isNonEmptyString(place[field])) && !hasPlaceholderEditorial(place),
  };

  const criterionCoverage = Object.fromEntries(
    Object.entries(readinessCriteria).map(([name, predicate]) => [name, coverage(places, predicate)]),
  );
  const launchReadyPlaces = places
    .filter((place) => Object.values(readinessCriteria).every((predicate) => predicate(place)))
    .map((place) => ({ id: place.id, name: place.name }))
    .sort((a, b) => compareText(a.name, b.name));

  const report = {
    schemaVersion: 1,
    result: hardErrors.length ? "failed" : contentGaps.length ? "passed_with_content_gaps" : "passed",
    exitPolicy: {
      hardSchemaOrSecurityErrorsAreFatal: true,
      contentReadinessGapsAreFatal: false,
    },
    dataset: {
      totalPlaces: places.length,
      uniqueIds: idOwners.size,
      normalizedDuplicateGroups: duplicateEntities.length,
    },
    hardErrors: {
      count: hardErrors.length,
      byCode: summarizeIssues(hardErrors),
      issues: hardErrors,
    },
    contentGaps: {
      count: contentGaps.length,
      byCode: summarizeIssues(contentGaps),
      issues: contentGaps,
    },
    coverage: {
      exactCoordinates: coverage(places, (place) => exactCoordinates(place) === true),
      address: coverage(places, (place) => isNonEmptyString(place.address)),
      mapsUrl: coverage(places, (place) => isNonEmptyString(place.mapsUrl) && validHttpUrl(place.mapsUrl)),
      website: coverage(places, (place) => isNonEmptyString(place.website) && validHttpUrl(place.website)),
      phone: coverage(places, (place) => isNonEmptyString(place.phone)),
      source: coverage(places, (place) => isNonEmptyString(place.source)),
      sourceReference: coverage(places, (place) => isNonEmptyString(place.sourceRef)),
    },
    duplicateEntities,
    placeholderEditorial: {
      count: placeholderPlaces.length,
      places: placeholderPlaces,
    },
    publicationReadiness: {
      modelNote:
        "The current status field is used as a review signal. A dedicated publicationStatus field should replace this proxy before launch.",
      criteria: Object.keys(readinessCriteria),
      criterionCoverage,
      readyCount: launchReadyPlaces.length,
      totalPlaces: places.length,
      readyPercent: percentage(launchReadyPlaces.length, places.length),
      readyPlaces: launchReadyPlaces,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  if (hardErrors.length) process.exitCode = 1;
}
