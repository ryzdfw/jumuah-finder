let directory = [];
let activeQuery = "";
let userLocation = null;

const form = document.querySelector("#search-form");
const searchInput = document.querySelector("#search");
const clearButton = document.querySelector("#clear-button");
const locationButton = document.querySelector("#location-button");
const locationStatus = document.querySelector("#location-status");
const statusOutput = document.querySelector("#status");
const resultCount = document.querySelector("#result-count");
const results = document.querySelector("#results");

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
      const location =
        masjid.address ?? [masjid.city, masjid.state].filter(Boolean).join(", ");
      const websiteLink = masjid.website
        ? `<a class="directions" href="${escapeHtml(
            masjid.website,
          )}" target="_blank" rel="noreferrer">Visit website</a>`
        : "";

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
          </div>
          <div class="side">
            <span class="distance">${escapeHtml(distanceLabel(masjid))}</span>
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

    statusOutput.textContent = "Showing masjids near DFW.";
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
    : "Showing masjids near DFW.";
  renderResults();
});

searchInput.addEventListener("input", () => {
  activeQuery = searchInput.value.trim().toLowerCase();
  statusOutput.textContent = activeQuery
    ? `Filtering results for "${searchInput.value.trim()}".`
    : "Showing masjids near DFW.";
  renderResults();
});

clearButton.addEventListener("click", () => {
  searchInput.value = "";
  activeQuery = "";
  statusOutput.textContent = "Showing masjids near DFW.";
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
