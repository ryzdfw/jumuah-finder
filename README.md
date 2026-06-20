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

## Validate Changes

```bash
npm test
```

This checks the browser JavaScript and validates `masjid-data.json` for duplicate
IDs, required fields, source dates, URL shape, coordinate shape, and Jumu'ah time
format. Missing websites and missing Jumu'ah times are allowed, but they are
reported as research warnings.

## Data

Masjid data lives in `masjid-data.json`. Some masjid websites render prayer widgets visually, so if static page text does not show Jumuah times, verify the rendered page before marking data unavailable.

## GitHub To Vercel Flow

Use branches for data changes so GitHub tracks the review before production
deploys:

1. Create a branch, for example `data/google-maps-import`.
2. Make data or UI changes.
3. Run `npm test`.
4. Push the branch to GitHub and open a pull request.
5. Review the GitHub validation result and Vercel preview deployment.
6. Merge the pull request to `main` only when it is ready for the live site.

Vercel should deploy production from `main`. Branch pushes and pull requests are
for review/preview first.
