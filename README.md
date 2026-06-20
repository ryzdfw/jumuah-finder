# Jumuah Finder

A small static website for finding nearby Jumuah prayer times.

## Features

- Search masjids by name, city, or address
- Sorts results by earliest Jumuah prayer time
- Optional browser location lookup to show distance in miles
- Static data file for verified masjid prayer times

## Local Preview

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Data

Masjid data lives in `masjid-data.json`. Some masjid websites render prayer widgets visually, so if static page text does not show Jumuah times, verify the rendered page before marking data unavailable.

#test
