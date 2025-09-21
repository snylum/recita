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
  
  // Check if we got redirected away from our intended endpoint
  // Only check for redirects if the URL changed to a different path
  const originalPath = new URL(url, window.location.origin).pathname;
  const responsePath = new URL(res.url).pathname;
  
  if (originalPath !== responsePath && (res.url.includes('index.html') || responsePath === '/')) {
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
  // GUEST/DEMO MODE - Simple Recita without login
  // -------------------
  const guestRecitaContainer = document.getElementById("guestRecita");
  const studentListTextarea = document.getElementById("guestStudentList");
  const guestPickBtn = document.getElementById("guestPickBtn");
  const guestCalledList = document.getElementById("guestCalledStudents");
  
  if (guestRecitaContainer) {
    console.log("Guest mode detected");
    
    // Guest pick student functionality
    if (guestPickBtn) {
      guestPickBtn.addEventListener("click", () => {
        const studentText = studentListTextarea ? studentListTextarea.value.trim() : '';
        if (!studentText) {
          alert("Please paste student names first (one per line)");
          return;
        }
        
        const allStudents = studentText.split('\n').map(s => s.trim()).filter(Boolean);
        const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
        const calledNames = calledStudents.map(s => s.name);
        
        // Get students who haven't been called yet
        const availableStudents = allStudents.filter(name => !calledNames.includes(name));
        
        if (availableStudents.length === 0) {
          alert("All students have been called!");
          return;
        }
        
        // Pick random student
        const randomIndex = Math.floor(Math.random() * availableStudents.length);
        const selectedStudent = availableStudents[randomIndex];
        
        // Show guest modal
        showGuestStudentModal(selectedStudent);
      });
    }
  }
  
  // Guest modal functionality
  function showGuestStudentModal(studentName) {
    // Create or update guest modal
    let modal = document.getElementById("guestStudentModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "guestStudentModal";
      modal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 class="text-xl font-bold mb-4 text-center">Selected Student</h3>
          <p class="text-2xl font-semibold text-center mb-6" id="guestSelectedStudentName">${studentName}</p>
          <div class="grid grid-cols-2 gap-3">
            <button class="guestScoreBtn bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium" data-score="10">10 pts</button>
            <button class="guestScoreBtn bg-green-400 hover:bg-green-500 text-white py-3 px-4 rounded-lg font-medium" data-score="5">5 pts</button>
            <button class="guestScoreBtn bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-lg font-medium" data-score="custom">Custom</button>
            <button class="guestScoreBtn bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-lg font-medium" data-score="skip">Skip</button>
            <button class="guestScoreBtn bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-lg font-medium" data-score="absent">Absent</button>
            <button id="guestModalClose" class="bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      
      // Add event listeners
      modal.addEventListener("click", (e) => {
        if (e.target.classList.contains("guestScoreBtn")) {
          let score = e.target.dataset.score;
          
          if (score === "custom") {
            const customScore = prompt("Enter custom score:");
            if (customScore === null) return; // User cancelled
            score = customScore || "custom";
          }
          
          addToGuestCalledList(studentName, score);
          modal.remove();
        } else if (e.target.id === "guestModalClose" || e.target === modal) {
          modal.remove();
        }
      });
    } else {
      document.getElementById("guestSelectedStudentName").textContent = studentName;
      modal.style.display = "flex";
    }
  }
  
  // Add student to guest called list
  function addToGuestCalledList(studentName, score) {
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    
    calledStudents.push({
      name: studentName,
      score: score,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Sort by last name
    calledStudents.sort((a, b) => {
      const lastNameA = a.name.split(' ').pop().toLowerCase();
      const lastNameB = b.name.split(' ').pop().toLowerCase();
      return lastNameA.localeCompare(lastNameB);
    });
    
    localStorage.setItem("guestCalledStudents", JSON.stringify(calledStudents));
    updateGuestCalledDisplay();
  }
  
  // Update guest called students display
  function updateGuestCalledDisplay() {
    const container = document.getElementById("guestCalledStudents");
    if (!container) return;
    
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    
    if (calledStudents.length === 0) {
      container.innerHTML = '<p class="text-gray-500 italic">No students called yet</p>';
      return;
    }
    
    container.innerHTML = calledStudents.map((student, index) => {
      let scoreDisplay = student.score;
      let scoreClass = "bg-gray-100";
      
      if (student.score === 'absent') {
        scoreClass = "bg-red-100 text-red-800";
        scoreDisplay = "Absent";
      } else if (student.score === 'skip') {
        scoreClass = "bg-yellow-100 text-yellow-800";
        scoreDisplay = "Skip";
      } else if (student.score === 'custom') {
        scoreClass = "bg-purple-100 text-purple-800";
        scoreDisplay = "Custom";
      } else if (parseInt(student.score)) {
        scoreClass = "bg-green-100 text-green-800";
        scoreDisplay = student.score + " pts";
      }
      
      return `
        <div class="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border mb-2">
          <div class="flex items-center space-x-3">
            <span class="text-sm text-gray-500 w-6">${index + 1}.</span>
            <span class="font-medium">${student.name}</span>
            <span class="text-xs text-gray-400">${student.timestamp}</span>
          </div>
          <span class="px-2 py-1 rounded text-sm ${scoreClass}">
            ${scoreDisplay}
          </span>
        </div>
      `;
    }).join('');
  }
  
  // Initialize guest mode display
  if (document.getElementById("guestCalledStudents")) {
    updateGuestCalledDisplay();
  }
  
  // Guest export/save buttons - prompt for login
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("guestSaveBtn")) {
      const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
      if (calledStudents.length === 0) {
        alert("No student data to save. Call some students first!");
        return;
      }
      
      if (confirm("To save your data and export to CSV, you need to create an account or log in. Would you like to continue?")) {
        // Show login/signup options
        showAuthModal();
      }
    }
  });
  
  // Show authentication modal
  function showAuthModal() {
    let authModal = document.getElementById("authModal");
    if (!authModal) {
      authModal = document.createElement("div");
      authModal.id = "authModal";
      authModal.className = "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
      authModal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 class="text-xl font-bold mb-4 text-center">Save Your Data</h3>
          <p class="text-gray-600 mb-6 text-center">Create an account or log in to save your recita data and export to CSV</p>
          <div class="space-y-3">
            <button id="goToSignup" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-medium">Create Account</button>
            <button id="goToLogin" class="w-full bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium">Log In</button>
            <button id="authModalClose" class="w-full bg-gray-500 hover:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(authModal);
      
      authModal.addEventListener("click", (e) => {
        if (e.target.id === "goToSignup") {
          go("signup.html");
        } else if (e.target.id === "goToLogin") {
          go("index.html");
        } else if (e.target.id === "authModalClose" || e.target === authModal) {
          authModal.remove();
        }
      });
    }
  }

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
  const recitaStatus = document.getElementById("recitaStatus");

  // Debug logging
  console.log("saveRecitaBtn found:", !!saveRecitaBtn);
  console.log("pickSection found:", !!pickSection);

  if (saveRecitaBtn) {
    const classId = localStorage.getItem("classId");
    console.log("Class ID from localStorage:", classId);
    
    // Check if we already have a saved recita
    const existingRecitaId = localStorage.getItem("recitaId");
    if (existingRecitaId) {
      console.log("Found existing recita ID:", existingRecitaId);
      if (pickSection) {
        pickSection.classList.remove("hidden");
      }
      // Show current recita info
      displayRecitaStatus();
    }
    
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
        // Get current date and time in user's timezone
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        
        const recita = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ 
            classId, 
            topic,
            date: dateStr,
            time: timeStr
          }),
        });
        console.log("Recita saved, response:", recita);
        
        // Store the recita ID
        localStorage.setItem("recitaId", recita.id);
        localStorage.setItem("recitaTopic", topic);
        localStorage.setItem("recitaDate", dateStr);
        localStorage.setItem("recitaTime", timeStr);
        
        // Clear any previous called students for this new recita
        localStorage.removeItem("calledStudents");
        
        // Clear existing called students display if it exists
        const existingContainer = document.getElementById("calledStudentsContainer");
        if (existingContainer) {
          existingContainer.remove();
        }
        
        if (pickSection) {
          pickSection.classList.remove("hidden");
        }
        
        // Update the display
        displayRecitaStatus();
        
      } catch (err) {
        console.error("Save recita error:", err);
        alert("Failed to save recita: " + err.message);
      }
    });
  }

  // Function to display current recita status
  function displayRecitaStatus() {
    const topic = localStorage.getItem("recitaTopic");
    const date = localStorage.getItem("recitaDate");
    const time = localStorage.getItem("recitaTime");
    const recitaId = localStorage.getItem("recitaId");
    
    if (topic && date && time && recitaId) {
      // Try to find or create a status display element
      let statusElement = document.getElementById("recitaStatus");
      if (!statusElement) {
        // Create status element if it doesn't exist
        statusElement = document.createElement("div");
        statusElement.id = "recitaStatus";
        statusElement.className = "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4";
        
        // Insert after the save button or at the top of pick section
        const saveBtn = document.getElementById("saveRecitaBtn");
        const pickSectionEl = document.getElementById("pickSection");
        
        if (saveBtn && saveBtn.parentNode) {
          saveBtn.parentNode.insertBefore(statusElement, saveBtn.nextSibling);
        } else if (pickSectionEl) {
          pickSectionEl.insertBefore(statusElement, pickSectionEl.firstChild);
        }
      }
      
      statusElement.innerHTML = `
        <div class="flex justify-between items-center">
          <div>
            <strong>Current Recita:</strong> ${topic}<br>
            <small class="text-green-600">${date} at ${time}</small>
          </div>
          <button id="editRecitaBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm">
            ✏️ Edit
          </button>
        </div>
      `;
      
      // Add edit functionality
      const editBtn = document.getElementById("editRecitaBtn");
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          const topicInput = document.getElementById("topicInput");
          if (topicInput) {
            topicInput.value = topic;
            topicInput.focus();
          }
        });
      }
    }
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
      const studentName = studentModal ? document.getElementById("selectedStudent").textContent : null;
      
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
        
        // Add to called students list
        addToCalledStudentsList(studentName, score);
        
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

  // Function to add student to the called list
  function addToCalledStudentsList(studentName, score) {
    if (!studentName) return;
    
    // Get or create the called students container
    let calledContainer = document.getElementById("calledStudentsContainer");
    if (!calledContainer) {
      // Create the container
      calledContainer = document.createElement("div");
      calledContainer.id = "calledStudentsContainer";
      calledContainer.className = "mt-6";
      calledContainer.innerHTML = `
        <h3 class="text-lg font-semibold mb-3">Called Students</h3>
        <div id="calledStudentsList" class="space-y-2"></div>
      `;
      
      // Insert after pick section or at the end of the page
      const pickSection = document.getElementById("pickSection");
      if (pickSection && pickSection.parentNode) {
        pickSection.parentNode.insertBefore(calledContainer, pickSection.nextSibling);
      } else {
        document.body.appendChild(calledContainer);
      }
    }
    
    const calledList = document.getElementById("calledStudentsList");
    if (!calledList) return;
    
    // Get existing called students from localStorage
    const calledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
    
    // Add new student
    const studentEntry = {
      name: studentName,
      score: score,
      timestamp: new Date().toLocaleTimeString()
    };
    
    calledStudents.push(studentEntry);
    
    // Sort alphabetically by last name
    calledStudents.sort((a, b) => {
      const lastNameA = a.name.split(' ').pop().toLowerCase();
      const lastNameB = b.name.split(' ').pop().toLowerCase();
      return lastNameA.localeCompare(lastNameB);
    });
    
    // Save back to localStorage
    localStorage.setItem("calledStudents", JSON.stringify(calledStudents));
    
    // Update the display
    updateCalledStudentsDisplay();
  }
  
  // Function to update the called students display
  function updateCalledStudentsDisplay() {
    const calledList = document.getElementById("calledStudentsList");
    if (!calledList) return;
    
    const calledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
    
    if (calledStudents.length === 0) {
      calledList.innerHTML = '<p class="text-gray-500 italic">No students called yet</p>';
      return;
    }
    
    calledList.innerHTML = calledStudents.map((student, index) => {
      let scoreDisplay = student.score;
      let scoreClass = "bg-gray-100";
      
      // Style different score types
      if (student.score === 'absent') {
        scoreClass = "bg-red-100 text-red-800";
        scoreDisplay = "Absent";
      } else if (student.score === 'skip') {
        scoreClass = "bg-yellow-100 text-yellow-800";
        scoreDisplay = "Skip";
      } else if (student.score === 'custom') {
        scoreClass = "bg-purple-100 text-purple-800";
        scoreDisplay = "Custom";
      } else if (parseInt(student.score)) {
        scoreClass = "bg-green-100 text-green-800";
        scoreDisplay = student.score + " pts";
      }
      
      return `
        <div class="flex justify-between items-center p-3 bg-white rounded-lg shadow-sm border">
          <div class="flex items-center space-x-3">
            <span class="text-sm text-gray-500 w-6">${index + 1}.</span>
            <span class="font-medium">${student.name}</span>
            <span class="text-xs text-gray-400">${student.timestamp}</span>
          </div>
          <span class="px-2 py-1 rounded text-sm ${scoreClass}">
            ${scoreDisplay}
          </span>
        </div>
      `;
    }).join('');
  }
  
  // Initialize called students display on page load
  if (document.getElementById("pickSection")) {
    // Small delay to ensure DOM is ready
    setTimeout(() => {
      const existingCalledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
      if (existingCalledStudents.length > 0) {
        // Create container if students exist
        addToCalledStudentsList("", ""); // This will create the container
        updateCalledStudentsDisplay();
      }
    }, 500);
  }

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
  // Skip if already processed
  if (document.body.dataset.recitaLogosProcessed === 'true') {
    return;
  }

  // Process each element that contains "Recita" only once
  document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, div, a, button").forEach(el => {
    // Skip if already processed or contains images
    if (el.dataset.recitaProcessed === 'true' || el.querySelector('img[alt="Recita Logo"]')) {
      return;
    }

    // Only process if the element directly contains "Recita" text
    if (el.textContent.includes("Recita") && el.children.length === 0) {
      // Get computed font size for this element
      const fontSize = window.getComputedStyle(el).fontSize;
      
      el.innerHTML = el.textContent.replace(
        /Recita/g,
        `<img src="/logo.png" alt="Recita Logo" style="height:${fontSize}; width:auto; vertical-align:middle; margin-right:0.3em; display:inline-block;"><span style="color:#fe731f; font-weight:bold;">Recita</span>`
      );
      
      // Mark as processed
      el.dataset.recitaProcessed = 'true';
    }
  });

  // Mark body as processed
  document.body.dataset.recitaLogosProcessed = 'true';
}

// Run multiple times to ensure it catches everything
document.addEventListener("DOMContentLoaded", () => {
  addRecitaLogos();
  setTimeout(addRecitaLogos, 100);
  setTimeout(addRecitaLogos, 500);
});
