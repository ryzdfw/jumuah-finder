const MAX_FIELD_LENGTH = 1200;
const MAX_TITLE_LENGTH = 120;

function cleanField(value) {
  return String(value ?? "").trim().slice(0, MAX_FIELD_LENGTH);
}

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function buildIssue(request) {
  const masjidName = cleanField(request.masjidName);
  const details = {
    masjidName,
    location: cleanField(request.location),
    website: cleanField(request.website),
    jumuahTime: cleanField(request.jumuahTime),
    notes: cleanField(request.notes),
    contact: cleanField(request.contact),
  };

  const body = [
    "## Masjid request",
    "",
    `Masjid name: ${details.masjidName || "Not provided"}`,
    `City/address: ${details.location || "Not provided"}`,
    `Website/social link: ${details.website || "Not provided"}`,
    `Jumu'ah time: ${details.jumuahTime || "Not provided"}`,
    "",
    "Notes:",
    details.notes || "Not provided",
    "",
    `Requester contact: ${details.contact || "Not provided"}`,
  ].join("\n");

  return {
    title: `Masjid request: ${masjidName || "New submission"}`.slice(
      0,
      MAX_TITLE_LENGTH,
    ),
    body,
  };
}

async function readRequestBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) : {};
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  let body;

  try {
    body = await readRequestBody(req);
  } catch {
    json(res, 400, { error: "Invalid request body" });
    return;
  }

  if (cleanField(body.company)) {
    json(res, 200, { ok: true });
    return;
  }

  if (!cleanField(body.masjidName)) {
    json(res, 400, { error: "Masjid name is required" });
    return;
  }

  const token =
    process.env.JUMUAH_FINDER_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPOSITORY_OWNER || "ryzdfw";
  const repo = process.env.GITHUB_REPOSITORY_NAME || "jumuah-finder";

  if (!token) {
    json(res, 500, { error: "Request storage is not configured yet" });
    return;
  }

  const issue = buildIssue(body);
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "jumuah-finder-request-form",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify(issue),
    },
  );

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    json(res, 502, {
      error: result.message || "Could not save the request",
    });
    return;
  }

  json(res, 201, {
    ok: true,
    issueUrl: result.html_url,
  });
};
