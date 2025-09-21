// -------------------
// Base helpers
// -------------------
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include", // keep session cookies
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function go(url) {
  window.location.href = url;
}

// -------------------
// AUTH FORMS
// -------------------
function setupLogin(apiFetch, go) {
  const form = document.getElementById("loginForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      go("dashboard.html");
    } catch (err) {
      alert("Login failed: " + err.message);
    }
  });
}

function setupSignup(apiFetch, go) {
  const form = document.getElementById("signupForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
      await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      go("dashboard.html");
    } catch (err) {
      alert("Signup failed: " + err.message);
    }
  });
}

function setupLogout(apiFetch, go) {
  const btn = document.getElementById("logoutBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
      go("index.html");
    } catch (err) {
      alert("Logout failed: " + err.message);
    }
  });
}

// -------------------
// INIT APP
// -------------------
document.addEventListener("DOMContentLoaded", () => {
  // Setup authentication
  setupLogin(apiFetch, go);
  setupSignup(apiFetch, go);
  setupLogout(apiFetch, go);

  // -------------------
  // DASHBOARD: CREATE + LIST CLASSES
  // -------------------
  const createClassForm = document.getElementById("createClassForm");
  const classList = document.getElementById("classList");

  if (createClassForm) {
    createClassForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("className").value;
      try {
        await apiFetch("/classes", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
        location.reload();
      } catch (err) {
        alert("Failed to create class: " + err.message);
      }
    });

    (async () => {
      try {
        const classes = await apiFetch("/classes");
        classes.forEach((c) => {
          const div = document.createElement("div");
          div.className =
            "bg-white p-4 rounded-lg shadow hover:bg-gray-50 cursor-pointer";
          div.textContent = c.name;
          div.addEventListener("click", () => {
            localStorage.setItem("classId", c.id);
            go("class.html");
          });
          classList.appendChild(div);
        });
      } catch (err) {
        console.error("Failed to load classes", err);
      }
    })();
  }

  // -------------------
  // CLASS PAGE: ADD STUDENTS + LIST
  // -------------------
  const addStudentsBtn = document.getElementById("addStudentsBtn");
  const studentInput = document.getElementById("studentInput");
  const studentList = document.getElementById("studentList");

  if (addStudentsBtn) {
    const classId = localStorage.getItem("classId");

    addStudentsBtn.addEventListener("click", async () => {
      const names = studentInput.value
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      if (!names.length) return;

      try {
        await apiFetch("/students", {
          method: "POST",
          body: JSON.stringify({ classId, students: names }),
        });
        location.reload();
      } catch (err) {
        alert("Failed to add students: " + err.message);
      }
    });

    (async () => {
      try {
        const students = await apiFetch(`/students?classId=${classId}`);
        students.forEach((s) => {
          const li = document.createElement("li");
          li.textContent = s.name;
          li.className = "p-2 border rounded";
          studentList.appendChild(li);
        });
      } catch (err) {
        console.error("Failed to load students", err);
      }
    })();
  }

  // -------------------
  // RECITA PAGE
  // -------------------
  const saveRecitaBtn = document.getElementById("saveRecitaBtn");
  const pickSection = document.getElementById("pickSection");
  const pickStudentBtn = document.getElementById("pickStudentBtn");
  const studentModal = document.getElementById("studentModal");
  const studentName = document.getElementById("selectedStudent");

  if (saveRecitaBtn) {
    const classId = localStorage.getItem("classId");
    saveRecitaBtn.addEventListener("click", async () => {
      const topic = document.getElementById("topicInput").value;
      try {
        const recita = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ classId, topic }),
        });
        localStorage.setItem("recitaId", recita.id);
        pickSection.classList.remove("hidden");
      } catch (err) {
        alert("Failed to save recita: " + err.message);
      }
    });
  }

  if (pickStudentBtn && studentModal) {
    pickStudentBtn.addEventListener("click", async () => {
      const recitaId = localStorage.getItem("recitaId");
      try {
        const student = await apiFetch(`/attendance/pick?recitaId=${recitaId}`);
        if (!student) return alert("All students already picked!");
        studentName.textContent = student.name;
        studentModal.classList.remove("hidden");
        studentModal.classList.add("flex");
        studentModal.dataset.studentId = student.id;
      } catch (err) {
        alert("Failed to pick student: " + err.message);
      }
    });

    studentModal.addEventListener("click", async (e) => {
      if (e.target.classList.contains("scoreBtn")) {
        const score = e.target.dataset.score;
        const recitaId = localStorage.getItem("recitaId");
        const studentId = studentModal.dataset.studentId;
        try {
          await apiFetch("/attendance/mark", {
            method: "POST",
            body: JSON.stringify({ recitaId, studentId, score }),
          });
        } catch (err) {
          console.error("Failed to record score", err);
        }
        studentModal.classList.add("hidden");
        studentModal.classList.remove("flex");
      }
    });
  }

  // -------------------
  // EXPORT CSV
  // -------------------
  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const classId = localStorage.getItem("classId");
      window.location.href = `/download-csv?classId=${classId}`;
    });
  }
});

document.querySelectorAll("body *").forEach(el => {
  if (el.childNodes.length === 1 && el.childNodes[0].nodeType === 3) {
    if (el.textContent.includes("Recita")) {
      el.innerHTML = el.textContent.replace(/Recita/g, '<span class="brand">Recita</span>');
    }
  }
});

