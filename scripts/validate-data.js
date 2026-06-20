const fs = require("node:fs");

const data = JSON.parse(fs.readFileSync("masjid-data.json", "utf8"));
const errors = [];
const warnings = [];
const ids = new Set();
const timePattern = /^(1[0-2]|0?[1-9]):[0-5][0-9]\s*(AM|PM)$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function addError(path, message) {
  errors.push(`${path}: ${message}`);
}

function addWarning(path, message) {
  warnings.push(`${path}: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBlank(value) {
  return typeof value !== "string" || value.trim() === "";
}

function isUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

if (data.schemaVersion !== 1) {
  addError("schemaVersion", "expected schema version 1");
}

if (!datePattern.test(data.lastUpdated ?? "")) {
  addError("lastUpdated", "expected YYYY-MM-DD");
}

if (!Array.isArray(data.collectionNotes)) {
  addError("collectionNotes", "expected an array");
}

if (!Array.isArray(data.masjids)) {
  addError("masjids", "expected an array");
} else {
  data.masjids.forEach((masjid, index) => {
    const path = `masjids[${index}]`;

    if (!isObject(masjid)) {
      addError(path, "expected an object");
      return;
    }

    ["id", "name", "shortName", "state", "notes"].forEach((field) => {
      if (isBlank(masjid[field])) {
        addError(`${path}.${field}`, "required string is missing");
      }
    });

    if (!isBlank(masjid.id)) {
      if (ids.has(masjid.id)) {
        addError(`${path}.id`, `duplicate id "${masjid.id}"`);
      }

      ids.add(masjid.id);

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(masjid.id)) {
        addError(`${path}.id`, "expected lowercase kebab-case");
      }
    }

    if (typeof masjid.website === "string" && masjid.website && !isUrl(masjid.website)) {
      addError(`${path}.website`, "expected an http(s) URL or an empty string");
    }

    if (!Array.isArray(masjid.jumuahTimes)) {
      addError(`${path}.jumuahTimes`, "expected an array");
    } else if (masjid.jumuahTimes.length === 0) {
      addWarning(`${path}.jumuahTimes`, "Jumu'ah time still needs research");
    } else {
      masjid.jumuahTimes.forEach((entry, timeIndex) => {
        const timePath = `${path}.jumuahTimes[${timeIndex}]`;

        if (!isObject(entry)) {
          addError(timePath, "expected an object");
          return;
        }

        if (isBlank(entry.label)) {
          addError(`${timePath}.label`, "required string is missing");
        }

        if (!timePattern.test(entry.time ?? "")) {
          addError(`${timePath}.time`, "expected time like 1:45 PM");
        }
      });
    }

    if (isObject(masjid.coordinates)) {
      const { latitude, longitude } = masjid.coordinates;

      if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
        addError(`${path}.coordinates.latitude`, "expected a valid latitude number");
      }

      if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
        addError(`${path}.coordinates.longitude`, "expected a valid longitude number");
      }
    }

    if (!isObject(masjid.source)) {
      addError(`${path}.source`, "expected an object");
    } else {
      if (isBlank(masjid.source.type)) {
        addError(`${path}.source.type`, "required string is missing");
      }

      if (!isBlank(masjid.source.url) && !isUrl(masjid.source.url)) {
        addError(`${path}.source.url`, "expected an http(s) URL");
      }

      if (!datePattern.test(masjid.source.checkedAt ?? "")) {
        addError(`${path}.source.checkedAt`, "expected YYYY-MM-DD");
      }
    }

    if (isBlank(masjid.website)) {
      addWarning(`${path}.website`, "website still needs research");
    }
  });
}

for (const warning of warnings.slice(0, 20)) {
  console.warn(`Warning: ${warning}`);
}

if (warnings.length > 20) {
  console.warn(`Warning: ${warnings.length - 20} more research warnings omitted.`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`Error: ${error}`);
  }

  process.exit(1);
}

console.log(
  `Validated ${data.masjids.length} masjids with ${warnings.length} research warnings.`,
);
