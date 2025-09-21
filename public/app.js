// -------------------
// Base helpers
// -------------------
async function apiFetch(url, options = {}) {
  console.log('Making API request to:', url);
  
  const res = await fetch(url, {
    credentials: "include", // keep session cookies
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  
  console.log('Response status:', res.status);
  console.log('Response URL:', res.url);
  
  // Check if we got redirected to login (common sign of auth failure)
  if (res.url.includes('login') || res.url.includes('index.html')) {
    throw new Error('Authentication required - please log in');
  }
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error('API Error:', errorText);
    throw new Error(errorText);
  }
  
  // Make sure we're getting JSON back
  const contentType = res.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const responseText = await res.text();
    console.error('Expected JSON but got:', responseText.substring(0, 200));
    throw new Error('Server returned HTML instead of JSON - likely an authentication issue');
  }
  
  return res.json();
}

function go(url) {
  console.log('Navigating to:', url);
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
    
    console.log('Attempting login for:', email);
    
    try {
      const result = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      
      console.log('Login successful:', result);
      go("dashboard.html");
    } catch (err) {
      console.error('Login error:', err);
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
    
    console.log('Attempting signup for:', email);
    
    try {
      const result = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      
      console.log('Signup successful:', result);
      go("dashboard.html");
    } catch (err) {
      console.error('Signup error:', err);
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
  console.log('DOM loaded, initializing app...');
  
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

    // Load classes
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

    // Load students
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

  // Debug logging
  console.log("saveRecitaBtn found:", !!saveRecitaBtn);
  console.log("pickSection found:", !!pickSection);

  if (saveRecitaBtn) {
    const classId = localStorage.getItem("classId");
    console.log("Class ID from localStorage:", classId);
    
    saveRecitaBtn.addEventListener("click", async () => {
      const topicInput = document.getElementById("topicInput");
      if (!topicInput) {
        alert("Topic input not found!");
        return;
      }
      
      const topic = topicInput.value;
      console.log("Saving recita with topic:", topic, "and classId:", classId);
      
      if (!topic.trim()) {
        alert("Please enter a topic for the recita");
        return;
      }
      
      try {
        const recita = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ classId, topic }),
        });
        console.log("Recita saved, response:", recita);
        localStorage.setItem("recitaId", recita.id);
        if (pickSection) {
          pickSection.classList.remove("hidden");
        }
      } catch (err) {
        console.error("Save recita error:", err);
        alert("Failed to save recita: " + err.message);
      }
    });
  }

  // Set up pick student event listener using event delegation
  console.log("Setting up pick student event listener");
  
  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "pickStudentBtn") {
      e.preventDefault();
      console.log("Pick student button clicked!");
      
      const recitaId = localStorage.getItem("recitaId");
      console.log("Pick student clicked, recitaId:", recitaId);
      
      if (!recitaId || recitaId === 'null' || recitaId === 'undefined') {
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
        
        const studentName = document.getElementById("selectedStudent");
        const studentModal = document.getElementById("studentModal");
        
        if (studentName && studentModal) {
          studentName.textContent = student.name;
          studentModal.classList.remove("hidden");
          studentModal.classList.add("flex");
          studentModal.dataset.studentId = student.id;
        } else {
          console.error("Student modal elements not found");
          alert(`Selected student: ${student.name}`);
        }
      } catch (err) {
        console.error("Pick student error:", err);
        alert("Failed to pick student: " + err.message);
      }
    }
  });

  // Handle score recording
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("scoreBtn")) {
      const score = e.target.dataset.score;
      const recitaId = localStorage.getItem("recitaId");
      const studentModal = document.getElementById("studentModal");
      const studentId = studentModal ? studentModal.dataset.studentId : null;
      
      console.log("Recording score:", score, "for student:", studentId, "in recita:", recitaId);
      
      if (!recitaId || !studentId) {
        alert("Missing recita or student ID");
        return;
      }
      
      try {
        await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ recitaId, studentId, score }),
        });
        console.log("Score recorded successfully");
        
        if (studentModal) {
          studentModal.classList.add("hidden");
          studentModal.classList.remove("flex");
        }
      } catch (err) {
        console.error("Failed to record score", err);
        alert("Failed to record score: " + err.message);
      }
    }
  });

  // -------------------
  // EXPORT CSV
  // -------------------
  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const classId = localStorage.getItem("classId");
      if (!classId) {
        alert("No class selected");
        return;
      }
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
