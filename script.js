let directory = [];
let lastUpdated = "";
let collectionNotes = [];
let activeQuery = "";
let userLocation = null;

const form = document.querySelector("#search-form");
const searchInput = document.querySelector("#search");
const clearButton = document.querySelector("#clear-button");
const locationButton = document.querySelector("#location-button");
const locationStatus = document.querySelector("#location-status");
const statusOutput = document.querySelector("#status");
const updatedAt = document.querySelector("#updated-at");
const resultCount = document.querySelector("#result-count");
const results = document.querySelector("#results");
const heroStats = document.querySelector("#hero-stats");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nextFridayLabel() {
  const today = new Date();
  const daysUntilFriday = (5 - today.getDay() + 7) % 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + daysUntilFriday);

  return nextFriday.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function checkedLabel(source) {
  if (!source?.checkedAt) {
    return "Imported from shared list";
  }

  const checked = new Date(`${source.checkedAt}T12:00:00`);
  return `Checked ${checked.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function matchesQuery(masjid) {
  if (!activeQuery) {
    return true;
  }

  const searchable = [
    masjid.name,
    masjid.shortName,
    masjid.address,
    masjid.city,
    masjid.state,
    masjid.website,
    masjid.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchable.includes(activeQuery);
}

function parsePrayerTime(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);

  if (!match) {
    return Number.POSITIVE_INFINITY;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase() ?? "PM";

  if (meridiem === "PM" && hours !== 12) {
    hours += 12;
  }

  if (meridiem === "AM" && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

function earliestPrayerMinutes(masjid) {
  return Math.min(
    ...(masjid.jumuahTimes ?? []).map((entry) => parsePrayerTime(entry.time)),
  );
}

function earliestPrayerLabel(masjid) {
  const earliest = (masjid.jumuahTimes ?? [])
    .slice()
    .sort((a, b) => parsePrayerTime(a.time) - parsePrayerTime(b.time))[0];

  return earliest?.time ? `Earliest: ${earliest.time}` : "Earliest time pending";
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function distanceMiles(from, to) {
  if (!from || !to?.latitude || !to?.longitude) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceLabel(masjid) {
  const miles = distanceMiles(userLocation, masjid.coordinates);

  if (miles === null) {
    return userLocation ? "Distance unavailable" : "Allow location for distance";
  }

  const rounded = miles < 10 ? miles.toFixed(1) : Math.round(miles).toString();
  const suffix = masjid.coordinates?.approximate ? " approx." : "";
  return `${rounded} mi${suffix}`;
}

function renderTimes(times) {
  if (!times?.length) {
    return '<li class="time-pill stale">Needs manual check</li>';
  }

  return times
    .map(
      (entry) =>
        `<li class="time-pill"><span>${escapeHtml(entry.label)}</span>${escapeHtml(
          entry.time,
        )}</li>`,
    )
    .join("");
}

function renderStats() {
  const totalTimes = directory.reduce(
    (count, masjid) => count + (masjid.jumuahTimes?.length ?? 0),
    0,
  );
  const cities = new Set(directory.map((masjid) => masjid.city).filter(Boolean));

  heroStats.innerHTML = `
    <div>
      <dt>Masjids</dt>
      <dd>${directory.length}</dd>
    </div>
    <div>
      <dt>Times</dt>
      <dd>${totalTimes}</dd>
    </div>
    <div>
      <dt>Cities</dt>
      <dd>${cities.size}</dd>
    </div>
  `;
}

function renderResults() {
  const filtered = directory.filter(matchesQuery).sort((a, b) => {
    const timeDifference = earliestPrayerMinutes(a) - earliestPrayerMinutes(b);

    if (timeDifference !== 0) {
      return timeDifference;
    }

    const aDistance = distanceMiles(userLocation, a.coordinates);
    const bDistance = distanceMiles(userLocation, b.coordinates);

    if (aDistance !== null && bDistance !== null && aDistance !== bDistance) {
      return aDistance - bDistance;
    }

    if (aDistance !== null && bDistance === null) {
      return -1;
    }

    if (aDistance === null && bDistance !== null) {
      return 1;
    }

    return a.name.localeCompare(b.name);
  });
  const nextFriday = nextFridayLabel();

  resultCount.textContent = `${filtered.length} masjid${
    filtered.length === 1 ? "" : "s"
  }`;

  if (!filtered.length) {
    results.innerHTML = `
      <p class="empty">
        No masjids match that search yet. Try a city, short name, or clear the
        filter.
      </p>
    `;
    return;
  }

  results.innerHTML = filtered
    .map((masjid) => {
      const source = masjid.source ?? {};
      const needsRenderedCheck = Boolean(source.requiresRenderedCheck);
      const needsResearch =
        !masjid.jumuahTimes?.length ||
        !masjid.website ||
        source.type === "google maps list";
      const location =
        masjid.address ?? [masjid.city, masjid.state].filter(Boolean).join(", ");
      const badgeClass =
        needsRenderedCheck || needsResearch ? "badge stale" : "badge";
      const badgeLabel = needsResearch
        ? "Needs research"
        : needsRenderedCheck
          ? "Rendered check"
          : "Website verified";
      const websiteLink = masjid.website
        ? `<a class="directions" href="${escapeHtml(
            masjid.website,
          )}" target="_blank" rel="noreferrer">Visit website</a>`
        : '<span class="directions pending">Website pending</span>';

      return `
        <article class="masjid-card">
          <div>
            <p class="short-name">${escapeHtml(masjid.shortName)}</p>
            <h3>${escapeHtml(masjid.name)}</h3>
            <p class="address">${escapeHtml(location || "Location pending")}</p>
            <ul class="times" aria-label="Jumu'ah times for ${escapeHtml(
              masjid.name,
            )}">
              ${renderTimes(masjid.jumuahTimes)}
            </ul>
            <p class="meta">${escapeHtml(
              earliestPrayerLabel(masjid),
            )} · Next Jumu'ah: ${nextFriday}</p>
            <p class="note">${escapeHtml(masjid.notes)}</p>
          </div>
          <div class="side">
            <span class="${badgeClass}">
              ${badgeLabel}
            </span>
            <span class="distance">${escapeHtml(distanceLabel(masjid))}</span>
            <span class="checked">${escapeHtml(checkedLabel(source))}</span>
            ${websiteLink}
          </div>
        </article>
      `;
    })
    .join("");
}

async function loadDirectory() {
  try {
    const response = await fetch("masjid-data.json");

    if (!response.ok) {
      throw new Error(`Could not load masjid-data.json: ${response.status}`);
    }

    const data = await response.json();
    directory = data.masjids ?? [];
    lastUpdated = data.lastUpdated ?? "";
    collectionNotes = data.collectionNotes ?? [];

    updatedAt.textContent = lastUpdated
      ? `Last updated ${lastUpdated}. ${collectionNotes[0] ?? ""}`
      : collectionNotes[0] ?? "";
    statusOutput.textContent =
      "Showing verified times and imported masjids that need research.";
    renderStats();
    renderResults();
  } catch (error) {
    statusOutput.textContent =
      "Could not load the local masjid data. Check masjid-data.json.";
    results.innerHTML = `<p class="empty">${escapeHtml(error.message)}</p>`;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  activeQuery = searchInput.value.trim().toLowerCase();
  statusOutput.textContent = activeQuery
    ? `Filtering results for "${searchInput.value.trim()}".`
    : "Showing verified times and imported masjids that need research.";
  renderResults();
});

searchInput.addEventListener("input", () => {
  activeQuery = searchInput.value.trim().toLowerCase();
  statusOutput.textContent = activeQuery
    ? `Filtering results for "${searchInput.value.trim()}".`
    : "Showing verified times and imported masjids that need research.";
  renderResults();
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  activeQuery = "";
  statusOutput.textContent =
    "Showing verified times and imported masjids that need research.";
  renderResults();
});

locationButton.addEventListener("click", () => {
  if (!("geolocation" in navigator)) {
    locationStatus.textContent =
      "This browser does not support location access.";
    return;
  }

  locationButton.disabled = true;
  locationStatus.textContent = "Requesting your browser location...";

  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      locationStatus.textContent =
        "Distance enabled. Results still sort by earliest Jumu'ah first.";
      locationButton.textContent = "Location enabled";
      renderResults();
    },
    () => {
      userLocation = null;
      locationStatus.textContent =
        "Location permission was not allowed. Showing earliest times only.";
      locationButton.disabled = false;
      renderResults();
    },
    {
      enableHighAccuracy: false,
      maximumAge: 10 * 60 * 1000,
      timeout: 10000,
    },
  );
});

loadDirectory();
