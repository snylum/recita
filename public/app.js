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
// MODAL SYSTEM (consistent styling)
// -------------------
function showModal(content, title = null) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      ${title ? `<h3 style="margin-top: 0; margin-bottom: 15px;">${title}</h3>` : ''}
      ${content}
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function showInfoModal(message, title = "Information") {
  const existingModal = document.getElementById("infoModal");
  if (existingModal) {
    existingModal.remove();
  }
  
  const modal = showModal(`
    <p style="color: #666; margin-bottom: 20px; line-height: 1.4;">${message}</p>
    <button onclick="this.closest('.modal').remove()" style="margin: 0;">OK</button>
  `, title);
  
  modal.id = "infoModal";
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

function showConfirmModal(message, onConfirm, onCancel = null, title = "Confirm") {
  const modal = showModal(`
    <p style="color: #666; margin-bottom: 20px; line-height: 1.4;">${message}</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <button id="confirmBtn" style="margin: 0; background: #ef4444;">Yes</button>
      <button id="cancelBtn" style="margin: 0; background: #6b7280;">Cancel</button>
    </div>
  `, title);
  
  modal.querySelector('#confirmBtn').addEventListener('click', () => {
    modal.remove();
    if (onConfirm) onConfirm();
  });
  
  modal.querySelector('#cancelBtn').addEventListener('click', () => {
    modal.remove();
    if (onCancel) onCancel();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
      if (onCancel) onCancel();
    }
  });
}

// -------------------
// AUTH FORMS
// -------------------
function setupLogin(apiFetch, callback) {
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
      callback("dashboard.html");
    } catch (err) {
      console.error('Login error:', err);
      showInfoModal("Login failed: " + err.message, "Login Error");
    }
  });
}

function setupSignup(apiFetch, callback) {
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
      callback("dashboard.html");
    } catch (err) {
      console.error('Signup error:', err);
      showInfoModal("Signup failed: " + err.message, "Signup Error");
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
      showInfoModal("Logout failed: " + err.message, "Logout Error");
    }
  });
}

// -------------------
// INIT APP
// -------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM loaded, initializing app...');
  
  // Initialize guest mode
  initGuestMode();
  
  // Setup authentication with post-auth callback
  setupLogin(apiFetch, (url) => {
    // Check if user came from export flow
    const fromExport = localStorage.getItem('pendingExport');
    if (fromExport === 'true') {
      localStorage.removeItem('pendingExport');
      showExportSuccessModal();
    } else {
      window.location.href = url;
    }
  });
  
  setupSignup(apiFetch, (url) => {
    // Check if user came from export flow
    const fromExport = localStorage.getItem('pendingExport');
    if (fromExport === 'true') {
      localStorage.removeItem('pendingExport');
      showExportSuccessModal();
    } else {
      window.location.href = url;
    }
  });
  
  setupLogout(apiFetch, go);

  // -------------------
  // GUEST MODE FUNCTIONALITY
  // -------------------
  
  // Initialize guest mode on page load
  function initGuestMode() {
    // Load existing topic if any
    const savedTopic = localStorage.getItem("guestTopic");
    const savedDate = localStorage.getItem("guestTopicDate");
    const savedTime = localStorage.getItem("guestTopicTime");
    
    if (savedTopic) {
      const topicInput = document.getElementById("guestTopic");
      const topicStatus = document.getElementById("guestTopicStatus");
      const topicDisplay = document.getElementById("guestTopicDisplay");
      const dateDisplay = document.getElementById("guestDateDisplay");
      
      if (topicInput) topicInput.value = savedTopic;
      if (topicDisplay) topicDisplay.textContent = savedTopic;
      if (dateDisplay) dateDisplay.textContent = `Saved on ${savedDate} at ${savedTime}`;
      if (topicStatus) topicStatus.style.display = "block";
    }
    
    // Load existing students and called list
    updateGuestCalledDisplay();
  }
  
  // Save topic functionality
  document.addEventListener("keyup", (e) => {
    if (e.target && e.target.id === "guestTopic") {
      const topic = e.target.value.trim();
      if (topic && topic.length > 0) {
        const now = new Date();
        const dateStr = now.toLocaleDateString();
        const timeStr = now.toLocaleTimeString();
        
        localStorage.setItem("guestTopic", topic);
        localStorage.setItem("guestTopicDate", dateStr);
        localStorage.setItem("guestTopicTime", timeStr);
        
        const topicStatus = document.getElementById("guestTopicStatus");
        const topicDisplay = document.getElementById("guestTopicDisplay");
        const dateDisplay = document.getElementById("guestDateDisplay");
        
        if (topicDisplay) topicDisplay.textContent = topic;
        if (dateDisplay) dateDisplay.textContent = `Saved on ${dateStr} at ${timeStr}`;
        if (topicStatus) topicStatus.style.display = "block";
      }
    }
  });

  const guestRecitaContainer = document.getElementById("guestRecita");
  const studentListTextarea = document.getElementById("guestStudentList");
  const guestPickBtn = document.getElementById("guestPickBtn");
  const guestClearBtn = document.getElementById("guestClearBtn");
  
  if (guestRecitaContainer) {
    console.log("Guest mode detected");
    
    // Guest pick student functionality - UPDATED to handle skipped students
    if (guestPickBtn) {
      guestPickBtn.addEventListener("click", () => {
        const studentText = studentListTextarea ? studentListTextarea.value.trim() : '';
        if (!studentText) {
          showInfoModal("Please paste student names first!");
          return;
        }

        // Get all students
        const allStudents = studentText.split('\n')
          .map(name => name.trim())
          .filter(name => name.length > 0);

        if (allStudents.length === 0) {
          showInfoModal("No valid student names found. Please check your list!");
          return;
        }

        // Get students who haven't been called OR were skipped (can be called again)
        const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
        const finalAnsweredStudents = calledStudents.filter(s => 
          s.score !== 'skip' // Only exclude students who actually answered (not skipped)
        ).map(s => s.name);
        
        const availableStudents = allStudents.filter(name => 
          !finalAnsweredStudents.includes(name)
        );

        if (availableStudents.length === 0) {
          showInfoModal("All students have been called and answered! Clear the list to start over.");
          return;
        }

        // If a student was just skipped, don't pick them again immediately
        const lastCalled = calledStudents[calledStudents.length - 1];
        let eligibleStudents = availableStudents;
        
        if (lastCalled && lastCalled.score === 'skip' && availableStudents.length > 1) {
          eligibleStudents = availableStudents.filter(name => name !== lastCalled.name);
          // If after filtering we have no students, use all available
          if (eligibleStudents.length === 0) {
            eligibleStudents = availableStudents;
          }
        }

        // Pick random student from eligible ones
        const randomIndex = Math.floor(Math.random() * eligibleStudents.length);
        const pickedStudent = eligibleStudents[randomIndex];

        showGuestStudentModal(pickedStudent);
      });
    }
  }
  
  // Clear all guest data functionality - UPDATED to include topic
  if (guestClearBtn) {
    guestClearBtn.addEventListener("click", () => {
      showConfirmModal(
        "This will clear your topic, student list, and all called students. Are you sure you want to start over?",
        () => {
          // Clear all localStorage data
          localStorage.removeItem("guestTopic");
          localStorage.removeItem("guestTopicDate");
          localStorage.removeItem("guestTopicTime");
          localStorage.removeItem("guestCalledStudents");
          
          // Reset UI
          const topicInput = document.getElementById("guestTopic");
          const topicStatus = document.getElementById("guestTopicStatus");
          const studentListTextarea = document.getElementById("guestStudentList");
          
          if (topicInput) topicInput.value = "";
          if (topicStatus) topicStatus.style.display = "none";
          if (studentListTextarea) studentListTextarea.value = "";
          
          updateGuestCalledDisplay();
          showInfoModal("All data cleared! You can start a new recitation session.");
        },
        null,
        "Clear All Data"
      );
    });
  }
  
  // Show export success modal after authentication
  function showExportSuccessModal() {
    const modal = showModal(`
      <p>You can now download your student data as a CSV file.</p>
      <div style="margin-top: 20px;">
        <button id="downloadCsvBtn" style="background: #22c55e; margin-bottom: 10px;">
          Download CSV & Go to Dashboard
        </button>
        <button id="continueToDashboard" style="background: #3b82f6; margin-bottom: 10px;">
          Continue to Dashboard
        </button>
      </div>
    `, "Account Created Successfully!");

    // Download CSV functionality
    modal.querySelector("#downloadCsvBtn").addEventListener("click", () => {
      const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
      if (calledStudents.length === 0) {
        window.location.href = "dashboard.html";
        return;
      }

      // Generate and download CSV
      downloadGuestCSV();

      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1000);
    });

    modal.querySelector("#continueToDashboard").addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        window.location.href = "dashboard.html";
      }
    });
  }
  
  // Guest export/save buttons - show custom auth modal
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("guestSaveBtn")) {
      const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
      
      if (calledStudents.length === 0) {
        showInfoModal("No student data to export. Pick some students first!");
        return;
      }

      // Mark that user is trying to export
      localStorage.setItem('pendingExport', 'true');
      
      const modal = showModal(`
        <p>You have <strong>${calledStudents.length} students</strong> in your list.</p>
        <p>Create an account to download your data as a CSV file and save your progress.</p>
        <div style="margin-top: 20px;">
          <button id="authCreateAccount" style="background: #22c55e; margin-bottom: 10px;">
            Create Account & Export
          </button>
          <button id="authLogin" style="background: #3b82f6; margin-bottom: 10px;">
            Log In & Export
          </button>
          <button id="cancelAuth" style="background: #6b7280;">
            Cancel
          </button>
        </div>
      `, "Export Your Data");

      modal.querySelector("#authCreateAccount").addEventListener("click", () => {
        modal.remove();
        const loginModal = document.getElementById('loginModal');
        const loginSection = document.getElementById('loginSection');
        const signupSection = document.getElementById('signupSection');
        
        if (loginModal && loginSection && signupSection) {
          loginModal.style.display = 'flex';
          loginSection.style.display = 'none';
          signupSection.style.display = 'block';
        }
      });

      modal.querySelector("#authLogin").addEventListener("click", () => {
        modal.remove();
        const loginModal = document.getElementById('loginModal');
        const loginSection = document.getElementById('loginSection');
        const signupSection = document.getElementById('signupSection');
        
        if (loginModal && loginSection && signupSection) {
          loginModal.style.display = 'flex';
          loginSection.style.display = 'block';
          signupSection.style.display = 'none';
        }
      });

      modal.querySelector("#cancelAuth").addEventListener("click", () => {
        localStorage.removeItem('pendingExport');
        modal.remove();
      });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          localStorage.removeItem('pendingExport');
          modal.remove();
        }
      });
    }
  });
  
  // Guest modal functionality
  function showGuestStudentModal(studentName) {
    const existingModal = document.getElementById("guestStudentModal");
    if (existingModal) {
      existingModal.remove();
    }

    const modal = showModal(`
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
        <p style="font-size: 24px; font-weight: bold; margin: 0; color: #2c3e50;">${studentName}</p>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <button class="guestScoreBtn" data-score="10" style="margin: 0; background: #10b981;">10 pts</button>
        <button class="guestScoreBtn" data-score="5" style="margin: 0; background: #10b981;">5 pts</button>
        <button class="guestScoreBtn" data-score="custom" style="margin: 0; background: #8b5cf6;">Custom</button>
        <button class="guestScoreBtn" data-score="skip" style="margin: 0; background: #f59e0b;">Skip</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button class="guestScoreBtn" data-score="absent" style="margin: 0; background: #ef4444;">Absent</button>
        <button id="guestModalClose" style="margin: 0; background: #6b7280;">Cancel</button>
      </div>
    `, "Selected Student");
    
    modal.id = "guestStudentModal";
    
    // Add event listeners
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("guestScoreBtn")) {
        let score = e.target.dataset.score;
        
        if (score === "custom") {
          showCustomScoreModal(studentName, addToGuestCalledList);
          return;
        }
        
        addToGuestCalledList(studentName, score);
        modal.remove();
      } else if (e.target.id === "guestModalClose" || e.target === modal) {
        modal.remove();
      }
    });
  }
  
  // Custom score modal (reusable)
  function showCustomScoreModal(studentName, callback) {
    const existingModal = document.querySelector("#guestStudentModal, #customScoreModal");
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = showModal(`
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
        <p style="font-size: 20px; font-weight: bold; margin: 0; color: #2c3e50;">${studentName}</p>
      </div>
      <input id="customScoreInput" type="text" placeholder="Enter score (e.g., 7, Good, Excellent)" style="margin-bottom: 15px;" autofocus>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button id="saveCustomScore" style="margin: 0; background: #8b5cf6;">Save Score</button>
        <button id="cancelCustomScore" style="margin: 0; background: #6b7280;">Cancel</button>
      </div>
    `, "Custom Score");
    
    modal.id = "customScoreModal";
    
    const input = modal.querySelector("#customScoreInput");
    input.focus();
    
    modal.addEventListener("click", (e) => {
      if (e.target.id === "saveCustomScore") {
        const customScore = input.value.trim();
        if (customScore) {
          callback(studentName, 'custom', customScore);
          modal.remove();
        } else {
          input.style.borderColor = "#ef4444";
          input.placeholder = "Please enter a score";
        }
      } else if (e.target.id === "cancelCustomScore" || e.target === modal) {
        modal.remove();
      }
    });
    
    // Handle Enter key
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        modal.querySelector("#saveCustomScore").click();
      }
    });
  }
  
  // CSV download function
  function downloadGuestCSV() {
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    if (calledStudents.length === 0) return;

    const topic = localStorage.getItem("guestTopic") || "Demo Session";
    const savedDate = localStorage.getItem("guestTopicDate");
    const savedTime = localStorage.getItem("guestTopicTime");
    
    const date = savedDate || new Date().toLocaleDateString();
    const time = savedTime || new Date().toLocaleTimeString();

    let csvContent = `Recitation Topic: "${topic}"\n`;
    csvContent += `Date: ${date}\n`;
    csvContent += `Time: ${time}\n\n`;
    csvContent += "Student Name,Score,Time Called\n";
    
    calledStudents.forEach(student => {
      let scoreDisplay = student.score;
      if (student.score === 'custom' && student.customScore) {
        scoreDisplay = student.customScore;
      }
      csvContent += `"${student.name}","${scoreDisplay}","${student.timestamp}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTopic = topic.replace(/[^a-zA-Z0-9]/g, '-');
    a.download = `recita-${safeTopic}-${date.replace(/\//g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  }
  
  // Add student to guest called list
  function addToGuestCalledList(studentName, score, customScore = null) {
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    
    const studentEntry = {
      name: studentName,
      score: score,
      timestamp: new Date().toLocaleTimeString()
    };
    
    if (customScore) {
      studentEntry.customScore = customScore;
    }
    
    calledStudents.push(studentEntry);
    
    // Sort by last name
    calledStudents.sort((a, b) => {
      const lastNameA = a.name.split(' ').pop().toLowerCase();
      const lastNameB = b.name.split(' ').pop().toLowerCase();
      return lastNameA.localeCompare(lastNameB);
    });
    
    localStorage.setItem("guestCalledStudents", JSON.stringify(calledStudents));
    updateGuestCalledDisplay();
    
    // Check if all students called
    checkIfAllStudentsCalled();
  }
  
  // Check if all students have been called (for export option)
  function checkIfAllStudentsCalled() {
    const studentListTextarea = document.getElementById("guestStudentList");
    if (!studentListTextarea) return;
    
    const allStudents = studentListTextarea.value.trim().split('\n')
      .map(name => name.trim())
      .filter(name => name.length > 0);
    
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    const finalAnsweredStudents = calledStudents.filter(s => s.score !== 'skip');
    
    if (allStudents.length > 0 && finalAnsweredStudents.length >= allStudents.length) {
      // All students have been called, show export option
      setTimeout(() => {
        showConfirmModal(
          "All students have been called! Would you like to export your data as CSV?",
          () => {
            downloadGuestCSV();
          },
          null,
          "Export Complete Session"
        );
      }, 500);
    }
  }
  
  // Update guest called students display - TABLE FORMAT
  function updateGuestCalledDisplay() {
    const container = document.getElementById("guestCalledStudents");
    if (!container) return;
    
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    
    if (calledStudents.length === 0) {
      container.innerHTML = '<p style="color: #888; font-style: italic; margin: 0; text-align: center;">No students called yet</p>';
      return;
    }
    
    // Create table with requested order: name - score - time
    let tableHTML = `
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 12px; text-align: left; font-weight: bold; color: #495057;">Student Name</th>
            <th style="padding: 12px; text-align: center; font-weight: bold; color: #495057; width: 120px;">Score</th>
            <th style="padding: 12px; text-align: center; font-weight: bold; color: #495057; width: 100px;">Time</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    calledStudents.forEach((student, index) => {
      let scoreDisplay = student.score;
      let scoreBadgeStyle = "background: #e9ecef; color: #495057;";
      
      if (student.score === 'absent') {
        scoreBadgeStyle = "background: #f8d7da; color: #721c24;";
        scoreDisplay = "Absent";
      } else if (student.score === 'skip') {
        scoreBadgeStyle = "background: #fff3cd; color: #856404;";
        scoreDisplay = "Skip";
      } else if (student.score === 'custom') {
        scoreBadgeStyle = "background: #e2e3ff; color: #5a67d8;";
        scoreDisplay = student.customScore || "Custom";
      } else if (parseInt(student.score)) {
        scoreBadgeStyle = "background: #d1f2eb; color: #155724;";
        scoreDisplay = student.score + " pts";
      }
      
      const rowStyle = index % 2 === 0 ? "background: #ffffff;" : "background: #f8f9fa;";
      
      tableHTML += `
        <tr style="${rowStyle} border-bottom: 1px solid #dee2e6;">
          <td style="padding: 10px 12px; font-weight: 500; color: #212529;">${student.name}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; ${scoreBadgeStyle}">
              ${scoreDisplay}
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: center; font-size: 12px; color: #6c757d;">${student.timestamp}</td>
        </tr>
      `;
    });
    
    tableHTML += `
        </tbody>
      </table>
    `;
    
    container.innerHTML = tableHTML;
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
        showInfoModal("Failed to create class: " + err.message, "Error");
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
  // CLASS PAGE: ADD STUDENTS + LIST + RECITA HISTORY
  // -------------------
  const addStudentsBtn = document.getElementById("addStudentsBtn");
  const studentInput = document.getElementById("studentInput");
  const studentList = document.getElementById("studentList");
  const recitaHistoryContainer = document.getElementById("recitaHistory");

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
        showInfoModal("Failed to add students: " + err.message, "Error");
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

    // Load recita history for this class
    loadRecitaHistory(classId);
  }

  // Function to load recita history
  async function loadRecitaHistory(classId) {
    if (!recitaHistoryContainer) return;
    
    try {
      // This would need a new API endpoint - for now using mock data structure
      // You'll need to create /functions/recitas.js to handle this
      const recitas = await apiFetch(`/recitas?classId=${classId}`);
      
      if (recitas.length === 0) {
        recitaHistoryContainer.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #666;">
            <p>No recitation sessions yet.</p>
            <p style="font-size: 14px;">Create a new recitation to get started!</p>
          </div>
        `;
        return;
      }

      let historyHTML = '<div class="space-y-4">';
      
      recitas.forEach(recita => {
        const attendanceCount = recita.attendance ? recita.attendance.length : 0;
        const date = new Date(recita.created_at).toLocaleDateString();
        const time = new Date(recita.created_at).toLocaleTimeString();
        
        historyHTML += `
          <div class="bg-white p-4 rounded-lg shadow border">
            <div class="flex justify-between items-start mb-2">
              <div>
                <h4 class="font-semibold text-lg">${recita.topic}</h4>
                <p class="text-sm text-gray-600">${date} at ${time}</p>
                <p class="text-sm text-gray-500">${attendanceCount} students called</p>
              </div>
              <div class="flex flex-col gap-2">
                <button onclick="exportRecitaCSV(${recita.id}, '${recita.topic}')" 
                        class="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
                  Export CSV
                </button>
                <button onclick="viewRecitaDetails(${recita.id})" 
                        class="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600">
                  View Details
                </button>
              </div>
            </div>
          </div>
        `;
      });
      
      historyHTML += '</div>';
      recitaHistoryContainer.innerHTML = historyHTML;
      
    } catch (err) {
      console.error("Failed to load recita history", err);
      recitaHistoryContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          <p>Unable to load recitation history.</p>
        </div>
      `;
    }
  }

  // Global functions for recita history buttons
  window.exportRecitaCSV = async function(recitaId, topic) {
    try {
      window.location.href = `/export?recitaId=${recitaId}`;
    } catch (err) {
      showInfoModal("Failed to export recita: " + err.message, "Export Error");
    }
  };

  window.viewRecitaDetails = async function(recitaId) {
    try {
      const details = await apiFetch(`/recitas/${recitaId}/details`);
      
      let detailsHTML = `
        <h4 style="margin-bottom: 15px; font-size: 18px;">${details.topic}</h4>
        <p style="margin-bottom: 10px; color: #666;">
          ${new Date(details.created_at).toLocaleDateString()} at ${new Date(details.created_at).toLocaleTimeString()}
        </p>
      `;
      
      if (details.attendance && details.attendance.length > 0) {
        detailsHTML += `
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Student</th>
                <th style="padding: 8px; text-align: center; border-bottom: 1px solid #ddd;">Score</th>
              </tr>
            </thead>
            <tbody>
        `;
        
        details.attendance
          .sort((a, b) => a.student_name.localeCompare(b.student_name))
          .forEach((record, index) => {
            const rowStyle = index % 2 === 0 ? "background: #fff;" : "background: #f8f9fa;";
            let scoreDisplay = record.score || 'No score';
            let scoreStyle = 'color: #666;';
            
            if (record.score === 'absent') {
              scoreDisplay = 'Absent';
              scoreStyle = 'color: #dc3545; font-weight: bold;';
            } else if (record.score === 'skip') {
              scoreDisplay = 'Skip';
              scoreStyle = 'color: #ffc107; font-weight: bold;';
            } else if (parseInt(record.score)) {
              scoreDisplay = record.score + ' pts';
              scoreStyle = 'color: #28a745; font-weight: bold;';
            }
            
            detailsHTML += `
              <tr style="${rowStyle}">
                <td style="padding: 8px; border-bottom: 1px solid #eee;">${record.student_name}</td>
                <td style="padding: 8px; text-align: center; border-bottom: 1px solid #eee; ${scoreStyle}">
                  ${scoreDisplay}
                </td>
              </tr>
            `;
          });
        
        detailsHTML += `
            </tbody>
          </table>
        `;
      } else {
        detailsHTML += '<p style="color: #666; margin-top: 15px;">No students were called in this session.</p>';
      }
      
      detailsHTML += `
        <div style="margin-top: 20px; text-align: center;">
          <button onclick="this.closest('.modal').remove()" style="margin: 0;">Close</button>
        </div>
      `;
      
      showModal(detailsHTML, "Recitation Details");
      
    } catch (err) {
      showInfoModal("Failed to load recita details: " + err.message, "Error");
    }
  };

  // -------------------
  // RECITA PAGE - ENHANCED VERSION
  // -------------------
  const saveRecitaBtn = document.getElementById("saveRecitaBtn");
  const pickSection = document.getElementById("pickSection");

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
      displayRecitaStatus();
    }
    
    saveRecitaBtn.addEventListener("click", async () => {
      const topicInput = document.getElementById("topicInput");
      if (!topicInput) {
        showInfoModal("Topic input not found!", "Error");
        return;
      }
      
      const topic = topicInput.value.trim();
      console.log("Saving recita with topic:", topic, "and classId:", classId);
      
      if (!topic) {
        showInfoModal("Please enter a topic for the recita");
        return;
      }
      
      try {
        const numericClassId = parseInt(classId, 10);
        console.log("Sending to server:", { topic, classId: numericClassId });
        
        const response = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ 
            topic: topic,
            classId: numericClassId
          }),
        });
        
        console.log("Server response:", response);
        const recitaId = response.id;
        
        if (!recitaId) {
          console.error("No ID in server response:", response);
          showInfoModal("Recita saved but ID not found. Please refresh and try again.", "Error");
          return;
        }
        
        console.log("Got recita ID:", recitaId);
        
        localStorage.setItem("recitaId", recitaId.toString());
        localStorage.setItem("recitaTopic", topic);
        localStorage.setItem("recitaDate", new Date().toLocaleDateString());
        localStorage.setItem("recitaTime", new Date().toLocaleTimeString());
        
        localStorage.removeItem("calledStudents");
        
        const existingContainer = document.getElementById("calledStudentsContainer");
        if (existingContainer) {
          existingContainer.remove();
        }
        
        if (pickSection) {
          pickSection.classList.remove("hidden");
        }
        
        displayRecitaStatus();
        showInfoModal(`Recita "${topic}" saved successfully!`, "Success");
        
      } catch (err) {
        console.error("Save recita error:", err);
        showInfoModal("Failed to save recita: " + err.message, "Error");
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
      let statusElement = document.getElementById("recitaStatus");
      if (!statusElement) {
        statusElement = document.createElement("div");
        statusElement.id = "recitaStatus";
        statusElement.className = "bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4";
        
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
          <div class="flex gap-2">
            <button id="editRecitaBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm">
              Edit
            </button>
            <button id="exportCurrentRecitaBtn" class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm">
              Export CSV
            </button>
          </div>
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

      // Add export functionality for current recita
      const exportBtn = document.getElementById("exportCurrentRecitaBtn");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          window.location.href = `/export?recitaId=${recitaId}`;
        });
      }
    }
  }

  // Pick student event listener
  console.log("Setting up pick student event listener");
  
  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "pickStudentBtn") {
      e.preventDefault();
      console.log("Pick student button clicked!");
      
      const recitaId = localStorage.getItem("recitaId");
      console.log("Pick student clicked, recitaId from localStorage:", recitaId);
      
      if (!recitaId || recitaId === 'null' || recitaId === 'undefined') {
        console.error("No valid recita ID found");
        showInfoModal("No recita ID found. Please save a recita first.");
        return;
      }
      
      try {
        const requestUrl = `/attendance?action=pick&recitaId=${recitaId}`;
        console.log("Making request to:", requestUrl);
        const student = await apiFetch(requestUrl);
        console.log("Student picked:", student);
        
        if (!student) {
          // All students called - offer export
          showConfirmModal(
            "All students have been called! Would you like to export this recitation as CSV?",
            () => {
              window.location.href = `/export?recitaId=${recitaId}`;
            },
            null,
            "All Students Called"
          );
          return;
        }
        
        showStudentModal(student);
      } catch (err) {
        console.error("Pick student error:", err);
        showInfoModal("Failed to pick student: " + err.message, "Error");
      }
    }
  });

  // Show student modal with enhanced scoring options
  function showStudentModal(student) {
    const modal = showModal(`
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
        <p style="font-size: 24px; font-weight: bold; margin: 0; color: #2c3e50;">${student.name}</p>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <button class="scoreBtn" data-score="10" data-student-id="${student.id}" style="margin: 0; background: #10b981;">10 pts</button>
        <button class="scoreBtn" data-score="5" data-student-id="${student.id}" style="margin: 0; background: #10b981;">5 pts</button>
        <button class="scoreBtn" data-score="custom" data-student-id="${student.id}" style="margin: 0; background: #8b5cf6;">Custom</button>
        <button class="scoreBtn" data-score="skip" data-student-id="${student.id}" style="margin: 0; background: #f59e0b;">Skip</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button class="scoreBtn" data-score="absent" data-student-id="${student.id}" style="margin: 0; background: #ef4444;">Absent</button>
        <button id="cancelScoring" style="margin: 0; background: #6b7280;">Cancel</button>
      </div>
    `, "Selected Student");
    
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("scoreBtn")) {
        const score = e.target.dataset.score;
        const studentId = e.target.dataset.studentId;
        
        if (score === "custom") {
          showCustomScoreModal(student.name, (name, scoreType, customScore) => {
            recordScore(studentId, scoreType, student.name, customScore);
          });
          return;
        }
        
        recordScore(studentId, score, student.name);
        modal.remove();
      } else if (e.target.id === "cancelScoring" || e.target === modal) {
        modal.remove();
      }
    });
  }

  // Record score function
  async function recordScore(studentId, score, studentName, customScore = null) {
    const recitaId = localStorage.getItem("recitaId");
    
    if (!recitaId || !studentId) {
      showInfoModal("Missing recita or student ID", "Error");
      return;
    }
    
    try {
      await apiFetch("/attendance", {
        method: "POST",
        body: JSON.stringify({ recitaId, studentId, score }),
      });
      
      console.log("Score recorded successfully");
      addToCalledStudentsList(studentName, score, customScore);
      
    } catch (err) {
      console.error("Failed to record score", err);
      showInfoModal("Failed to record score: " + err.message, "Error");
    }
  }

  // Add student to called list - ENHANCED TABLE FORMAT
  function addToCalledStudentsList(studentName, score, customScore = null) {
    if (!studentName) return;
    
    let calledContainer = document.getElementById("calledStudentsContainer");
    if (!calledContainer) {
      calledContainer = document.createElement("div");
      calledContainer.id = "calledStudentsContainer";
      calledContainer.className = "mt-6";
      calledContainer.innerHTML = `
        <h3 class="text-lg font-semibold mb-3">Called Students</h3>
        <div id="calledStudentsList"></div>
      `;
      
      const pickSection = document.getElementById("pickSection");
      if (pickSection && pickSection.parentNode) {
        pickSection.parentNode.insertBefore(calledContainer, pickSection.nextSibling);
      } else {
        document.body.appendChild(calledContainer);
      }
    }
    
    const calledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
    
    const studentEntry = {
      name: studentName,
      score: score,
      timestamp: new Date().toLocaleTimeString()
    };
    
    if (customScore) {
      studentEntry.customScore = customScore;
    }
    
    calledStudents.push(studentEntry);
    
    // Sort alphabetically by last name
    calledStudents.sort((a, b) => {
      const lastNameA = a.name.split(' ').pop().toLowerCase();
      const lastNameB = b.name.split(' ').pop().toLowerCase();
      return lastNameA.localeCompare(lastNameB);
    });
    
    localStorage.setItem("calledStudents", JSON.stringify(calledStudents));
    updateCalledStudentsDisplay();
  }
  
  // Update called students display - TABLE FORMAT (name - score - time)
  function updateCalledStudentsDisplay() {
    const calledList = document.getElementById("calledStudentsList");
    if (!calledList) return;
    
    const calledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
    
    if (calledStudents.length === 0) {
      calledList.innerHTML = '<p style="color: #666; font-style: italic; text-align: center;">No students called yet</p>';
      return;
    }
    
    let tableHTML = `
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 12px; text-align: left; font-weight: bold; color: #495057;">Student Name</th>
            <th style="padding: 12px; text-align: center; font-weight: bold; color: #495057; width: 120px;">Score</th>
            <th style="padding: 12px; text-align: center; font-weight: bold; color: #495057; width: 100px;">Time</th>
          </tr>
        </thead>
        <tbody>
    `;
    
    calledStudents.forEach((student, index) => {
      let scoreDisplay = student.score;
      let scoreBadgeStyle = "background: #e9ecef; color: #495057;";
      
      if (student.score === 'absent') {
        scoreBadgeStyle = "background: #f8d7da; color: #721c24;";
        scoreDisplay = "Absent";
      } else if (student.score === 'skip') {
        scoreBadgeStyle = "background: #fff3cd; color: #856404;";
        scoreDisplay = "Skip";
      } else if (student.score === 'custom') {
        scoreBadgeStyle = "background: #e2e3ff; color: #5a67d8;";
        scoreDisplay = student.customScore || "Custom";
      } else if (parseInt(student.score)) {
        scoreBadgeStyle = "background: #d1f2eb; color: #155724;";
        scoreDisplay = student.score + " pts";
      }
      
      const rowStyle = index % 2 === 0 ? "background: #ffffff;" : "background: #f8f9fa;";
      
      tableHTML += `
        <tr style="${rowStyle} border-bottom: 1px solid #dee2e6;">
          <td style="padding: 10px 12px; font-weight: 500; color: #212529;">${student.name}</td>
          <td style="padding: 10px 12px; text-align: center;">
            <span style="padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; ${scoreBadgeStyle}">
              ${scoreDisplay}
            </span>
          </td>
          <td style="padding: 10px 12px; text-align: center; font-size: 12px; color: #6c757d;">${student.timestamp}</td>
        </tr>
      `;
    });
    
    tableHTML += `
        </tbody>
      </table>
    `;
    
    calledList.innerHTML = tableHTML;
  }
  
  // Initialize called students display on page load
  if (document.getElementById("pickSection")) {
    setTimeout(() => {
      const existingCalledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
      if (existingCalledStudents.length > 0) {
        addToCalledStudentsList("", "", ""); // Creates container
        updateCalledStudentsDisplay();
      }
    }, 500);
  }

  // -------------------
  // EXPORT CSV - ENHANCED
  // -------------------
  const exportBtn = document.getElementById("exportCsvBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const classId = localStorage.getItem("classId");
      if (!classId) {
        showInfoModal("No class selected");
        return;
      }
      // Export all recitas for this class
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
  if (document.body.dataset.recitaLogosProcessed === 'true') {
    return;
  }

  document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, div, a, button").forEach(el => {
    if (el.dataset.recitaProcessed === 'true' || el.querySelector('img[alt="Recita Logo"]')) {
      return;
    }

    if (el.textContent.includes("Recita") && el.children.length === 0) {
      const fontSize = window.getComputedStyle(el).fontSize;
      
      el.innerHTML = el.textContent.replace(
        /Recita/g,
        `<img src="/logo.png" alt="Recita Logo" style="height:${fontSize}; width:auto; vertical-align:middle; margin-right:0.3em; display:inline-block;"><span style="color:#fe731f; font-weight:bold;">Recita</span>`
      );
      
      el.dataset.recitaProcessed = 'true';
    }
  });

  document.body.dataset.recitaLogosProcessed = 'true';
}

document.addEventListener("DOMContentLoaded", () => {
  addRecitaLogos();
  setTimeout(addRecitaLogos, 100);
  setTimeout(addRecitaLogos, 500);
});
