export async function onRequestPost({ request, env }) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/session=([^;]+)/);

  if (!match) {
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const sessionId = match[1];

  // Remove from DB (schema uses "id")
  await env.DB.prepare("DELETE FROM sessions WHERE id = ?")
    .bind(sessionId)
    .run();

  return new Response(JSON.stringify({ success: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict",
    },
  });
}
