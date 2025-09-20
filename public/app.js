// Handle signup
document.getElementById("signupForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = document.getElementById("signupUser").value;
  const password = document.getElementById("signupPass").value;

  const res = await fetch("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    window.location.href = "/dashboard.html";
  } else {
    const data = await res.json();
    document.getElementById("signupError").textContent = data.error;
  }
});

// Handle login
document.getElementById("loginForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const username = document.getElementById("loginUser").value;
  const password = document.getElementById("loginPass").value;

  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    window.location.href = "/dashboard.html";
  } else {
    const data = await res.json();
    document.getElementById("loginError").textContent = data.error;
  }
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await fetch("/auth/logout", { method: "POST" });
  window.location.href = "/";
});

// Example: Add class
document.getElementById("addClassBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("newClass").value;
  await fetch("/roster/class", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  location.reload();
});
