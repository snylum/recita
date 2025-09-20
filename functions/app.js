export async function onRequest(context) {
  const cookie = context.request.headers.get("Cookie") || "";
  if (!cookie.includes("session=")) {
    return Response.redirect("/login.html", 302);
  }

  return new Response(`
    <!DOCTYPE html>
    <html>
    <head><title>Speak Up App</title></head>
    <body>
      <h1>🎤 Speak Up – Random Picker</h1>
      <p>Welcome! You are logged in ✅</p>
      <script>
        // Simple random picker here, can be replaced with full UI later
        const students = ["Alice", "Bob", "Charlie", "Diana"];
        function pick() {
          const s = students[Math.floor(Math.random()*students.length)];
          alert("Picked: " + s);
        }
      </script>
      <button onclick="pick()">Pick Student</button>
    </body>
    </html>
  `, { headers: { "content-type": "text/html" } });
}
