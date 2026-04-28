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
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: cors });
  }

  const firstName = (body.firstName || "").trim();
  const lastName = (body.lastName || "").trim();
  const email = (body.email || "").trim();
  const linkedin = (body.linkedin || "").trim();
  const github = (body.github || "").trim();
  const telegramRaw = (body.telegram || "").trim();
  const why = (body.why || "").trim();
  const referrerLinkedin = (body.referrerLinkedin || "").trim();
  const identity = Array.isArray(body.identity) ? body.identity : (body.identity ? [body.identity] : []);

  if (!firstName || !lastName || !email || !linkedin || !why || !telegramRaw) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: cors });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: cors });
  }

  let telegram = telegramRaw.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "").replace(/\/$/, "");
  if (!telegram.startsWith("@")) telegram = "@" + telegram;
  if (!/^@[A-Za-z0-9_]{4,32}$/.test(telegram)) {
    return new Response(JSON.stringify({ error: "Invalid Telegram username (5-32 chars, letters/numbers/underscores, must be a public username)" }), { status: 400, headers: cors });
  }

  const allowedIdentity = new Set(["Founder", "Builder", "Researcher"]);
  const cleanIdentity = identity.filter((v) => allowedIdentity.has(v));

  const fields = {
    "First Name": firstName,
    "Last Name": lastName,
    "Email": email,
    "LinkedIn": linkedin,
    "Telegram": telegram,
    "Why": why,
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
    return new Response(JSON.stringify({ error: "Could not save submission" }), { status: 502, headers: cors });
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
