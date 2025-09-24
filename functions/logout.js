// functions/logout.js
export async function onRequestPost(context) {
  // Clear the session/authentication
  const response = new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  // Clear authentication cookies
  response.headers.set('Set-Cookie', 'auth-token=; Path=/; HttpOnly; Max-Age=0');
  
  return response;
}
