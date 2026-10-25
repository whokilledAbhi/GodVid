/**
 * Cloudflare Worker Reverse Proxy for GodVid Engine
 *
 * Forwards requests from Cloudflare Edge to your GodVid Engine backend
 * with full CORS headers, streaming download support, and health checks.
 */

export default {
  async fetch(request, env, ctx) {
    // 1. Handle CORS Preflight OPTIONS
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);

    // 2. Health check route at edge
    if (url.pathname === "/cf-health") {
      return new Response(JSON.stringify({ status: "healthy", edge: "cloudflare-worker" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // 3. Forward to backend origin configured in wrangler.toml or env vars
    // Defaults to your Cloudflare Tunnel hostname or backend origin
    const BACKEND_ORIGIN = env.BACKEND_ORIGIN || "https://your-tunnel-id.trycloudflare.com";

    const targetUrl = new URL(url.pathname + url.search, BACKEND_ORIGIN);

    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "follow",
    });

    try {
      const response = await fetch(modifiedRequest);

      // Clone response headers and ensure CORS is permitted for Chrome extension
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");
      responseHeaders.set("Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS");
      responseHeaders.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: "Backend unreachable", detail: err.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  },
};
