# Dario's List

A static prototype for a large personal Portland places guide.

The default list now includes the pruned original prototype places, manually added spots, and 35 places from the shared Apple Maps Portland guide fetched on May 26, 2026. Apple returned data for 35 of the guide's 36 refs; one stale/empty ref is intentionally omitted from `places.js`. The current seed has 105 places.

## Current Functionality

- Search across names, notes, neighborhoods, tags, moods, moments, and status.
- Filter by category, neighborhood, mood, moment, price, and saved/status.
- Sort by curated order, name, neighborhood, category, price, saved first, or newest.
- Switch between list and map-focused views.
- Save places locally in the browser.
- Add, edit, and delete places.
- Open detail views with notes, best-for, order/do, not-for, links, and nearby pairings.
- Build a short route by mood and copy it as text.
- Export all places as JSON.
- Import JSON or paste rough text into the bulk importer.

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
