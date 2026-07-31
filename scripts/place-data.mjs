import { readFile } from "node:fs/promises";

const ASSIGNMENT = "window.DARIOS_LIST_PLACES";

export async function loadPlaces(fileUrl = new URL("../places.js", import.meta.url)) {
  const source = await readFile(fileUrl, "utf8");
  const assignmentIndex = source.indexOf(ASSIGNMENT);

  if (assignmentIndex === -1) {
    throw new Error(`Could not find ${ASSIGNMENT} in ${fileUrl.pathname}.`);
  }

  const equalsIndex = source.indexOf("=", assignmentIndex + ASSIGNMENT.length);
  if (equalsIndex === -1) {
    throw new Error(`Could not find the places assignment in ${fileUrl.pathname}.`);
  }

  const jsonSource = source
    .slice(equalsIndex + 1)
    .trim()
    .replace(/;\s*$/, "");

  let places;
  try {
    places = JSON.parse(jsonSource);
  } catch (error) {
    throw new Error(`places.js must contain a JSON-compatible array: ${error.message}`);
  }

  if (!Array.isArray(places)) {
    throw new Error("DARIOS_LIST_PLACES must be an array.");
  }

  return places;
}

export function normalizeEntityName(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugify(value) {
  return normalizeEntityName(value).replace(/\s+/g, "-") || "unnamed";
}

export function compareText(a, b) {
  return String(a).localeCompare(String(b), "en", { sensitivity: "base" });
}

export function countValues(values) {
  const counts = new Map();

  for (const value of values.filter(Boolean)) {
    const label = String(value).trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || compareText(a.name, b.name));
}
