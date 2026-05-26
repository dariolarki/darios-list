import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";

const outDir = new URL("../dist/", import.meta.url);
const staticFiles = ["index.html", "styles.css", "app.js", "places.js", "favicon.svg"];

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const file of staticFiles) {
  await copyFile(new URL(`../${file}`, import.meta.url), new URL(file, outDir));
}

const config = {
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || "",
};

await writeFile(new URL("config.js", outDir), `window.DARIOS_LIST_CONFIG = ${JSON.stringify(config, null, 2)};\n`);
