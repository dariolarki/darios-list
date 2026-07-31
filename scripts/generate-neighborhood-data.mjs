import { readFile, writeFile } from "node:fs/promises";
import { loadPlaces, slugify, compareText, countValues } from "./place-data.mjs";

const outputUrl = new URL("../neighborhoods.generated.js", import.meta.url);
const checkOnly = process.argv.includes("--check");
const places = await loadPlaces();
const groups = new Map();

for (const place of places) {
  const name = String(place.neighborhood || "").trim();
  if (!name) continue;
  const group = groups.get(name) || [];
  group.push(place);
  groups.set(name, group);
}

const neighborhoods = [...groups.entries()]
  .map(([name, neighborhoodPlaces]) => {
    const orderedPlaces = [...neighborhoodPlaces].sort(
      (a, b) =>
        (Number(a.rank) || Number.MAX_SAFE_INTEGER) - (Number(b.rank) || Number.MAX_SAFE_INTEGER) ||
        compareText(a.name, b.name) ||
        compareText(a.id, b.id),
    );

    return {
      id: slugify(name),
      name,
      placeCount: orderedPlaces.length,
      topCategories: countValues(orderedPlaces.map((place) => place.category)).slice(0, 5),
      topMoments: countValues(orderedPlaces.flatMap((place) => (Array.isArray(place.moments) ? place.moments : []))).slice(0, 5),
      placeIds: orderedPlaces.map((place) => place.id),
    };
  })
  .sort((a, b) => compareText(a.name, b.name));

const output = [
  "// Generated from places.js by scripts/generate-neighborhood-data.mjs.",
  "// Do not add editorial claims here; this file contains dataset-derived facts only.",
  `window.DARIOS_LIST_NEIGHBORHOODS = ${JSON.stringify(neighborhoods, null, 2)};`,
  "",
].join("\n");

if (checkOnly) {
  let current = "";
  try {
    current = await readFile(outputUrl, "utf8");
  } catch {
    // A missing generated file is reported as stale below.
  }

  if (current !== output) {
    console.error("neighborhoods.generated.js is missing or stale. Run npm run generate:neighborhoods.");
    process.exitCode = 1;
  } else {
    console.log(`neighborhoods.generated.js is current (${neighborhoods.length} neighborhoods).`);
  }
} else {
  await writeFile(outputUrl, output);
  console.log(`Generated ${neighborhoods.length} neighborhoods in neighborhoods.generated.js.`);
}
