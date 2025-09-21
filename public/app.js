// ===============================
// API HELPER
// ===============================
async function apiFetch(url, options = {}) {
  const isGet = !options.method || options.method.toUpperCase() === "GET";

  const headers = isGet
    ? { ...(options.headers || {}) }
    : { "Content-Type": "application/json", ...(options.headers || {}) };

  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API Error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ===============================
// MODAL HANDLING
// ===============================
function showModal(title, message, buttons = [{ text: "OK", action: closeModal }]) {
  const modal = document.getElementById("customModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalMessage = document.getElementById("modalMessage");
  const modalButtons = document.getElementById("modalButtons");

  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalButtons.innerHTML = "";

  buttons.forEach((btn) => {
    const b = document.createElement("button");
    b.type = "button"; // prevent accidental form submits
    b.textContent = btn.text;
    b.addEventListener("click", () => {
      if (typeof btn.action === "function") btn.action();
      closeModal();
    });
    modalButtons.appendChild(b);
  });

  modal.style.display = "flex";
}

function closeModal() {
  const modal = document.getElementById("customModal");
  modal.style.display = "none";
}

// ===============================
// LOGIN HANDLING
// ===============================
async function handleLogin(event) {
  event.preventDefault();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !password) {
    return showModal("Login Error", "Please enter both username and password.");
  }

  try {
    const data = await apiFetch("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });

    if (data.success) {
      showModal("Login Successful", "Welcome back!", [
        { text: "Continue", action: () => (window.location.href = "/dashboard") }
      ]);
    } else {
      showModal("Login Failed", data.message || "Invalid credentials.");
    }
  } catch (err) {
    showModal("Error", err.message);
  }
}

// ===============================
// LOGOUT HANDLING
// ===============================
async function handleLogout() {
  try {
    await apiFetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  } catch (err) {
    showModal("Error", err.message);
  }
}

// ===============================
// EVENT BINDINGS
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.type = "button";
    logoutBtn.addEventListener("click", handleLogout);
  }

  // modal close on outside click
  const modal = document.getElementById("customModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
});
