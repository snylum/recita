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
// GENERAL MODAL SYSTEM (for guest mode and general use)
// -------------------
function showModal(content, title = null) {
  const modal = document.createElement("div");
  modal.className = "modal general-modal";
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
  modal.classList.add("info-modal");
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  return modal;
}

function showConfirmModal(message, onConfirm, onCancel = null, title = "Confirm") {
  const modal = showModal(`
    <p style="color: #666; margin-bottom: 20px; line-height: 1.4;">${message}</p>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <button id="confirmBtn" style="margin: 0; background: #ef4444;">Yes</button>
      <button id="cancelBtn" style="margin: 0; background: #6b7280;">Cancel</button>
    </div>
  `, title);
  
  modal.classList.add("confirm-modal");
  
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
  
  return modal;
}

// -------------------
// AUTHENTICATED RECITA MODAL SYSTEM
// -------------------
function showRecitaInfoModal(message, title = "Information") {
  // Remove any existing recita modals
  const existingModals = document.querySelectorAll('.recita-modal');
  existingModals.forEach(modal => modal.remove());
  
  const modal = document.createElement("div");
  modal.className = "modal recita-modal info-modal";
  modal.style.zIndex = "10000";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content">
      ${title ? `<h3 style="margin-top: 0; margin-bottom: 15px;">${title}</h3>` : ''}
      <p style="color: #666; margin-bottom: 20px; line-height: 1.4;">${message}</p>
      <button class="recita-modal-close" style="margin: 0;">OK</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelector('.recita-modal-close').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    modal.remove();
  });
  
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  return modal;
}

function showAuthenticatedStudentModal(student) {
  // Remove any existing authenticated student modal
  const existingModals = document.querySelectorAll('.recita-modal');
  existingModals.forEach(modal => modal.remove());

  // Create modal using recita modal system
  const modal = document.createElement("div");
  modal.className = "modal recita-modal authenticated-student-modal";
  modal.id = "authenticatedStudentModal";
  modal.style.zIndex = "10000";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content">
      <h3 style="margin-top: 0; margin-bottom: 15px;">Selected Student</h3>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
        <p style="font-size: 24px; font-weight: bold; margin: 0; color: #2c3e50;">${student.name}</p>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
        <button class="score-btn" data-score="10" data-student-id="${student.id}" style="margin: 0; background: #10b981;">10 pts</button>
        <button class="score-btn" data-score="5" data-student-id="${student.id}" style="margin: 0; background: #10b981;">5 pts</button>
        <button class="score-btn" data-score="custom" data-student-id="${student.id}" style="margin: 0; background: #8b5cf6;">Custom</button>
        <button class="score-btn" data-score="skip" data-student-id="${student.id}" style="margin: 0; background: #f59e0b;">Skip</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button class="score-btn" data-score="absent" data-student-id="${student.id}" style="margin: 0; background: #ef4444;">Absent</button>
        <button id="cancelAuthScoring" style="margin: 0; background: #6b7280;">Cancel</button>
      </div>
    </div>
  `;
  
  // Append to body
  document.body.appendChild(modal);
  
  // Add click handlers to each score button
  const scoreButtons = modal.querySelectorAll('.score-btn');
  scoreButtons.forEach(button => {
    button.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      const score = this.getAttribute('data-score');
      const studentId = this.getAttribute('data-student-id');
      
      console.log('Score button clicked:', score, 'for student:', studentId);
      
      if (score === "custom") {
        modal.remove();
        showRecitaCustomScoreModal(student.name, (name, scoreType, customScore) => {
          recordScore(studentId, scoreType, student.name, customScore);
        });
        return;
      }
      
      recordScore(studentId, score, student.name);
      modal.remove();
    });
  });
  
  // Cancel button
  const cancelBtn = modal.querySelector('#cancelAuthScoring');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      modal.remove();
    });
  }
  
  // Click backdrop to close
  modal.addEventListener('click', function(e) {
    if (e.target === modal) {
      modal.remove();
    }
  });

  return modal;
}

// Custom score modal for recita system
function showRecitaCustomScoreModal(studentName, callback) {
  const existingModals = document.querySelectorAll('.recita-modal');
  existingModals.forEach(modal => modal.remove());
  
  const modal = document.createElement("div");
  modal.className = "modal recita-modal custom-score-modal";
  modal.style.zIndex = "10000";
  modal.style.display = "flex";
  modal.innerHTML = `
    <div class="modal-content">
      <h3 style="margin-top: 0; margin-bottom: 15px;">Custom Score</h3>
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
        <p style="font-size: 20px; font-weight: bold; margin: 0; color: #2c3e50;">${studentName}</p>
      </div>
      <input id="recitaCustomScoreInput" type="text" placeholder="Enter score (e.g., 7, Good, Excellent)" style="margin-bottom: 15px;" autofocus>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        <button id="saveRecitaCustomScore" style="margin: 0; background: #8b5cf6;">Save Score</button>
        <button id="cancelRecitaCustomScore" style="margin: 0; background: #6b7280;">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  const input = modal.querySelector("#recitaCustomScoreInput");
  input.focus();
  
  modal.addEventListener("click", (e) => {
    if (e.target.id === "saveRecitaCustomScore") {
      const customScore = input.value.trim();
      if (customScore) {
        callback(studentName, 'custom', customScore);
        modal.remove();
      } else {
        input.style.borderColor = "#ef4444";
        input.placeholder = "Please enter a score";
      }
    } else if (e.target.id === "cancelRecitaCustomScore" || e.target === modal) {
      modal.remove();
    }
  });
  
  // Handle Enter key
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      modal.querySelector("#saveRecitaCustomScore").click();
    }
  });
  
  return modal;
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
// GUEST MODE FUNCTIONALITY (Complete Implementation)
// -------------------

// Initialize guest mode on page load
function initGuestMode() {
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
  
  updateGuestCalledDisplay();
}

// Save topic functionality
function setupGuestTopicSaving() {
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
}

// Guest pick button functionality
function setupGuestPickButton() {
  const guestPickBtn = document.getElementById("guestPickBtn");
  const studentListTextarea = document.getElementById("guestStudentList");
  
  if (guestPickBtn && studentListTextarea) {
    guestPickBtn.addEventListener("click", () => {
      const studentText = studentListTextarea.value.trim();
      if (!studentText) {
        showInfoModal("Please paste student names first!");
        return;
      }

      const allStudents = studentText.split('\n').map(name => name.trim()).filter(name => name.length > 0);

      if (allStudents.length === 0) {
        showInfoModal("No valid student names found. Please check your list!");
        return;
      }

      const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
      const finalAnsweredStudents = calledStudents.filter(s => s.score !== 'skip').map(s => s.name);
      const availableStudents = allStudents.filter(name => !finalAnsweredStudents.includes(name));

      if (availableStudents.length === 0) {
        showInfoModal("All students have been called and answered! Clear the list to start over.");
        return;
      }

      const lastCalled = calledStudents[calledStudents.length - 1];
      let eligibleStudents = availableStudents;
      
      if (lastCalled && lastCalled.score === 'skip' && availableStudents.length > 1) {
        eligibleStudents = availableStudents.filter(name => name !== lastCalled.name);
        if (eligibleStudents.length === 0) {
          eligibleStudents = availableStudents;
        }
      }

      const randomIndex = Math.floor(Math.random() * eligibleStudents.length);
      const pickedStudent = eligibleStudents[randomIndex];

      showGuestStudentModal(pickedStudent);
    });
  }
}

// Guest clear button functionality
function setupGuestClearButton() {
  const guestClearBtn = document.getElementById("guestClearBtn");
  
  if (guestClearBtn) {
    guestClearBtn.addEventListener("click", () => {
      showConfirmModal(
        "This will clear your topic, student list, and all called students. Are you sure you want to start over?",
        () => {
          localStorage.removeItem("guestTopic");
          localStorage.removeItem("guestTopicDate");
          localStorage.removeItem("guestTopicTime");
          localStorage.removeItem("guestCalledStudents");
          
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
}

// Export success modal for guest to authenticated transition
function showExportSuccessModal() {
  const modal = showModal(`
    <p>You can now download your student data as a CSV file.</p>
    <div style="margin-top: 20px;">
      <button id="downloadCsvBtn" style="background: #22c55e; margin-bottom: 10px;">Download CSV & Go to Dashboard</button>
      <button id="continueToDashboard" style="background: #3b82f6; margin-bottom: 10px;">Continue to Dashboard</button>
    </div>
  `, "Account Created Successfully!");

  modal.querySelector("#downloadCsvBtn").addEventListener("click", () => {
    const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
    if (calledStudents.length === 0) {
      window.location.href = "dashboard.html";
      return;
    }
    downloadGuestCSV();
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1000);
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

// Guest export/save buttons handler
function setupGuestExportButtons() {
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("guestSaveBtn")) {
      const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
      
      if (calledStudents.length === 0) {
        showInfoModal("No student data to export. Pick some students first!");
        return;
      }

      localStorage.setItem('pendingExport', 'true');
      
      const modal = showModal(`
        <p>You have <strong>${calledStudents.length} students</strong> in your list.</p>
        <p>Create an account to download your data as a CSV file and save your progress.</p>
        <div style="margin-top: 20px;">
          <button id="authCreateAccount" style="background: #22c55e; margin-bottom: 10px;">Create Account & Export</button>
          <button id="authLogin" style="background: #3b82f6; margin-bottom: 10px;">Log In & Export</button>
          <button id="cancelAuth" style="background: #6b7280;">Cancel</button>
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
}

// Guest student modal
function showGuestStudentModal(studentName) {
  const existingModal = document.getElementById("guestStudentModal");
  if (existingModal) existingModal.remove();

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
  modal.classList.add("guest-modal");
  
  modal.addEventListener("click", (e) => {
    if (e.target.classList.contains("guestScoreBtn")) {
      let score = e.target.dataset.score;
      if (score === "custom") {
        showGuestCustomScoreModal(studentName, addToGuestCalledList);
        return;
      }
      addToGuestCalledList(studentName, score);
      modal.remove();
    } else if (e.target.id === "guestModalClose" || e.target === modal) {
      modal.remove();
    }
  });
}

// Guest custom score modal
function showGuestCustomScoreModal(studentName, callback) {
  const existingModal = document.querySelector("#guestStudentModal, #customScoreModal");
  if (existingModal) existingModal.remove();
  
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
  modal.classList.add("guest-modal");
  
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
  
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      modal.querySelector("#saveCustomScore").click();
    }
  });
}

// CSV download function for guest mode
function downloadGuestCSV() {
  const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
  if (calledStudents.length === 0) return;

  const topic = localStorage.getItem("guestTopic") || "Demo Session";
  const savedDate = localStorage.getItem("guestTopicDate");
  const savedTime = localStorage.getItem("guestTopicTime");
  
  const date = savedDate || new Date().toLocaleDateString();
  const time = savedTime || new Date().toLocaleTimeString();

  let csvContent = `Recitation Topic: "${topic}"\nDate: ${date}\nTime: ${time}\n\nStudent Name,Score,Time Called\n`;
  
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
  
  if (customScore) studentEntry.customScore = customScore;
  
  calledStudents.push(studentEntry);
  
  calledStudents.sort((a, b) => {
    const lastNameA = a.name.split(' ').pop().toLowerCase();
    const lastNameB = b.name.split(' ').pop().toLowerCase();
    return lastNameA.localeCompare(lastNameB);
  });
  
  localStorage.setItem("guestCalledStudents", JSON.stringify(calledStudents));
  updateGuestCalledDisplay();
  checkIfAllStudentsCalled();
}

// Check if all students have been called (for export option)
function checkIfAllStudentsCalled() {
  const studentListTextarea = document.getElementById("guestStudentList");
  if (!studentListTextarea) return;
  
  const allStudents = studentListTextarea.value.trim().split('\n')
    .map(name => name.trim()).filter(name => name.length > 0);
  
  const calledStudents = JSON.parse(localStorage.getItem("guestCalledStudents") || "[]");
  const finalAnsweredStudents = calledStudents.filter(s => s.score !== 'skip');
  
  if (allStudents.length > 0 && finalAnsweredStudents.length >= allStudents.length) {
    setTimeout(() => {
      showConfirmModal(
        "All students have been called! Would you like to export your data as CSV?",
        () => { downloadGuestCSV(); },
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
  
  tableHTML += `</tbody></table>`;
  container.innerHTML = tableHTML;
}


// -------------------
// DASHBOARD: CREATE + LIST CLASSES
// -------------------
function setupDashboard() {
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

    // Load existing classes
    (async () => {
      try {
        const classes = await apiFetch("/classes");
        classes.forEach((c) => {
          const div = document.createElement("div");
          div.className = "bg-white p-4 rounded-lg shadow hover:bg-gray-50 cursor-pointer";
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
}

// -------------------
// CLASS PAGE: ADD STUDENTS + LIST + RECITA HISTORY
// -------------------
// REPLACE the entire setupClassPage function with this:
function setupClassPage() {
  const addStudentsBtn = document.getElementById("addStudentsBtn");
  const studentInput = document.getElementById("studentInput");
  const studentList = document.getElementById("studentList");
  const recitaHistoryContainer = document.getElementById("recitaHistory");

  if (addStudentsBtn) {
    const classId = localStorage.getItem("classId");

    // Add students functionality
    addStudentsBtn.addEventListener("click", async () => {
      const names = studentInput.value.split("\n").map((n) => n.trim()).filter(Boolean);

      if (!names.length) return;

      try {
        await apiFetch("/students", {
          method: "POST",
          body: JSON.stringify({ classId: parseInt(classId), students: names }),
        });
        location.reload();
      } catch (err) {
        showInfoModal("Failed to add students: " + err.message, "Error");
      }
    });

    // Load existing students
    (async () => {
      try {
        const students = await apiFetch(`/students?classId=${classId}`);
        students.forEach((s) => {
          const li = document.createElement("li");
          li.textContent = s.name;
          li.style.cssText = "padding: 8px; border: 1px solid #d1d5db; border-radius: 4px; margin-bottom: 8px; background: #f9fafb;";
          studentList.appendChild(li);
        });
      } catch (err) {
        console.error("Failed to load students", err);
      }
    })();

    // Load recita history
    loadRecitaHistory(classId);
  }
}

// Load and display recita history
async function loadRecitaHistory(classId) {
  const recitaHistoryContainer = document.getElementById("recitaHistory");
  if (!recitaHistoryContainer) return;
  
  try {
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

    let historyHTML = '<div style="display: flex; flex-direction: column; gap: 16px;">';
    
    recitas.forEach(recita => {
      const attendanceCount = recita.attendance ? recita.attendance.length : 0;
      const date = new Date(recita.created_at).toLocaleDateString();
      const time = new Date(recita.created_at).toLocaleTimeString();
      
      historyHTML += `
        <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #e5e7eb;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <h4 style="font-weight: 600; font-size: 18px; margin: 0 0 8px 0; color: #1f2937;">${recita.topic}</h4>
              <p style="font-size: 14px; color: #6b7280; margin: 0 0 4px 0;">${date} at ${time}</p>
              <p style="font-size: 14px; color: #9ca3af; margin: 0;">${attendanceCount} students called</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <button onclick="exportRecitaCSV(${recita.id}, '${recita.topic.replace(/'/g, "\\'")}')" 
                      style="background: #10b981; color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer;">
                Export CSV
              </button>
              <button onclick="viewRecitaDetails(${recita.id})" 
                      style="background: #3b82f6; color: white; padding: 6px 12px; border-radius: 4px; font-size: 12px; border: none; cursor: pointer;">
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

// Export recita CSV function
window.exportRecitaCSV = async function(recitaId, topic) {
  try {
    window.location.href = `/export?recitaId=${recitaId}`;
  } catch (err) {
    showInfoModal("Failed to export recita: " + err.message, "Export Error");
  }
};

// View recita details function
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
      
      details.attendance.sort((a, b) => a.student_name.localeCompare(b.student_name))
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
      
      detailsHTML += `</tbody></table>`;
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







// Add this helper function to get URL parameters
function getUrlParameter(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}




// -------------------
// GENERAL EXPORT CSV FUNCTIONALITY
// -------------------
function setupGeneralExport() {
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
}

// -------------------
// RECITA PAGE FUNCTIONALITY (Complete Implementation)
// -------------------

// Record score function for authenticated mode
// Record score function for authenticated mode
async function recordScore(studentId, score, studentName, customScore = null) {
  const recitaId = localStorage.getItem("recitaId");
  
  if (!recitaId || !studentId) {
    showRecitaInfoModal("Missing recita or student ID", "Error");
    return;
  }
  
  try {
    // Only record to database if it's not a skip
    if (score !== 'skip') {
      await apiFetch("/attendance", {
        method: "POST", 
        body: JSON.stringify({ 
          recitaId: parseInt(recitaId), 
          studentId: parseInt(studentId), 
          score: score 
        }),
      });
    }
    
    // Only add to called students list if it's not a skip
    // Skipped students should remain available for future picks
    if (score !== 'skip') {
      addToCalledStudentsList(studentName, score, customScore);
    } else {
      // For skipped students, just show a message but don't record anything
      showRecitaInfoModal(`${studentName} was skipped and remains available for selection.`, "Student Skipped");
    }
    
  } catch (err) {
    showRecitaInfoModal("Failed to record score: " + err.message, "Error");
  }
}

// Add to called students list for authenticated mode
function addToCalledStudentsList(studentName, score, customScore = null) {
  if (!studentName) return;
  
  const calledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
  
  const studentEntry = {
    name: studentName,
    score: score,
    timestamp: new Date().toLocaleTimeString()
  };
  
  if (customScore) studentEntry.customScore = customScore;
  
  calledStudents.push(studentEntry);
  
  calledStudents.sort((a, b) => {
    const lastNameA = a.name.split(' ').pop().toLowerCase();
    const lastNameB = b.name.split(' ').pop().toLowerCase();
    return lastNameA.localeCompare(lastNameB);
  });
  
  localStorage.setItem("calledStudents", JSON.stringify(calledStudents));
  updateCalledStudentsDisplay();
}

// Update called students display for authenticated mode
function updateCalledStudentsDisplay() {
  const calledContainer = document.getElementById("calledStudentsTableContainer");
  if (!calledContainer) return;
  
  const calledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
  
  if (calledStudents.length === 0) {
    calledContainer.innerHTML = '<p style="color: #888; font-style: italic; text-align: center; margin: 20px 0;">No students called yet</p>';
    return;
  }
  
  let tableHTML = `
    <div style="margin-bottom: 15px;">
      <h3 style="color: #2c3e50; margin: 0; font-size: 16px;">Called Students (${calledStudents.length})</h3>
    </div>
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
  
  tableHTML += '</tbody></table>';
  calledContainer.innerHTML = tableHTML;
}

// Setup recita page functionality
// Update the setupRecitaPage function
function setupRecitaPage() {
  const saveRecitaBtn = document.getElementById("saveRecitaBtn");
  const editRecitaBtn = document.getElementById("editRecitaBtn");  
  const exportRecitaBtn = document.getElementById("exportRecitaBtn");

  if (saveRecitaBtn) {
    const classId = getUrlParameter('classId') || localStorage.getItem("classId");
    
    saveRecitaBtn.addEventListener("click", async () => {
      const topicInput = document.getElementById("topicInput");
      if (!topicInput || !topicInput.value.trim()) {
        showRecitaInfoModal("Please enter a topic for the recita");
        return;
      }
      
      const topic = topicInput.value.trim();
      
      try {
        const response = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify({ topic, classId: parseInt(classId) }),
        });
        
        localStorage.setItem("recitaId", response.id.toString());
        localStorage.setItem("recitaTopic", topic);
        localStorage.setItem("classId", classId);
        localStorage.removeItem("calledStudents");
        
        // Update UI state
        topicInput.disabled = true;
        topicInput.style.backgroundColor = "#f3f4f6";
        topicInput.style.color = "#6b7280";
        
        const editBtn = document.getElementById("editRecitaBtn");
        const exportBtn = document.getElementById("exportRecitaBtn");
        const pickSection = document.getElementById("pickSection");
        const saveBtn = document.getElementById("saveRecitaBtn");
        
        if (saveBtn) saveBtn.style.display = "none";
        if (editBtn) editBtn.style.display = "block";
        if (exportBtn) exportBtn.style.display = "block";
        if (pickSection) pickSection.style.display = "block";
        
        // Clear any existing called students display
        updateCalledStudentsDisplay();
        
        showRecitaInfoModal(`Recita "${topic}" saved successfully!`, "Success");
        
      } catch (err) {
        showRecitaInfoModal("Failed to save recita: " + err.message, "Error");
      }
    });
  }

  // Edit Button Handler - Updated to allow editing existing recita topic
  if (editRecitaBtn) {
    editRecitaBtn.addEventListener("click", async () => {
      const topicInput = document.getElementById("topicInput");
      if (topicInput) {
        const originalTopic = topicInput.value;
        
        topicInput.disabled = false;
        topicInput.style.backgroundColor = "white";
        topicInput.style.color = "#333";
        topicInput.focus();
        
        // Change edit button to save button temporarily
        editRecitaBtn.textContent = "Save Changes";
        editRecitaBtn.style.background = "#4f46e5";
        
        // Create a one-time event handler for saving changes
        const saveChanges = async () => {
          const newTopic = topicInput.value.trim();
          if (!newTopic) {
            topicInput.value = originalTopic;
            showRecitaInfoModal("Topic cannot be empty");
            return;
          }
          
          const recitaId = localStorage.getItem("recitaId") || getUrlParameter('id');
          
          try {
            // Update the recita topic via API
            await apiFetch("/attendance", {
              method: "PUT",
              body: JSON.stringify({ 
                recitaId: parseInt(recitaId), 
                topic: newTopic 
              }),
            });
            
            // Update local storage
            localStorage.setItem("recitaTopic", newTopic);
            
            // Reset UI
            topicInput.disabled = true;
            topicInput.style.backgroundColor = "#f3f4f6";
            topicInput.style.color = "#6b7280";
            
            editRecitaBtn.textContent = "Edit Recita";
            editRecitaBtn.style.background = "#f59e0b";
            editRecitaBtn.removeEventListener("click", saveChanges);
            
            showRecitaInfoModal(`Recita topic updated to "${newTopic}"!`, "Success");
            
          } catch (err) {
            topicInput.value = originalTopic;
            showRecitaInfoModal("Failed to update recita: " + err.message, "Error");
          }
        };
        
        editRecitaBtn.removeEventListener("click", saveChanges);
        editRecitaBtn.addEventListener("click", saveChanges, { once: true });
      }
    });
  }

  // Export Button Handler with validation
  if (exportRecitaBtn) {
    exportRecitaBtn.addEventListener("click", () => {
      const recitaId = localStorage.getItem("recitaId") || getUrlParameter('id');
      const calledStudents = JSON.parse(localStorage.getItem("calledStudents") || "[]");
      
      if (!recitaId) {
        showRecitaInfoModal("No recita to export. Please save a recita first.", "Export Error");
        return;
      }
      
      if (calledStudents.length === 0) {
        showRecitaInfoModal("No students have been picked yet. Pick some students first before exporting.", "Nothing to Export");
        return;
      }
      
      window.location.href = `/export?recitaId=${recitaId}`;
    });
  }

  // Pick student event listener
  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "pickStudentBtn") {
      e.preventDefault();
      
      const recitaId = localStorage.getItem("recitaId") || getUrlParameter('id');
      
      if (!recitaId || recitaId === 'null' || recitaId === 'undefined') {
        showRecitaInfoModal("No recita ID found. Please save a recita first.");
        return;
      }
      
      try {
        const student = await apiFetch(`/attendance?action=pick&recitaId=${recitaId}`);
        
        if (!student) {
          const modal = document.createElement("div");
          modal.className = "modal recita-modal confirm-export-modal";
          modal.style.zIndex = "10000";
          modal.style.display = "flex";
          modal.innerHTML = `
            <div class="modal-content">
              <h3 style="margin-top: 0; margin-bottom: 15px;">All Students Called</h3>
              <p style="color: #666; margin-bottom: 20px; line-height: 1.4;">
                All students have been called! Would you like to export this recitation as CSV?
              </p>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <button id="exportYesBtn" style="margin: 0; background: #22c55e;">Export CSV</button>
                <button id="exportNoBtn" style="margin: 0; background: #6b7280;">Cancel</button>
              </div>
            </div>
          `;
          
          document.body.appendChild(modal);
          
          modal.querySelector('#exportYesBtn').addEventListener('click', () => {
            modal.remove();
            window.location.href = `/export?recitaId=${recitaId}`;
          });
          
          modal.querySelector('#exportNoBtn').addEventListener('click', () => {
            modal.remove();
          });
          
          modal.addEventListener("click", (e) => {
            if (e.target === modal) {
              modal.remove();
            }
          });
          
          return;
        }
        
        showAuthenticatedStudentModal(student);
      } catch (err) {
        showRecitaInfoModal("Failed to pick student: " + err.message, "Error");
      }
    }
  });

  // Initialize existing recita from URL parameter
  const urlRecitaId = getUrlParameter('id');
  const urlClassId = getUrlParameter('classId');
  
  if (urlRecitaId) {
    localStorage.setItem("recitaId", urlRecitaId);
    if (urlClassId) {
      localStorage.setItem("classId", urlClassId);
    }
    loadExistingRecita(urlRecitaId);
  }
}

// Add this new function to load existing attendance records
async function loadExistingAttendanceRecords(recitaId) {
  try {
    const response = await apiFetch(`/attendance?action=getDetails&recitaId=${recitaId}`);
    
    if (response && response.attendance) {
      const calledStudents = response.attendance.map(record => ({
        name: record.student_name,
        score: record.score || 'no-score',
        customScore: record.score && !['10', '5', 'skip', 'absent'].includes(record.score) ? record.score : null,
        timestamp: new Date(record.created_at).toLocaleTimeString()
      }));
      
      // Sort by last name
      calledStudents.sort((a, b) => {
        const lastNameA = a.name.split(' ').pop().toLowerCase();
        const lastNameB = b.name.split(' ').pop().toLowerCase();
        return lastNameA.localeCompare(lastNameB);
      });
      
      localStorage.setItem("calledStudents", JSON.stringify(calledStudents));
      updateCalledStudentsDisplay();
    }
  } catch (err) {
    console.error("Failed to load existing attendance records:", err);
  }
}

const classId = getUrlParameter('classId') || localStorage.getItem("classId");
// **NEW: Add this function to load existing recita data**
// Add this updated loadExistingRecita function to your app.js
async function loadExistingRecita(recitaId) {
  try {
    const classId = getUrlParameter('classId') || localStorage.getItem("classId");
    
    if (!classId) {
      console.error('No classId found for loading recita');
      return;
    }
    
    const response = await apiFetch(`/attendance?action=getRecitas&classId=${classId}`);
    
    if (response && Array.isArray(response)) {
      const currentRecita = response.find(r => r.id == recitaId);
      
      if (currentRecita) {
        const pickSection = document.getElementById("pickSection");
        const topicInput = document.getElementById("topicInput");
        const editBtn = document.getElementById("editRecitaBtn");
        const exportBtn = document.getElementById("exportRecitaBtn");
        const saveBtn = document.getElementById("saveRecitaBtn");
        
        // Update UI to show this is an existing recita
        if (topicInput) {
          topicInput.value = currentRecita.topic;
          topicInput.disabled = true;
          topicInput.style.backgroundColor = "#f3f4f6";
          topicInput.style.color = "#6b7280";
        }
        
        // Hide save button, show edit and export
        if (saveBtn) saveBtn.style.display = "none";
        if (editBtn) editBtn.style.display = "block";
        if (exportBtn) exportBtn.style.display = "block";
        if (pickSection) pickSection.style.display = "block";
        
        // Store topic and classId for future use
        localStorage.setItem("recitaTopic", currentRecita.topic);
        localStorage.setItem("classId", classId);
        
        // Load existing attendance records for this recita
        await loadExistingAttendanceRecords(recitaId);
        
        console.log("Loaded existing recita:", currentRecita.topic);
      }
    }
  } catch (err) {
    console.error("Failed to load existing recita:", err);
    // If we can't load the recita details, still show the interface
    const pickSection = document.getElementById("pickSection");
    const editBtn = document.getElementById("editRecitaBtn");
    const exportBtn = document.getElementById("exportRecitaBtn");
    
    if (pickSection) pickSection.style.display = "block";
    if (editBtn) editBtn.style.display = "block";
    if (exportBtn) exportBtn.style.display = "block";
  }
}

// -------------------
// SIMPLE LOGO SYSTEM (No Observer - No Duplicates)  
// -------------------
(function() {
  // Generate cache-busting parameter once
  const cacheBuster = "v=" + Date.now();
  const logoUrl = "/favicon.png?" + cacheBuster;
  
  // Insert favicon dynamically with cache busting
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = logoUrl;
  document.head.appendChild(link);
  
  // Store the cache-busted URL globally for use in other functions
  window.RECITA_LOGO_URL = logoUrl;
})();

// Simple addRecitaLogos function that prevents duplicates
function addRecitaLogos() {
  // Use the cache-busted logo URL
  const logoUrl = window.RECITA_LOGO_URL || "/favicon.png?" + Date.now();

  document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, div, a, button, label, .nav-item").forEach(el => {
    // Skip if already processed or contains an existing logo
    if (el.dataset.recitaProcessed === 'true' || 
        el.querySelector('img[alt="Recita Logo"]') || 
        el.innerHTML.includes('alt="Recita Logo"') || 
        el.innerHTML.includes('#f43773')) {
      return;
    }

    // Only process elements that contain "Recita" text and don't have complex children
    const textContent = el.textContent || '';
    
    if (textContent.includes("Recita") && 
        !el.querySelector('input, select, textarea, img') &&
        el.children.length <= 1) {
      
      const computedStyle = window.getComputedStyle(el);
      const fontSize = computedStyle.fontSize;
      
      // Calculate logo size based on the cap height
      const fontSizeNum = parseFloat(fontSize);
      const logoHeight = fontSizeNum * 0.75;
      
      // Replace only the first occurrence of "Recita" to prevent duplicates
      el.innerHTML = el.innerHTML.replace(
        /Recita/,
        `<img src="${logoUrl}" alt="Recita Logo" style="` +
        `height: ${logoHeight}px; ` +
        `width: auto; ` +
        `vertical-align: baseline; ` +
        `margin-right: 0.2em; ` +
        `display: inline;">` +
        `<span style="color: #f43773; font-weight: bold;">Recita</span>`
      );
      
      // Mark as processed to prevent future processing
      el.dataset.recitaProcessed = 'true';
    }
  });
}

// Function to update all existing logo images with cache-busted version
function updateAllLogoImages() {
  const cacheBuster = "v=" + Date.now();
  const newLogoUrl = "/favicon.png?" + cacheBuster;
  
  // Update favicon
  const favicon = document.querySelector('link[rel="icon"]');
  if (favicon) {
    favicon.href = newLogoUrl;
  }
  
  // Update all Recita logo images
  const logoImages = document.querySelectorAll('img[alt="Recita Logo"]');
  logoImages.forEach(img => {
    img.src = newLogoUrl;
  });
  
  // Update global reference
  window.RECITA_LOGO_URL = newLogoUrl;
}

// SIMPLE initialization - no observer
function initializeRecitaLogos() {
  // Run initial logo setup
  addRecitaLogos();
  
  // Run a few more times to catch any dynamically loaded content
  setTimeout(addRecitaLogos, 200);
  setTimeout(addRecitaLogos, 800);
  setTimeout(addRecitaLogos, 2000);
}

// Manual trigger function for specific cases
window.processRecitaLogos = function() {
  addRecitaLogos();
};

// Global refresh function
window.refreshAllLogos = updateAllLogoImages;

// -------------------
// MAIN INITIALIZATION
// -------------------
document.addEventListener("DOMContentLoaded", () => {
  console.log('DOM loaded, initializing app...');
  
// Initialize enhanced logo system that works on all pages
initializeRecitaLogos();
  
  // Initialize guest mode
const guestRecitaContainer = document.getElementById("guestRecita");
if (guestRecitaContainer) {
  console.log("Guest mode detected - initializing guest functionality");
  initGuestMode();
  setupGuestTopicSaving();
  setupGuestPickButton();
  setupGuestClearButton();
  setupGuestExportButtons();
  // Ensure logos are processed for guest mode content
  setTimeout(addRecitaLogos, 200);
}
  
  // Setup authentication with post-auth callback
  setupLogin(apiFetch, (url) => {
    const fromExport = localStorage.getItem('pendingExport');
    if (fromExport === 'true') {
      localStorage.removeItem('pendingExport');
      showExportSuccessModal();
    } else {
      window.location.href = url;
    }
  });
  
  setupSignup(apiFetch, (url) => {
    const fromExport = localStorage.getItem('pendingExport');
    if (fromExport === 'true') {
      localStorage.removeItem('pendingExport');
      showExportSuccessModal();
    } else {
      window.location.href = url;
    }
  });
  
  setupLogout(apiFetch, go);
  
  // Setup dashboard functionality
  setupDashboard();
  
  // Setup class page functionality
  setupClassPage();
  
  // Setup recita page functionality
  setupRecitaPage();
  
  // Setup general export functionality
  setupGeneralExport();
  
  // Set current date on recita page
  const dateSpan = document.getElementById('recitaDate');
  if (dateSpan) {
    dateSpan.textContent = new Date().toLocaleDateString();
  }
  
  console.log('App initialization complete');
});

