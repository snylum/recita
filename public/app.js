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
      showInfoModal("Login failed: " + err.message);
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
      showInfoModal("Signup failed: " + err.message);
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
      showInfoModal("Logout failed: " + err.message);
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
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-content">
          <h3>Clear All Data</h3>
          <p>This will clear your topic, student list, and all called students.</p>
          <p>Are you sure you want to start over?</p>
          <div style="margin-top: 20px;">
            <button id="confirmClear" style="background: #ef4444; margin-bottom: 10px;">
              Yes, Clear Everything
            </button>
            <button id="cancelClear" style="background: #6b7280;">
              Cancel
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      document.getElementById("confirmClear").addEventListener("click", () => {
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
        modal.remove();
        
        showInfoModal("All data cleared! You can start a new recitation session.");
      });

      document.getElementById("cancelClear").addEventListener("click", () => {
        modal.remove();
      });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      });
    });
  }
  
  // Show export success modal after authentication
  function showExportSuccessModal() {
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Account Created Successfully!</h3>
        <p>You can now download your student data as a CSV file.</p>
        <div style="margin-top: 20px;">
          <button id="downloadCsvBtn" style="background: #22c55e; margin-bottom: 10px;">
            Download CSV & Go to Dashboard
          </button>
          <button id="continueToDashboard" style="background: #3b82f6; margin-bottom: 10px;">
            Continue to Dashboard
          </button>
        </div>
      `;

    document.body.appendChild(modal);

    // Download CSV functionality
    document.getElementById("downloadCsvBtn").addEventListener("click", () => {
      const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
      if (calledStudents.length === 0) {
        // No data, just go to dashboard
        window.location.href = "dashboard.html";
        return;
      }

      // Get topic information with fallbacks
      const topic = localStorage.getItem("guestTopic") || "Demo Session";
      const savedDate = localStorage.getItem("guestTopicDate");
      const savedTime = localStorage.getItem("guestTopicTime");
      
      // Use current date/time if no saved data (e.g., in incognito mode)
      const date = savedDate || new Date().toLocaleDateString();
      const time = savedTime || new Date().toLocaleTimeString();

      // Generate CSV content with topic header
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

      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTopic = topic.replace(/[^a-zA-Z0-9]/g, '-');
      a.download = `recita-${safeTopic}-${date.replace(/\//g, '-')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      // Go to dashboard after download
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1000);
    });

    document.getElementById("continueToDashboard").addEventListener("click", () => {
      window.location.href = "dashboard.html";
    });

    // Close modal when clicking outside
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
      
      const modal = document.createElement("div");
      modal.className = "modal";
      modal.innerHTML = `
        <div class="modal-content">
          <h3>Export Your Data</h3>
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
        </div>
      `;

      document.body.appendChild(modal);

      document.getElementById("authCreateAccount").addEventListener("click", () => {
        modal.remove();
        // Show signup modal
        const loginModal = document.getElementById('loginModal');
        const loginSection = document.getElementById('loginSection');
        const signupSection = document.getElementById('signupSection');
        
        if (loginModal && loginSection && signupSection) {
          loginModal.style.display = 'flex';
          loginSection.style.display = 'none';
          signupSection.style.display = 'block';
        }
      });

      document.getElementById("authLogin").addEventListener("click", () => {
        modal.remove();
        // Show login modal
        const loginModal = document.getElementById('loginModal');
        const loginSection = document.getElementById('loginSection');
        const signupSection = document.getElementById('signupSection');
        
        if (loginModal && loginSection && signupSection) {
          loginModal.style.display = 'flex';
          loginSection.style.display = 'block';
          signupSection.style.display = 'none';
        }
      });

      document.getElementById("cancelAuth").addEventListener("click", () => {
        localStorage.removeItem('pendingExport'); // Clean up pending export flag
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
  
  // Info modal for messages (replaces alerts)
  function showInfoModal(message) {
    const existingModal = document.getElementById("infoModal");
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement("div");
    modal.id = "infoModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h3 style="margin-top: 0; margin-bottom: 15px;">Information</h3>
        <p style="color: #666; margin-bottom: 20px; line-height: 1.4;">${message}</p>
        <button id="closeInfoModal" style="margin: 0;">OK</button>
      </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener("click", (e) => {
      if (e.target.id === "closeInfoModal" || e.target === modal) {
        modal.remove();
      }
    });
  }
  
  // Guest modal functionality
  function showGuestStudentModal(studentName) {
    // Remove any existing modal
    const existingModal = document.getElementById("guestStudentModal");
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement("div");
    modal.id = "guestStudentModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2 style="margin-top: 0; margin-bottom: 20px;">Selected Student</h2>
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
      </div>
    `;
    document.body.appendChild(modal);
    
    // Add event listeners
    modal.addEventListener("click", (e) => {
      if (e.target.classList.contains("guestScoreBtn")) {
        let score = e.target.dataset.score;
        
        if (score === "custom") {
          // Create custom score modal instead of prompt
          showCustomScoreModal(studentName);
          return;
        }
        
        addToGuestCalledList(studentName, score);
        modal.remove();
      } else if (e.target.id === "guestModalClose" || e.target === modal) {
        modal.remove();
      }
    });
  }
  
  // Custom score modal
  function showCustomScoreModal(studentName) {
    const existingModal = document.getElementById("guestStudentModal");
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement("div");
    modal.id = "customScoreModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h2 style="margin-top: 0; margin-bottom: 20px;">Custom Score</h2>
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
          <p style="font-size: 20px; font-weight: bold; margin: 0; color: #2c3e50;">${studentName}</p>
        </div>
        <input id="customScoreInput" type="text" placeholder="Enter score (e.g., 7, Good, Excellent)" style="margin-bottom: 15px;" autofocus>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button id="saveCustomScore" style="margin: 0; background: #8b5cf6;">Save Score</button>
          <button id="cancelCustomScore" style="margin: 0; background: #6b7280;">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    
    const input = document.getElementById("customScoreInput");
    input.focus();
    
    modal.addEventListener("click", (e) => {
      if (e.target.id === "saveCustomScore") {
        const customScore = input.value.trim();
        if (customScore) {
          addToGuestCalledList(studentName, 'custom', customScore);
          modal.remove();
        } else {
          // Show error without alert
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
        document.getElementById("saveCustomScore").click();
      }
    });
  }
  
  // Add student to guest called list
  function addToGuestCalledList(studentName, score, customScore = null) {
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    
    const studentEntry = {
      name: studentName,
      score: score,
      timestamp: new Date().toLocaleTimeString()
    };
    
    // Add custom score if provided
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
  }
  
  // Update guest called students display
  function updateGuestCalledDisplay() {
    const container = document.getElementById("guestCalledStudents");
    if (!container) return;
    
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    
    if (calledStudents.length === 0) {
      container.innerHTML = '<p style="color: #888; font-style: italic; margin: 0; text-align: center;">No students called yet</p>';
      return;
    }
    
    // Create table
    let tableHTML = `
      <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <thead>
          <tr style="background: #f8f9fa; border-bottom: 2px solid #dee2e6;">
            <th style="padding: 12px; text-align: left; font-weight: bold; color: #495057; width: 40px;">#</th>
            <th style="padding: 12px; text-align: left; font-weight: bold; color: #495057;">Student Name</th>
            <th style="padding: 12px; text-align: center; font-weight: bold; color: #495057; width: 100px;">Score</th>
            <th style="padding: 12px; text-align: center; font-weight: bold; color: #495057; width: 80px;">Time</th>
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
          <td style="padding: 10px 12px; color: #6c757d; font-weight: 500;">${index + 1}</td>
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
        showInfoModal("Failed to create class: " + err.message);
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
        showInfoModal("Failed to add students: " + err.message);
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
  // RECITA PAGE - FIXED VERSION
  // -------------------
  const saveRecitaBtn = document.getElementById("saveRecitaBtn");
  const pickSection = document.getElementById("pickSection");

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
        showInfoModal("Topic input not found!");
        return;
      }
      
      const topic = topicInput.value.trim();
      console.log("Saving recita with topic:", topic, "and classId:", classId);
      
      if (!topic) {
        showInfoModal("Please enter a topic for the recita");
        return;
      }
      
      try {
        // Convert classId to integer (your server expects this)
        const numericClassId = parseInt(classId, 10);
        
        console.log("Sending to server:", { topic, classId: numericClassId });
        
        // Send only the fields your server expects
        const response = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ 
            topic: topic,
            classId: numericClassId  // Only send what server expects
          }),
        });
        
        console.log("Server response:", response);
        console.log("Response keys:", Object.keys(response || {}));
        
        // Your server returns { id: lastRowId, topic: body.topic }
        const recitaId = response.id;
        
        if (!recitaId) {
          console.error("No ID in server response:", response);
          showInfoModal("Recita saved but ID not found. Please refresh and try again.");
          return;
        }
        
        console.log("Got recita ID:", recitaId);
        
        // Store recita info in localStorage
        localStorage.setItem("recitaId", recitaId.toString());
        localStorage.setItem("recitaTopic", topic);
        localStorage.setItem("recitaDate", new Date().toLocaleDateString());
        localStorage.setItem("recitaTime", new Date().toLocaleTimeString());
        
        console.log("Stored in localStorage - ID:", localStorage.getItem("recitaId"));
        
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
        
        showInfoModal(`Recita "${topic}" saved successfully!`);
        
      } catch (err) {
        console.error("Save recita error:", err);
        console.error("Error details:", err.message, err.stack);
        showInfoModal("Failed to save recita: " + err.message);
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
      console.log("Pick student clicked, recitaId from localStorage:", recitaId);
      console.log("All localStorage keys:", Object.keys(localStorage));
      console.log("localStorage recitaId type:", typeof recitaId);
      
      if (!recitaId || recitaId === 'null' || recitaId === 'undefined') {
        console.error("No valid recita ID found. localStorage contents:", {
          recitaId: localStorage.getItem("recitaId"),
          recitaTopic: localStorage.getItem("recitaTopic"),
          allKeys: Object.keys(localStorage)
        });
        showInfoModal("No recita ID found. Please save a recita first.");
        return;
      }
      
      try {
        const requestUrl = `/attendance/pick?recitaId=${recitaId}`;
        console.log("Making request to:", requestUrl);
        const student = await apiFetch(requestUrl);
        console.log("Student picked:", student);
        
        if (!student) {
          showInfoModal("All students already picked!");
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
          showInfoModal(`Selected student: ${student.name}`);
        }
      } catch (err) {
        console.error("Pick student error:", err);
        showInfoModal("Failed to pick student: " + err.message);
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
        showInfoModal("Missing recita or student ID");
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
        showInfoModal("Failed to record score: " + err.message);
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
        showInfoModal("No class selected");
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
