import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";

const outDir = new URL("../dist/", import.meta.url);
const staticFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "maps-integration.js",
  "neighborhoods.generated.js",
  "places.js",
  "favicon.svg",
  "manifest.webmanifest",
  "service-worker.js",
  "robots.txt",
  "sitemap.xml",
  "offline.html",
  "privacy.html",
];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of staticFiles) {
  await copyFile(new URL(`../${file}`, import.meta.url), new URL(file, outDir));
}

const config = {
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
  googleMapId: process.env.GOOGLE_MAP_ID || "",
  editorMode: process.env.EDITOR_MODE === "true",
};

await writeFile(new URL("config.js", outDir), `window.DARIOS_LIST_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
