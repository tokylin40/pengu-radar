const ALLOWED_ORIGINS = new Set([
  "https://tokylin40.github.io",
  "https://openpengu.com",
  "https://www.openpengu.com",
  "https://api.openpengu.com",
  "https://pengu-radar.pages.dev",
]);

const NANSEN_URL = "https://api.nansen.ai/api/v1/tgm/flow-intelligence";
const PENGU_TOKEN = "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv";

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(origin),
    },
  });
}

async function flowIntelligence(request, env) {
  const origin = request.headers.get("Origin") || "";
  const requestOrigin = new URL(request.url).origin;
  const sameOrigin = !origin || origin === requestOrigin;

  if (!sameOrigin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "Origin not allowed" }, 403, origin);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (request.method !== "POST") {
    return json({ error: "POST required" }, 405, origin);
  }

  if (!env.NANSEN_API_KEY) {
    return json({ error: "NANSEN_API_KEY is not configured" }, 500, origin);
  }

  try {
    const response = await fetch(NANSEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.NANSEN_API_KEY,
      },
      body: JSON.stringify({
        chain: "solana",
        token_address: PENGU_TOKEN,
        timeframe: "1d",
      }),
    });

    const body = await response.text();

    return new Response(body, {
      status: response.status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        ...corsHeaders(origin),
      },
    });
  } catch {
    return json({ error: "Nansen upstream request failed" }, 502, origin);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return json(
        {
          ok: true,
          nansenConfigured: Boolean(env.NANSEN_API_KEY),
          build: "health-check",
        },
        200,
        request.headers.get("Origin") || "",
      );
    }

    if (url.pathname === "/flow-intelligence") {
      return flowIntelligence(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
