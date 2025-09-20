export async function hashPassword(password) {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
}

export async function verifyPassword(password, hashed) {
  const attempt = await hashPassword(password);
  return attempt === hashed;
}
