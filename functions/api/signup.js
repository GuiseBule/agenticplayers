// Disposable / throwaway email domains we reject outright.
// Not exhaustive but covers the most common offenders.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "tempmail.net", "10minutemail.com",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org",
  "yopmail.com", "throwaway.email", "throwawaymail.com",
  "trashmail.com", "trashmail.net", "trashmail.org",
  "maildrop.cc", "sharklasers.com", "getnada.com", "getairmail.com",
  "fakeinbox.com", "spamgourmet.com", "tempr.email", "tempinbox.com",
  "tempmailo.com", "mailnesia.com", "dispostable.com", "mintemail.com",
  "mailcatch.com", "moakt.com", "emailondeck.com", "33mail.com",
  "spambox.us", "mytrashmail.com", "anonbox.net", "fakemail.net",
]);

function titleCase(s) {
  return s
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((part) => /^\s+$|^[-']$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function jsonError(msg, status, cors) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: cors });
}

export async function onRequestPost({ request, env }) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON", 400, cors);
  }

  const firstNameRaw = (body.firstName || "").trim();
  const lastNameRaw = (body.lastName || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  let linkedin = (body.linkedin || "").trim();
  let github = (body.github || "").trim();
  // Normalise: prepend https:// if missing, since most people paste bare domains
  if (linkedin && !/^https?:\/\//i.test(linkedin)) linkedin = "https://" + linkedin;
  if (github && !/^https?:\/\//i.test(github)) github = "https://" + github;
  const telegramRaw = (body.telegram || "").trim();
  const why = (body.why || "").trim();
  let referrerLinkedin = (body.referrerLinkedin || "").trim();
  if (referrerLinkedin && !/^https?:\/\//i.test(referrerLinkedin)) referrerLinkedin = "https://" + referrerLinkedin;
  const identity = Array.isArray(body.identity) ? body.identity : (body.identity ? [body.identity] : []);

  // Required fields
  if (!firstNameRaw || !lastNameRaw || !email || !linkedin || !why || !telegramRaw) {
    return jsonError("Missing required fields", 400, cors);
  }

  // Email: format + disposable domain check
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError("That doesn't look like a valid email", 400, cors);
  }
  const emailDomain = email.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(emailDomain)) {
    return jsonError("Please use a real email address, not a disposable one", 400, cors);
  }

  // LinkedIn: must be a linkedin.com URL pointing at a profile or company
  if (!/^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/(in|company|pub)\/[A-Za-z0-9_\-%.]+\/?/i.test(linkedin)) {
    return jsonError("Must be a LinkedIn profile URL (linkedin.com/in/yourname)", 400, cors);
  }

  // GitHub (optional): if filled, must be a github.com URL
  if (github && !/^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_\-]+\/?/i.test(github)) {
    return jsonError("Must be a GitHub profile URL (github.com/yourname)", 400, cors);
  }

  // Referrer LinkedIn (optional): if filled, must be a linkedin.com profile URL
  if (referrerLinkedin && !/^https?:\/\/([a-z0-9-]+\.)?linkedin\.com\/(in|company|pub)\/[A-Za-z0-9_\-%.]+\/?/i.test(referrerLinkedin)) {
    return jsonError("Referrer must be a LinkedIn profile URL (linkedin.com/in/theirname)", 400, cors);
  }

  // Strip trailing slash for cleanliness in Airtable
  linkedin = linkedin.replace(/\/+$/, "");
  if (github) github = github.replace(/\/+$/, "");
  if (referrerLinkedin) referrerLinkedin = referrerLinkedin.replace(/\/+$/, "");

  // Telegram: normalise to @handle, validate
  let telegram = telegramRaw.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/\/$/, "");
  if (!telegram.startsWith("@")) telegram = "@" + telegram;
  if (!/^@[A-Za-z0-9_]{4,32}$/.test(telegram)) {
    return jsonError("Use a public Telegram username (5-32 chars, letters/numbers/underscores)", 400, cors);
  }

  // Names: standardise to Title Case for clean Airtable data
  const firstName = titleCase(firstNameRaw);
  const lastName = titleCase(lastNameRaw);

  // Identity: filter to allowed values
  const allowedIdentity = new Set(["Founder", "Builder", "Researcher"]);
  const cleanIdentity = identity.filter((v) => allowedIdentity.has(v));

  const fields = {
    "First Name": firstName,
    "Last Name": lastName,
    "Email": email,
    "LinkedIn": linkedin,
    "Telegram": telegram,
    "Shipping": why,
    "Status": "Applicant",
    "Submitted At": new Date().toISOString(),
  };
  if (github) fields["GitHub"] = github;
  if (referrerLinkedin) fields["Referrer LinkedIn"] = referrerLinkedin;
  if (cleanIdentity.length) fields["Identity"] = cleanIdentity;

  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.AIRTABLE_PAT}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, typecast: true }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Airtable error", res.status, errText);
    return jsonError("Could not save submission", 502, cors);
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: cors });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
