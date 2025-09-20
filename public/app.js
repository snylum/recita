// Handle signup
async function signup() {
  const username = document.getElementById("signup-username").value;
  const password = document.getElementById("signup-password").value;
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  });
  if (res.ok) {
    alert("Signup successful! Please log in.");
  } else {
    alert("Signup failed.");
  }
}

// Handle login
async function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ username, password })
  });
  if (res.ok) {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("main-section").style.display = "block";
  } else {
    alert("Login failed.");
  }
}

// Handle logout
async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("main-section").style.display = "none";
}

// Add a class/section
async function addClass() {
  const className = document.getElementById("class-name").value;
  const res = await fetch("/api/roster/class", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ name: className })
  });
  if (res.ok) {
    loadClasses();
  }
}

// Load classes
async function loadClasses() {
  const res = await fetch("/api/roster/classes");
  const classes = await res.json();
  const div = document.getElementById("classes");
  div.innerHTML = "";
  classes.forEach(c => {
    const el = document.createElement("div");
    el.textContent = c.name;
    div.appendChild(el);
  });
}

// Pick a random student
async function pickStudent() {
  const res = await fetch("/api/attendance/pick");
  const data = await res.json();
  const div = document.getElementById("picked-student");
  div.innerHTML = `<strong>${data.name}</strong> (Section: ${data.class})`;
}

// Export CSV
async function exportCSV() {
  const res = await fetch("/api/export/csv");
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "recita_export.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
