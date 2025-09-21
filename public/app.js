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

  // Debug logging
  console.log("saveRecitaBtn found:", saveRecitaBtn);
  console.log("pickStudentBtn found:", pickStudentBtn);
  console.log("studentModal found:", studentModal);

  if (saveRecitaBtn) {
    const classId = localStorage.getItem("classId");
    console.log("Class ID from localStorage:", classId);
    
    saveRecitaBtn.addEventListener("click", async () => {
      const topic = document.getElementById("topicInput").value;
      console.log("Saving recita with topic:", topic, "and classId:", classId);
      
      try {
        const recita = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ classId, topic }),
        });
        console.log("Recita saved, response:", recita);
        localStorage.setItem("recitaId", recita.id);
        pickSection.classList.remove("hidden");
      } catch (err) {
        console.error("Save recita error:", err);
        alert("Failed to save recita: " + err.message);
      }
    });
  }

  if (pickStudentBtn && studentModal) {
    console.log("Setting up pick student event listener");
    
    pickStudentBtn.addEventListener("click", async () => {
      const recitaId = localStorage.getItem("recitaId");
      console.log("Pick student clicked, recitaId:", recitaId);
      
      if (!recitaId) {
        alert("No recita ID found. Please save a recita first.");
        return;
      }
      
      try {
        console.log("Making request to:", `/attendance/pick?recitaId=${recitaId}`);
        const student = await apiFetch(`/attendance/pick?recitaId=${recitaId}`);
        console.log("Student picked:", student);
        
        if (!student) {
          alert("All students already picked!");
          return;
        }
        
        studentName.textContent = student.name;
        studentModal.classList.remove("hidden");
        studentModal.classList.add("flex");
        studentModal.dataset.studentId = student.id;
      } catch (err) {
        console.error("Pick student error:", err);
        alert("Failed to pick student: " + err.message);
      }
    });

    studentModal.addEventListener("click", async (e) => {
      if (e.target.classList.contains("scoreBtn")) {
        const score = e.target.dataset.score;
        const recitaId = localStorage.getItem("recitaId");
        const studentId = studentModal.dataset.studentId;
        
        console.log("Recording score:", score, "for student:", studentId, "in recita:", recitaId);
        
        try {
          await apiFetch("/attendance", {
            method: "POST",
            body: JSON.stringify({ recitaId, studentId, score }),
          });
          console.log("Score recorded successfully");
        } catch (err) {
          console.error("Failed to record score", err);
          alert("Failed to record score: " + err.message);
        }
        
        studentModal.classList.add("hidden");
        studentModal.classList.remove("flex");
      }
    });
  } else {
    console.log("Pick student button or modal not found - event listener not attached");
  }

  // -------------------
  // EXPORT CSV
  // -------------------
  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const classId = localStorage.getItem("classId");
      window.location.href = `/export?classId=${classId}`;
    });
  }
});

// --- Insert favicon dynamically ---
(function() {
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = "/logo.png";
  document.head.appendChild(link);
})();

// --- Style Recita with logo ---
function addRecitaLogos() {
  // Find all text nodes that contain "Recita"
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const textNodes = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.textContent.includes("Recita")) {
      textNodes.push(node);
    }
  }

  textNodes.forEach(textNode => {
    const parent = textNode.parentNode;
    if (parent && parent.tagName !== "SCRIPT" && parent.tagName !== "STYLE") {
      const newHTML = textNode.textContent.replace(
        /Recita/g,
        '<img src="/logo.png" alt="Recita Logo" style="width:24px; height:24px; vertical-align:middle; margin-right:8px; display:inline-block;"><span style="color:#fe731f; font-weight:bold;">Recita</span>'
      );
      
      // Only replace if the text actually changed
      if (newHTML !== textNode.textContent) {
        parent.innerHTML = parent.innerHTML.replace(textNode.textContent, newHTML);
      }
    }
  });

  // Also handle elements that might have "Recita" as their only content
  document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, div").forEach(el => {
    if (el.textContent.trim() === "Recita" && el.children.length === 0) {
      el.innerHTML = '<img src="/logo.png" alt="Recita Logo" style="width:24px; height:24px; vertical-align:middle; margin-right:8px; display:inline-block;"><span style="color:#fe731f; font-weight:bold;">Recita</span>';
    }
  });
}

// Run multiple times to ensure it catches everything
document.addEventListener("DOMContentLoaded", () => {
  addRecitaLogos();
  setTimeout(addRecitaLogos, 100);
  setTimeout(addRecitaLogos, 500);
});
