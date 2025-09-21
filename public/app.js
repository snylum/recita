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

  if (!res.ok) {
    const errorText = await res.text();
    console.error('API Error:', errorText);
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }

  // Check if response is JSON
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await res.json();
    console.log('Response data:', data);
    return data;
  } else {
    const text = await res.text();
    console.log('Expected JSON but got:', text.substring(0, 200));
    
    // Check if it's an HTML response (likely auth redirect)
    if (text.trim().startsWith('<!DOCTYPE html>') || text.trim().startsWith('<html')) {
      throw new Error('Server returned HTML instead of JSON - likely an authentication issue');
    }
    
    throw new Error('Server returned non-JSON response');
  }
}

// -------------------
// Modal System - Matching Guest Mode Style
// -------------------
function showModal(title, content, buttons = []) {
  // Remove any existing modal first
  closeModal();
  
  const modalHtml = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="customModal">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg leading-6 font-medium text-gray-900">${title}</h3>
            <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 focus:outline-none">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
          </div>
          <div class="mt-2 px-7 py-3">
            <div class="text-sm text-gray-500">${content}</div>
          </div>
          <div class="flex justify-center gap-3 px-4 py-3">
            ${buttons.map(btn => `
              <button onclick="${btn.action}" class="${btn.class || 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline'}">${btn.text}</button>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Add click outside to close
  document.getElementById('customModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });
}

function showInfoModal(message) {
  showModal('Information', message, [
    { text: 'OK', action: 'closeModal()', class: 'bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline' }
  ]);
}

function showSuccessModal(message) {
  showModal('Success', message, [
    { text: 'OK', action: 'closeModal()', class: 'bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline' }
  ]);
}

function showConfirmModal(message, onConfirm, onCancel = null) {
  const confirmId = 'confirm_' + Date.now();
  window[confirmId] = () => {
    closeModal();
    onConfirm();
  };
  
  const cancelId = 'cancel_' + Date.now();
  window[cancelId] = () => {
    closeModal();
    if (onCancel) onCancel();
  };

  showModal('Confirm', message, [
    { text: 'Cancel', action: `${cancelId}()`, class: 'bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md' },
    { text: 'Confirm', action: `${confirmId}()`, class: 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md' }
  ]);
}

function closeModal() {
  const modal = document.getElementById('customModal');
  if (modal) {
    modal.remove();
  }
  
  // Also close any other modal types that might exist
  const customScoreModal = document.getElementById('customScoreModal');
  if (customScoreModal) {
    customScoreModal.remove();
  }
}

// -------------------
// Guest Mode Functions
// -------------------
function updateStudentDisplay(allStudents, skippedStudents, calledStudents) {
  const studentList = document.getElementById("studentList");
  if (!studentList) return;

  studentList.innerHTML = `
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div class="bg-gray-50 px-6 py-3 border-b">
        <h3 class="text-lg font-medium text-gray-900">Students Called</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${calledStudents.map((student, index) => `
              <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBadgeClass(student.score)}">
                    ${student.score || 'No score'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.time}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${calledStudents.length === 0 ? '<div class="px-6 py-8 text-center text-gray-500">No students called yet</div>' : ''}
      </div>
    </div>

    <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-blue-50 rounded-lg p-4">
        <h4 class="font-medium text-blue-900 mb-2">Available (${allStudents.length - calledStudents.length})</h4>
        <div class="text-sm text-blue-700">
          ${allStudents.filter(s => !calledStudents.some(c => c.name === s.name)).map(s => s.name).join(', ') || 'None'}
        </div>
      </div>
      
      <div class="bg-yellow-50 rounded-lg p-4">
        <h4 class="font-medium text-yellow-900 mb-2">Skipped (${skippedStudents.length})</h4>
        <div class="text-sm text-yellow-700">
          ${skippedStudents.map(s => s.name).join(', ') || 'None'}
        </div>
      </div>
    </div>
  `;

  // Show export option if all students called
  const allCalled = (calledStudents.length + skippedStudents.length) >= allStudents.length;
  const exportSection = document.getElementById("exportSection");
  if (exportSection) {
    exportSection.style.display = allCalled ? "block" : "none";
  }
}

function getScoreBadgeClass(score) {
  if (!score) return 'bg-gray-100 text-gray-800';
  
  const numScore = parseFloat(score);
  if (!isNaN(numScore)) {
    if (numScore >= 90) return 'bg-green-100 text-green-800';
    if (numScore >= 80) return 'bg-blue-100 text-blue-800';
    if (numScore >= 70) return 'bg-yellow-100 text-yellow-800';
    if (numScore >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  }
  
  // Text scores
  const lowerScore = score.toLowerCase();
  if (['excellent', 'perfect', 'outstanding'].includes(lowerScore)) return 'bg-green-100 text-green-800';
  if (['good', 'well done', 'nice'].includes(lowerScore)) return 'bg-blue-100 text-blue-800';
  if (['okay', 'fair', 'average'].includes(lowerScore)) return 'bg-yellow-100 text-yellow-800';
  if (['poor', 'needs work'].includes(lowerScore)) return 'bg-red-100 text-red-800';
  
  return 'bg-purple-100 text-purple-800'; // Custom scores
}

// -------------------
// Initialize and run
// -------------------
document.addEventListener("DOMContentLoaded", function () {
  console.log("DOM loaded, initializing app...");

  // Check if we're on the main page or a specific route
  const currentPath = window.location.pathname;
  console.log("Current path:", currentPath);

  // Guest mode functionality
  if (document.getElementById("guestModeBtn")) {
    console.log("Setting up guest mode...");
    setupGuestMode();
  }

  // Class management functionality
  if (document.getElementById("classForm")) {
    console.log("Setting up class form...");
    setupClassForm();
  }

  // Student list management
  if (document.getElementById("addStudentsBtn")) {
    console.log("Setting up student management...");
    setupStudentManagement();
  }

  // Recita functionality (authenticated mode)
  if (document.getElementById("saveRecitaBtn")) {
    console.log("Setting up authenticated recita mode...");
    setupAuthenticatedMode();
  }

  // Class page functionality
  if (currentPath.startsWith('/classes/') && document.getElementById("recitaHistory")) {
    console.log("Setting up class page...");
    setupClassPage();
  }
});

// -------------------
// Guest Mode Setup
// -------------------
function setupGuestMode() {
  const guestModeBtn = document.getElementById("guestModeBtn");
  const studentInput = document.getElementById("studentInput");
  const startSessionBtn = document.getElementById("startSessionBtn");
  const pickStudentBtn = document.getElementById("pickStudentBtn");
  const skipStudentBtn = document.getElementById("skipStudentBtn");
  const newSessionBtn = document.getElementById("newSessionBtn");
  const exportBtn = document.getElementById("exportBtn");
  const topicInput = document.getElementById("topicInput");

  let allStudents = [];
  let availableStudents = [];
  let calledStudents = [];
  let skippedStudents = [];
  let currentStudent = null;

  if (guestModeBtn) {
    guestModeBtn.addEventListener("click", () => {
      document.getElementById("authSection").style.display = "none";
      document.getElementById("guestSection").style.display = "block";
      studentInput.focus();
    });
  }

  if (startSessionBtn) {
    startSessionBtn.addEventListener("click", () => {
      const names = studentInput.value
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      if (names.length === 0) {
        showInfoModal("Please enter at least one student name.");
        return;
      }

      // Initialize arrays
      allStudents = names.map(name => ({ name }));
      availableStudents = [...allStudents];
      calledStudents = [];
      skippedStudents = [];
      currentStudent = null;

      // Show session interface
      document.getElementById("guestSetup").style.display = "none";
      document.getElementById("guestSession").style.display = "block";
      
      updateStudentDisplay(allStudents, skippedStudents, calledStudents);
      updatePickButton();
    });
  }

  if (pickStudentBtn) {
    pickStudentBtn.addEventListener("click", () => {
      if (availableStudents.length === 0) {
        showInfoModal("No more students available to pick!");
        return;
      }

      const randomIndex = Math.floor(Math.random() * availableStudents.length);
      currentStudent = availableStudents[randomIndex];
      availableStudents.splice(randomIndex, 1);

      document.getElementById("selectedStudent").textContent = currentStudent.name;
      document.getElementById("studentPicked").style.display = "block";
    });
  }

  if (skipStudentBtn) {
    skipStudentBtn.addEventListener("click", () => {
      if (currentStudent) {
        skippedStudents.push({
          ...currentStudent,
          time: new Date().toLocaleTimeString()
        });
        
        currentStudent = null;
        document.getElementById("studentPicked").style.display = "none";
        updateStudentDisplay(allStudents, skippedStudents, calledStudents);
        updatePickButton();
      }
    });
  }

  // Score buttons
  const scoreButtons = document.querySelectorAll('.score-btn');
  scoreButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStudent) {
        const score = btn.dataset.score;
        
        if (score === 'custom') {
          showCustomScoreModal();
        } else {
          recordStudentScore(score);
        }
      }
    });
  });

  function showCustomScoreModal() {
    const modalHtml = `
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="customScoreModal">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">Enter Custom Score</h3>
          <input type="text" id="customScoreInput" placeholder="Enter score (number or text)" 
                 class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4">
          <div class="flex gap-3 justify-end">
            <button onclick="closeCustomScoreModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md">Cancel</button>
            <button onclick="submitCustomScore()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">Submit</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('customScoreInput').focus();
  }

  window.closeCustomScoreModal = function() {
    const modal = document.getElementById('customScoreModal');
    if (modal) modal.remove();
  };

  window.submitCustomScore = function() {
    const input = document.getElementById('customScoreInput');
    const score = input.value.trim();
    
    if (score) {
      recordStudentScore(score);
    }
    
    closeCustomScoreModal();
  };

  function recordStudentScore(score) {
    if (currentStudent) {
      calledStudents.push({
        ...currentStudent,
        score: score,
        time: new Date().toLocaleTimeString()
      });
      
      currentStudent = null;
      document.getElementById("studentPicked").style.display = "none";
      updateStudentDisplay(allStudents, skippedStudents, calledStudents);
      updatePickButton();
    }
  }

  function updatePickButton() {
    const allCalled = (calledStudents.length + skippedStudents.length) >= allStudents.length;
    
    if (pickStudentBtn) {
      if (allCalled) {
        pickStudentBtn.textContent = "All Students Called!";
        pickStudentBtn.disabled = true;
        pickStudentBtn.className = "w-full bg-green-500 text-white px-6 py-3 rounded-md font-medium";
        
        // Show export prompt
        setTimeout(() => {
          showConfirmModal(
            "All students have been called! Would you like to export the results to CSV?",
            () => exportToCSV()
          );
        }, 500);
      } else {
        pickStudentBtn.textContent = `Pick Student (${availableStudents.length} remaining)`;
        pickStudentBtn.disabled = false;
        pickStudentBtn.className = "w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md font-medium";
      }
    }
  }

  if (newSessionBtn) {
    newSessionBtn.addEventListener("click", () => {
      if (calledStudents.length > 0 || skippedStudents.length > 0) {
        showConfirmModal(
          "This will clear all current session data. Continue?",
          () => {
            document.getElementById("guestSession").style.display = "none";
            document.getElementById("guestSetup").style.display = "block";
            document.getElementById("studentPicked").style.display = "none";
            studentInput.value = "";
            allStudents = [];
            availableStudents = [];
            calledStudents = [];
            skippedStudents = [];
            currentStudent = null;
          }
        );
      } else {
        document.getElementById("guestSession").style.display = "none";
        document.getElementById("guestSetup").style.display = "block";
        document.getElementById("studentPicked").style.display = "none";
        studentInput.value = "";
      }
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener("click", () => exportToCSV());
  }

  function exportToCSV() {
    const topic = topicInput?.value || "Guest Session";
    const timestamp = new Date().toLocaleString();
    
    let csvContent = `Recita Session - ${topic}\nDate/Time: ${timestamp}\n\n`;
    csvContent += "Name,Score,Time,Status\n";
    
    calledStudents.forEach(student => {
      csvContent += `"${student.name}","${student.score || 'No score'}","${student.time}","Called"\n`;
    });
    
    skippedStudents.forEach(student => {
      csvContent += `"${student.name}","N/A","${student.time}","Skipped"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recita-${topic.replace(/[^a-zA-Z0-9]/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showSuccessModal("CSV exported successfully!");
  }
}

// -------------------
// Class Form Setup
// -------------------
function setupClassForm() {
  const classForm = document.getElementById("classForm");
  
  if (classForm) {
    classForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      
      const formData = new FormData(classForm);
      const className = formData.get("className");
      
      if (!className?.trim()) {
        showInfoModal("Please enter a class name.");
        return;
      }

      try {
        const result = await apiFetch("/classes", {
          method: "POST",
          body: JSON.stringify({ name: className.trim() })
        });

        if (result?.id) {
          showSuccessModal("Class created successfully!");
          setTimeout(() => {
            window.location.href = `/classes/${result.id}`;
          }, 1500);
        }
      } catch (err) {
        console.error("Error creating class:", err);
        showInfoModal(`Failed to create class: ${err.message}`);
      }
    });
  }
}

// -------------------
// Student Management Setup
// -------------------
function setupStudentManagement() {
  const addStudentsBtn = document.getElementById("addStudentsBtn");
  const studentInput = document.getElementById("studentInput");
  
  if (addStudentsBtn && studentInput) {
    addStudentsBtn.addEventListener("click", async () => {
      const names = studentInput.value
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      if (!names.length) {
        showInfoModal("Please enter at least one student name.");
        return;
      }

      try {
        const classId = localStorage.getItem("classId");
        if (!classId) {
          showInfoModal("No class selected. Please select a class first.");
          return;
        }

        const students = names.map(name => ({ name, classId: parseInt(classId) }));
        
        await apiFetch("/students", {
          method: "POST",
          body: JSON.stringify({ students })
        });

        showSuccessModal(`Successfully added ${names.length} students!`);
        studentInput.value = "";
        
        // Refresh student list
        loadStudentList();
        
      } catch (err) {
        console.error("Error adding students:", err);
        showInfoModal(`Failed to add students: ${err.message}`);
      }
    });
  }
}

async function loadStudentList() {
  try {
    const classId = localStorage.getItem("classId");
    if (!classId) return;

    const students = await apiFetch(`/students?classId=${classId}`);
    const studentList = document.getElementById("studentList");
    
    if (studentList && students?.length) {
      studentList.innerHTML = `
        <div class="mt-6">
          <h3 class="text-lg font-medium text-gray-900 mb-4">Current Students (${students.length})</h3>
          <div class="bg-white rounded-lg shadow border">
            <ul class="divide-y divide-gray-200">
              ${students.map(student => `
                <li class="px-6 py-4 flex justify-between items-center">
                  <span class="text-gray-900">${student.name}</span>
                  <button onclick="removeStudent(${student.id})" class="text-red-600 hover:text-red-800 text-sm">Remove</button>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error("Error loading students:", err);
  }
}

// -------------------
// Authenticated Mode Setup
// -------------------
function setupAuthenticatedMode() {
  const saveRecitaBtn = document.getElementById("saveRecitaBtn");
  const pickSection = document.getElementById("pickSection");
  
  console.log("saveRecitaBtn found:", !!saveRecitaBtn);
  console.log("pickSection found:", !!pickSection);

  if (saveRecitaBtn) {
    const classId = localStorage.getItem("classId");
    console.log("Class ID from localStorage:", classId);
    
    // Check if we already have a saved recita
    const currentRecitaId = localStorage.getItem("currentRecitaId");
    if (currentRecitaId) {
      console.log("Found existing recita ID:", currentRecitaId);
      if (pickSection) {
        pickSection.style.display = "block";
        loadRecitaStudents(currentRecitaId);
      }
    }

    saveRecitaBtn.addEventListener("click", async () => {
      const topicInput = document.getElementById("topicInput");
      const topic = topicInput?.value?.trim();
      
      if (!topic) {
        showInfoModal("Please enter a topic for this recitation.");
        return;
      }

      if (!classId) {
        showInfoModal("No class selected. Please select a class first.");
        return;
      }

      // Check if we already have an active recita
      const currentRecitaId = localStorage.getItem("currentRecitaId");
      
      if (currentRecitaId) {
        // Update existing recita topic instead of creating new one
        try {
          console.log("Updating existing recita topic:", currentRecitaId, "to:", topic);
          
          const response = await apiFetch("/attendance", {
            method: "PATCH",
            body: JSON.stringify({
              recitaId: parseInt(currentRecitaId),
              topic: topic
            })
          });

          if (response.success) {
            showSuccessModal(`Recita topic updated to "${topic}" successfully!`);
            
            // Refresh the display to show updated topic
            loadRecitaStudents(currentRecitaId);
          } else {
            showInfoModal("Failed to update recita topic.");
          }

        } catch (err) {
          console.error("Error updating recita topic:", err);
          showInfoModal(`Failed to update topic: ${err.message}`);
        }
        return;
      }

      // Create new recita only if none exists
      try {
        console.log("Creating new recita with topic:", topic, "and classId:", classId);
        
        // Ensure classId is an integer
        const numericClassId = parseInt(classId, 10);
        
        const payload = {
          topic: topic,
          classId: numericClassId
        };
        
        console.log("Sending to server:", payload);
        
        // Make the API call
        const response = await apiFetch("/attendance", {
          method: "POST",
          body: JSON.stringify(payload)
        });

        console.log("Server response:", response);
        console.log("Response keys:", Object.keys(response));
        
        // Extract recita ID from response
        const recitaId = response.id;
        
        if (recitaId) {
          console.log("Got recita ID:", recitaId);
          
          // Store the recita ID
          localStorage.setItem("currentRecitaId", recitaId.toString());
          console.log("Stored in localStorage - ID:", localStorage.getItem("currentRecitaId"));
          
          // Show success and enable pick section
          showSuccessModal(`Recita "${topic}" saved successfully! You can now start picking students.`);
          
          if (pickSection) {
            pickSection.style.display = "block";
            loadRecitaStudents(recitaId);
          }
          
        } else {
          console.log("No ID in server response:", response);
          showInfoModal("Recita saved but ID not found. Please refresh and try again.");
        }

      } catch (err) {
        console.error("Error saving recita:", err);
        showInfoModal(`Failed to save recita: ${err.message}`);
      }
    });
  }

  // Pick Student functionality
  setupPickStudent();
}

function setupPickStudent() {
  console.log("Setting up pick student event listener");
  
  document.addEventListener("click", async (e) => {
    if (e.target.id === "pickStudentBtn") {
      console.log("Pick student button clicked!");
      
      const recitaId = localStorage.getItem("currentRecitaId");
      console.log("Pick student clicked, recitaId from localStorage:", recitaId);
      console.log("All localStorage keys:", Object.keys(localStorage));
      console.log("localStorage recitaId type:", typeof recitaId);
      
      if (!recitaId) {
        showInfoModal("No active recitation. Please save a recita first.");
        return;
      }

      try {
        // Use query parameter format that works with your server
        const requestUrl = `/attendance?action=pick&recitaId=${recitaId}`;
        console.log("Making request to:", requestUrl);
        
        const response = await apiFetch(requestUrl);
        console.log("Pick student response:", response);

        if (response.student) {
          const studentName = response.student.name;
          document.getElementById("selectedStudent").textContent = studentName;
          document.getElementById("studentPicked").style.display = "block";
          
          // Store current picked student
          localStorage.setItem("currentPickedStudent", JSON.stringify(response.student));
          
        } else if (response.message) {
          showInfoModal(response.message);
        } else {
          showInfoModal("No students available to pick.");
        }

      } catch (err) {
        console.error("Pick student error:", err);
        showInfoModal(`Failed to pick student: ${err.message}`);
      }
    }

    // Handle score buttons
    if (e.target.classList.contains('score-btn')) {
      const score = e.target.dataset.score;
      const currentStudent = JSON.parse(localStorage.getItem("currentPickedStudent") || "null");
      
      if (!currentStudent) {
        showInfoModal("No student currently selected.");
        return;
      }

      if (score === 'custom') {
        showAuthenticatedCustomScoreModal(currentStudent);
      } else {
        await recordAuthenticatedScore(currentStudent, score);
      }
    }

    // Handle skip button
    if (e.target.id === "skipStudentBtn") {
      const currentStudent = JSON.parse(localStorage.getItem("currentPickedStudent") || "null");
      
      if (!currentStudent) {
        showInfoModal("No student currently selected.");
        return;
      }

      await recordAuthenticatedScore(currentStudent, null, true);
    }
  });
}

function showAuthenticatedCustomScoreModal(student) {
  const modalHtml = `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" id="customScoreModal">
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Score for ${student.name}</h3>
        <input type="text" id="customScoreInput" placeholder="Enter score (number or text)" 
               class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4">
        <div class="flex gap-3 justify-end">
          <button onclick="closeCustomScoreModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md">Cancel</button>
          <button onclick="submitAuthenticatedCustomScore()" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">Submit</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  document.getElementById('customScoreInput').focus();
}

window.submitAuthenticatedCustomScore = async function() {
  const input = document.getElementById('customScoreInput');
  const score = input.value.trim();
  const currentStudent = JSON.parse(localStorage.getItem("currentPickedStudent") || "null");
  
  if (score && currentStudent) {
    await recordAuthenticatedScore(currentStudent, score);
  }
  
  closeCustomScoreModal();
};

async function recordAuthenticatedScore(student, score, isSkipped = false) {
  const recitaId = localStorage.getItem("currentRecitaId");
  
  if (!recitaId || !student) {
    showInfoModal("Missing recitation or student data.");
    return;
  }

  try {
    const payload = {
      studentId: student.id,
      recitaId: parseInt(recitaId),
      score: isSkipped ? null : score,
      status: isSkipped ? 'skipped' : 'called'
    };

    const response = await apiFetch("/attendance", {
      method: "PUT",
      body: JSON.stringify(payload)
    });

    if (response.success) {
      const statusText = isSkipped ? 'skipped' : `called with score: ${score}`;
      showSuccessModal(`${student.name} ${statusText}`);
      
      // Clear current student
      localStorage.removeItem("currentPickedStudent");
      document.getElementById("studentPicked").style.display = "none";
      
      // Refresh the recita students display
      loadRecitaStudents(recitaId);
      
    } else {
      showInfoModal("Failed to record attendance.");
    }

  } catch (err) {
    console.error("Error recording score:", err);
    showInfoModal(`Failed to record attendance: ${err.message}`);
  }
}

async function loadRecitaStudents(recitaId) {
  try {
    const response = await apiFetch(`/attendance?recitaId=${recitaId}`);
    
    if (response.students) {
      updateAuthenticatedStudentDisplay(response.students, response.recita);
    }
    
  } catch (err) {
    console.error("Error loading recita students:", err);
  }
}

function updateAuthenticatedStudentDisplay(students, recita) {
  const studentList = document.getElementById("studentList");
  if (!studentList) return;

  const calledStudents = students.filter(s => s.status === 'called');
  const skippedStudents = students.filter(s => s.status === 'skipped');
  const totalStudents = students.length;
  const remainingCount = totalStudents - calledStudents.length - skippedStudents.length;

  studentList.innerHTML = `
    <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
      <div class="bg-gray-50 px-6 py-4 border-b">
        <div class="flex justify-between items-center">
          <div>
            <h3 class="text-lg font-medium text-gray-900">${recita?.topic || 'Current Recitation'}</h3>
            <p class="text-sm text-gray-500">${recita?.date || new Date().toLocaleDateString()} • Called: ${calledStudents.length} • Remaining: ${remainingCount}</p>
          </div>
          <div class="flex gap-2">
            <button onclick="exportRecitaCSV(${recita?.id})" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
              Export CSV
            </button>
            ${remainingCount === 0 ? '<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">Complete!</span>' : ''}
          </div>
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead class="bg-gray-50 border-b">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            ${calledStudents.map((student, index) => `
              <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getScoreBadgeClass(student.score)}">
                    ${student.score || 'No score'}
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${student.picked_at ? new Date(student.picked_at).toLocaleTimeString() : 'N/A'}</td>
              </tr>
            `).join('')}
            ${skippedStudents.map((student, index) => `
              <tr class="${(calledStudents.length + index) % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-400">${student.name}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
                    Skipped
                  </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${student.picked_at ? new Date(student.picked_at).toLocaleTimeString() : 'N/A'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${calledStudents.length === 0 && skippedStudents.length === 0 ? '<div class="px-6 py-8 text-center text-gray-500">No students called yet</div>' : ''}
      </div>
    </div>
  `;

  // Update pick button status
  const pickStudentBtn = document.getElementById("pickStudentBtn");
  if (pickStudentBtn) {
    if (remainingCount === 0) {
      pickStudentBtn.textContent = "All Students Called!";
      pickStudentBtn.disabled = true;
      pickStudentBtn.className = "w-full bg-green-500 text-white px-6 py-3 rounded-md font-medium";
    } else {
      pickStudentBtn.textContent = `Pick Student (${remainingCount} remaining)`;
      pickStudentBtn.disabled = false;
      pickStudentBtn.className = "w-full bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-md font-medium";
    }
  }

  // Show completion prompt
  if (remainingCount === 0 && calledStudents.length > 0) {
    setTimeout(() => {
      showConfirmModal(
        "All students have been called! Would you like to export the results?",
        () => exportRecitaCSV(recita?.id)
      );
    }, 1000);
  }
}

// -------------------
// Class Page Setup
// -------------------
function setupClassPage() {
  loadClassRecitaHistory();
  setupClassExportButton();
}

async function loadClassRecitaHistory() {
  try {
    const classId = getClassIdFromUrl();
    if (!classId) return;

    const response = await apiFetch(`/recitas?classId=${classId}`);
    const recitaHistory = document.getElementById("recitaHistory");
    
    if (!recitaHistory) return;

    if (response.recitas && response.recitas.length > 0) {
      recitaHistory.innerHTML = `
        <div class="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div class="bg-gray-50 px-6 py-4 border-b">
            <h3 class="text-lg font-medium text-gray-900">Recitation History</h3>
            <p class="text-sm text-gray-500">${response.recitas.length} recitations found</p>
          </div>
          <div class="divide-y divide-gray-200">
            ${response.recitas.map(recita => `
              <div class="px-6 py-4">
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <h4 class="text-base font-medium text-gray-900">${recita.topic}</h4>
                    <p class="text-sm text-gray-500 mt-1">
                      ${new Date(recita.created_at).toLocaleDateString()} • 
                      ${recita.student_count || 0} students called
                    </p>
                  </div>
                  <div class="flex gap-2 ml-4">
                    <button onclick="exportRecitaCSV(${recita.id})" 
                            class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm">
                      Export CSV
                    </button>
                    <button onclick="viewRecitaDetails(${recita.id})" 
                            class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      recitaHistory.innerHTML = `
        <div class="bg-gray-50 rounded-lg p-8 text-center">
          <p class="text-gray-500">No recitations found for this class.</p>
          <p class="text-sm text-gray-400 mt-2">Start a new recitation to see it listed here.</p>
        </div>
      `;
    }

  } catch (err) {
    console.error("Error loading recita history:", err);
  }
}

function setupClassExportButton() {
  const exportAllBtn = document.getElementById("exportAllBtn");
  if (exportAllBtn) {
    exportAllBtn.addEventListener("click", async () => {
      const classId = getClassIdFromUrl();
      if (!classId) return;

      try {
        const response = await fetch(`/export?classId=${classId}`, {
          credentials: "include"
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `class-${classId}-all-recitations-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);

        showSuccessModal("All recitations exported successfully!");

      } catch (err) {
        console.error("Export error:", err);
        showInfoModal(`Failed to export: ${err.message}`);
      }
    });
  }
}

function getClassIdFromUrl() {
  const pathMatch = window.location.pathname.match(/\/classes\/(\d+)/);
  return pathMatch ? pathMatch[1] : null;
}

// -------------------
// Export Functions
// -------------------
window.exportRecitaCSV = async function(recitaId) {
  if (!recitaId) {
    showInfoModal("No recitation ID provided for export.");
    return;
  }

  try {
    const response = await fetch(`/export?recitaId=${recitaId}`, {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recita-${recitaId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    showSuccessModal("Recitation exported successfully!");

  } catch (err) {
    console.error("Export error:", err);
    showInfoModal(`Failed to export recitation: ${err.message}`);
  }
};

window.viewRecitaDetails = async function(recitaId) {
  try {
    const response = await apiFetch(`/recitas/${recitaId}/details`);
    
    if (response.recita && response.students) {
      const modalContent = `
        <div class="max-h-96 overflow-y-auto">
          <div class="mb-4">
            <h4 class="font-medium text-gray-900">${response.recita.topic}</h4>
            <p class="text-sm text-gray-500">${new Date(response.recita.created_at).toLocaleDateString()}</p>
          </div>
          <div class="space-y-2">
            ${response.students.map((student, index) => `
              <div class="flex justify-between items-center p-2 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} rounded">
                <span class="font-medium">${student.name}</span>
                <div class="flex gap-2 text-sm">
                  <span class="px-2 py-1 rounded ${getScoreBadgeClass(student.score)}">${student.score || 'No score'}</span>
                  <span class="text-gray-500">${student.picked_at ? new Date(student.picked_at).toLocaleTimeString() : 'N/A'}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      showModal(`Recitation Details`, modalContent, [
        { text: 'Export CSV', action: `exportRecitaCSV(${recitaId})`, class: 'bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md mr-2' },
        { text: 'Close', action: 'closeModal()', class: 'bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md' }
      ]);
    }

  } catch (err) {
    console.error("Error loading recita details:", err);
    showInfoModal(`Failed to load details: ${err.message}`);
  }
};

// -------------------
// Utility Functions
// -------------------
window.removeStudent = async function(studentId) {
  showConfirmModal(
    "Are you sure you want to remove this student?",
    async () => {
      try {
        await apiFetch(`/students/${studentId}`, { method: "DELETE" });
        showSuccessModal("Student removed successfully!");
        loadStudentList();
      } catch (err) {
        showInfoModal(`Failed to remove student: ${err.message}`);
      }
    }
  );
};

// Handle Enter key in custom score inputs
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (e.target.id === 'customScoreInput') {
      if (document.getElementById('customScoreModal')) {
        if (window.submitAuthenticatedCustomScore) {
          window.submitAuthenticatedCustomScore();
        } else if (window.submitCustomScore) {
          window.submitCustomScore();
        }
      }
    }
  }
});
