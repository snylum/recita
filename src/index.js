export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Serve frontend
    if (url.pathname === "/" || url.pathname.startsWith("/public")) {
      return await serveAsset(url);
    }

    // Example API endpoint (you can expand this)
    if (url.pathname === "/api/ping") {
      return new Response(JSON.stringify({ msg: "pong" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};

// Serve static assets (from public/)
async function serveAsset(url) {
  if (url.pathname === "/") url.pathname = "/public/index.html";

  try {
    const asset = await fetch(
      new URL("." + url.pathname, import.meta.url),
    );
    return asset;
  } catch {
    return new Response("Asset not found", { status: 404 });
  }
}
