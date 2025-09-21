// -------------------
// Base helpers
// -------------------
async function apiFetch(url, options = {}) {
  console.log('Making API request to:', url);
  
  const res = await fetch(url, {
    credentials: "include", // keep session cookies
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  
  console.log('API response status:', res.status);
  return res;
}

// -------------------
// Modal System - Safe and Complete
// -------------------
function showModal(title, content, buttons = []) {
  closeModal();
  
  const modalHtml = `
    <div id="appModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50" onclick="closeModal()">
      <div class="relative top-20 mx-auto border w-96 shadow-lg rounded-md bg-white" onclick="event.stopPropagation()">
        <div class="mt-3 text-center">
          <h3 class="text-lg font-medium text-gray-900 p-4">${title}</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-sm text-gray-500">${content}</p>
          </div>
          <div class="flex gap-3 justify-center px-4 py-3">
            ${buttons.map(btn => `<button onclick="${btn.onclick}" class="${btn.class}">${btn.text}</button>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function showSuccessModal(message) {
  showModal("Success", message, [{
    text: "OK",
    class: "bg-green-500 hover:bg-green-700 text-white px-4 py-2 rounded-md",
    onclick: "closeModal()"
  }]);
}

function showInfoModal(message) {
  showModal("Information", message, [{
    text: "OK", 
    class: "bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-md",
    onclick: "closeModal()"
  }]);
}

function showConfirmModal(message, onConfirm) {
  showModal("Confirm", message, [
    {
      text: "Cancel",
      class: "bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md",
      onclick: "closeModal()"
    },
    {
      text: "Confirm",
      class: "bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-md",
      onclick: `${onConfirm}(); closeModal()`
    }
  ]);
}

function closeModal() {
  const modal = document.getElementById('appModal');
  if (modal) {
    modal.remove();
  }
}

// -------------------
// Export Functions with Complete Validation
// -------------------
window.exportRecitaCSV = async function(recitaId) {
  if (!recitaId) {
    showInfoModal("No recitation ID provided for export.");
    return;
  }

  try {
    // First, check if all students are called
    const checkRes = await apiFetch(`/attendance?recitaId=${recitaId}`);
    if (!checkRes.ok) {
      showInfoModal("Failed to check recitation status.");
      return;
    }

    const data = await checkRes.json();
    const totalStudents = data.students?.length || 0;
    const calledStudents = data.students?.filter(s => s.status).length || 0;
    const remainingCount = totalStudents - calledStudents;

    if (remainingCount > 0) {
      showInfoModal(`Cannot export yet! ${remainingCount} students still need to be called. Please finish the recitation first.`);
      return;
    }

    // All students called, proceed with export confirmation
    showConfirmModal(
      `Export "${data.topic}" recitation? This will include ${calledStudents} student records.`,
      () => proceedWithRecitaExport(recitaId)
    );

  } catch (err) {
    console.error("Export check error:", err);
    showInfoModal("Failed to validate recitation completion.");
  }
};

window.proceedWithRecitaExport = async function(recitaId) {
  try {
    const res = await apiFetch(`/export?recitaId=${recitaId}`);
    if (!res.ok) {
      const error = await res.text();
      showInfoModal(`Export failed: ${error}`);
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    
    // Get filename from Content-Disposition header or create one
    const contentDisposition = res.headers.get('content-disposition');
    let filename = 'recitation.csv';
    if (contentDisposition) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
      if (matches != null && matches[1]) {
        filename = matches[1].replace(/['"]/g, '');
      }
    } else {
      // Create filename with date
      const dateSafe = new Date().toISOString().slice(0, 10);
      filename = `recita-${recitaId}-${dateSafe}.csv`;
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showSuccessModal("Recitation exported successfully!");
  } catch (err) {
    console.error("Export error:", err);
    showInfoModal("Export failed. Please try again.");
  }
};

window.exportClassCSV = async function(classId) {
  if (!classId) {
    showInfoModal("No class ID provided for export.");
    return;
  }

  showConfirmModal(
    "Export all recitations for this class? This will include all historical data.",
    () => proceedWithClassExport(classId)
  );
};

window.proceedWithClassExport = async function(classId) {
  try {
    const res = await apiFetch(`/export?classId=${classId}`);
    if (!res.ok) {
      showInfoModal("Export failed");
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `class-export-${classId}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showSuccessModal("All recitations exported successfully!");
  } catch (err) {
    console.error("Class export error:", err);
    showInfoModal("Export failed. Please try again.");
  }
};

// -------------------
// Student table display functions
// -------------------
function updateStudentTable(students) {
  const tableContainer = document.getElementById('calledStudents');
  if (!tableContainer) return;

  if (!students || students.length === 0) {
    tableContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No students called yet</p>';
    return;
  }

  // Filter only students that have been called or skipped
  const calledStudents = students.filter(s => s.status);
  
  if (calledStudents.length === 0) {
    tableContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No students called yet</p>';
    return;
  }

  // Sort by pick order
  calledStudents.sort((a, b) => (a.picked_at || '').localeCompare(b.picked_at || ''));

  let tableHtml = `
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Score</th>
            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
  `;

  calledStudents.forEach((student, index) => {
    const rowClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    const score = student.score || 'No score';
    const time = student.picked_at ? new Date(student.picked_at).toLocaleTimeString() : 'Unknown';
    
    // Score badge styling
    let scoreBadge = '';
    if (student.status === 'skipped') {
      scoreBadge = '<span class="px-2 py-1 text-xs rounded-full bg-gray-200 text-gray-800">Skipped</span>';
    } else if (score === 'No score') {
      scoreBadge = '<span class="px-2 py-1 text-xs rounded-full bg-yellow-200 text-yellow-800">No Score</span>';
    } else {
      // Try to determine if it's a numeric score for color coding
      const numScore = parseFloat(score);
      if (!isNaN(numScore)) {
        if (numScore >= 90) {
          scoreBadge = `<span class="px-2 py-1 text-xs rounded-full bg-green-200 text-green-800">${score}</span>`;
        } else if (numScore >= 80) {
          scoreBadge = `<span class="px-2 py-1 text-xs rounded-full bg-blue-200 text-blue-800">${score}</span>`;
        } else if (numScore >= 70) {
          scoreBadge = `<span class="px-2 py-1 text-xs rounded-full bg-yellow-200 text-yellow-800">${score}</span>`;
        } else {
          scoreBadge = `<span class="px-2 py-1 text-xs rounded-full bg-red-200 text-red-800">${score}</span>`;
        }
      } else {
        // Non-numeric score (like "Excellent", "Good", etc.)
        scoreBadge = `<span class="px-2 py-1 text-xs rounded-full bg-purple-200 text-purple-800">${score}</span>`;
      }
    }

    tableHtml += `
      <tr class="${rowClass}">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${student.name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${scoreBadge}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${time}</td>
      </tr>
    `;
  });

  tableHtml += `
        </tbody>
      </table>
    </div>
  `;

  tableContainer.innerHTML = tableHtml;
}

// -------------------
// Main App Logic
// -------------------
document.addEventListener("DOMContentLoaded", function() {
  // Check if we're on a class page (authenticated mode)
  const classPage = document.querySelector('[data-class-id]');
  if (classPage) {
    setupAuthenticatedMode();
    return;
  }

  // Guest mode setup (homepage)
  const guestForm = document.getElementById("guestForm");
  if (guestForm) {
    setupGuestMode();
  }
});

function setupGuestMode() {
  const guestForm = document.getElementById("guestForm");
  const guestPicker = document.getElementById("guestPicker");
  
  guestForm?.addEventListener("submit", function(e) {
    e.preventDefault();
    
    const names = document.getElementById("studentNames").value
      .split('\n')
      .map(name => name.trim())
      .filter(name => name);
    
    if (names.length === 0) {
      alert("Please enter some student names.");
      return;
    }
    
    // Store names and show picker
    window.guestStudents = [...names];
    window.guestCalledStudents = [];
    
    guestForm.style.display = "none";
    guestPicker.style.display = "block";
    
    updateGuestStatus();
  });

  // Guest pick button
  document.getElementById("guestPickBtn")?.addEventListener("click", function() {
    if (!window.guestStudents || window.guestStudents.length === 0) {
      alert("No more students to pick!");
      return;
    }
    
    const randomIndex = Math.floor(Math.random() * window.guestStudents.length);
    const pickedStudent = window.guestStudents.splice(randomIndex, 1)[0];
    
    // Add to called students
    window.guestCalledStudents.push({
      name: pickedStudent,
      time: new Date().toLocaleTimeString()
    });
    
    // Show picked student modal (keeping original styling)
    showPickedStudentModal(pickedStudent);
    updateGuestStatus();
  });

  // Guest reset button  
  document.getElementById("guestResetBtn")?.addEventListener("click", function() {
    guestPicker.style.display = "none";
    guestForm.style.display = "block";
    document.getElementById("studentNames").value = "";
    window.guestStudents = [];
    window.guestCalledStudents = [];
  });
}

function showPickedStudentModal(studentName) {
  // This uses the original modal styling to not interfere with existing system
  const modalHtml = `
    <div id="pickedStudentModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3 text-center">
          <h3 class="text-lg font-medium text-gray-900">Selected Student</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-2xl font-bold text-blue-600">${studentName}</p>
          </div>
          <div class="items-center px-4 py-3">
            <button onclick="closePickedStudentModal()" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-blue-700">
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.closePickedStudentModal = function() {
  const modal = document.getElementById('pickedStudentModal');
  if (modal) {
    modal.remove();
  }
};

function updateGuestStatus() {
  const statusEl = document.getElementById("guestStatus");
  if (!statusEl) return;
  
  const remaining = window.guestStudents?.length || 0;
  const called = window.guestCalledStudents?.length || 0;
  
  statusEl.innerHTML = `
    <div class="text-center">
      <p class="text-lg mb-2">Students remaining: <span class="font-bold">${remaining}</span></p>
      <p class="text-lg mb-4">Students called: <span class="font-bold">${called}</span></p>
    </div>
  `;
  
  // Update called students list
  const calledList = document.getElementById("guestCalledStudents");
  if (calledList && window.guestCalledStudents?.length > 0) {
    calledList.innerHTML = `
      <h3 class="text-lg font-semibold mb-2">Called Students:</h3>
      <div class="space-y-1">
        ${window.guestCalledStudents.map((student, index) => 
          `<div class="flex justify-between items-center p-2 bg-gray-100 rounded">
            <span>${index + 1}. ${student.name}</span>
            <span class="text-sm text-gray-500">${student.time}</span>
          </div>`
        ).join('')}
      </div>
    `;
  }
}

function setupAuthenticatedMode() {
  const classPage = document.querySelector('[data-class-id]');
  if (!classPage) return;
  
  const classId = classPage.dataset.classId;
  console.log('Setting up authenticated mode for class:', classId);
  
  // Load recita history for this class
  loadRecitaHistory(classId);
  
  // Save recita button handler
  const saveRecitaBtn = document.getElementById("saveRecitaBtn");
  if (saveRecitaBtn) {
    saveRecitaBtn.addEventListener("click", async () => {
      const topicInput = document.getElementById("topicInput");
      const topic = topicInput?.value?.trim();
      
      if (!topic) {
        showInfoModal("Please enter a topic for this recitation.");
        return;
      }

      try {
        // Check if we're updating an existing recita or creating new one
        const currentRecitaId = localStorage.getItem('currentRecitaId');
        
        if (currentRecitaId) {
          // Update existing recita topic
          const res = await apiFetch("/attendance", {
            method: "PATCH",
            body: JSON.stringify({ recitaId: parseInt(currentRecitaId), topic })
          });

          if (res.ok) {
            showSuccessModal(`Recita topic updated to "${topic}"!`);
            // Reload recita history to show updated topic
            loadRecitaHistory(classId);
            return;
          } else {
            const error = await res.text();
            showInfoModal(`Failed to update topic: ${error}`);
            return;
          }
        }

        // Create new recita
        const res = await apiFetch("/attendance", {
          method: "POST", 
          body: JSON.stringify({ topic, classId: parseInt(classId) })
        });

        if (res.ok) {
          const data = await res.json();
          
          // Store the recita ID for future operations
          localStorage.setItem('currentRecitaId', data.id);
          localStorage.setItem('currentTopic', topic);
          
          // Show pick section and hide topic section
          document.getElementById("topicSection").style.display = "none";
          document.getElementById("pickSection").style.display = "block";
          
          // Show success and enable pick section
          showSuccessModal(`Recita "${topic}" saved successfully! You can now start picking students.`);
          
          // Load students for this recita
          await loadRecitaStudents(data.id);
          
          // Reload recita history
          loadRecitaHistory(classId);
        } else {
          const error = await res.text();
          showInfoModal(`Failed to save recita: ${error}`);
        }
      } catch (err) {
        console.error("Save recita error:", err);
        showInfoModal("Failed to save recita. Please try again.");
      }
    });
  }

  // Add students button handler
  const addStudentsBtn = document.getElementById("addStudentsBtn");
  if (addStudentsBtn) {
    addStudentsBtn.addEventListener("click", async () => {
      const namesText = document.getElementById("studentNamesAuth")?.value?.trim();
      
      if (!namesText) {
        showInfoModal("Please enter student names.");
        return;
      }

      const names = namesText.split('\n')
        .map(name => name.trim())
        .filter(name => name);

      if (names.length === 0) {
        showInfoModal("Please enter valid student names.");
        return;
      }

      try {
        const res = await apiFetch("/students", {
          method: "POST",
          body: JSON.stringify({ names, classId: parseInt(classId) })
        });

        if (res.ok) {
          showSuccessModal(`Successfully added ${names.length} students!`);
          document.getElementById("studentNamesAuth").value = "";
        } else {
          const error = await res.text();
          showInfoModal(`Failed to add students: ${error}`);
        }
      } catch (err) {
        console.error("Add students error:", err);
        showInfoModal("Failed to add students. Please try again.");
      }
    });
  }

  // Pick student button handler
  const pickBtn = document.getElementById("pickStudentBtn");
  if (pickBtn) {
    pickBtn.addEventListener("click", () => pickStudentAuthenticated());
  }

  // Custom score button handler  
  const customScoreBtn = document.getElementById("customScoreBtn");
  if (customScoreBtn) {
    customScoreBtn.addEventListener("click", () => showCustomScoreModal());
  }

  // Skip student button handler
  const skipBtn = document.getElementById("skipStudentBtn");  
  if (skipBtn) {
    skipBtn.addEventListener("click", () => skipStudentAuthenticated());
  }

  // Export current recita button handler
  const exportBtn = document.getElementById("exportCurrentBtn");
  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      const recitaId = localStorage.getItem('currentRecitaId');
      if (recitaId) {
        exportRecitaCSV(parseInt(recitaId));
      } else {
        showInfoModal("No active recitation to export.");
      }
    });
  }

  // Load any existing recita session
  const currentRecitaId = localStorage.getItem('currentRecitaId');
  if (currentRecitaId) {
    loadRecitaStudents(parseInt(currentRecitaId));
    document.getElementById("topicSection").style.display = "none";
    document.getElementById("pickSection").style.display = "block";
  }
}

// -------------------
// Custom Score Modal System
// -------------------
function showCustomScoreModal() {
  closeCustomScoreModal();
  
  const modalHtml = `
    <div id="customScoreModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="relative top-20 mx-auto border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3 text-center">
          <h3 class="text-lg font-medium text-gray-900 p-4">Custom Score</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-sm text-gray-500 mb-3">Enter a custom score for this student:</p>
            <input type="text" id="customScoreInput" placeholder="e.g., 95, Excellent, Good job!" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="flex gap-3 justify-center px-4 py-3">
            <button onclick="closeCustomScoreModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md">Cancel</button>
            <button onclick="submitCustomScore()" class="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-md">Submit</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Focus on input and allow Enter key
  setTimeout(() => {
    const input = document.getElementById('customScoreInput');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitCustomScore();
        }
      });
    }
  }, 100);
}

function submitCustomScore() {
  const input = document.getElementById('customScoreInput');
  const customScore = input?.value?.trim();
  
  if (!customScore) {
    showInfoModal("Please enter a score");
    return;
  }
  
  closeCustomScoreModal();
  
  // Call the authenticated pick student function with custom score
  window.currentCustomScore = customScore;
  pickStudentAuthenticated();
}

function closeCustomScoreModal() {
  const modal = document.getElementById('customScoreModal');
  if (modal) {
    modal.remove();
  }
}

async function pickStudentAuthenticated() {
  const currentRecitaId = localStorage.getItem('currentRecitaId');
  if (!currentRecitaId) {
    showInfoModal("Please save a recita topic first.");
    return;
  }

  try {
    const res = await apiFetch(`/attendance?action=pick&recitaId=${currentRecitaId}`);
    
    if (res.ok) {
      const data = await res.json();
      
      if (!data.student) {
        showInfoModal("No more students to pick! All students have been called.");
        return;
      }

      // Show the picked student
      window.currentPickedStudent = data.student;
      
      // Use custom score if set, otherwise prompt for score
      const customScore = window.currentCustomScore;
      if (customScore) {
        window.currentCustomScore = null; // Reset
        await recordStudentScore(data.student.id, parseInt(currentRecitaId), customScore, 'called');
      } else {
        showPickedStudentModalAuth(data.student);
      }
      
    } else {
      const error = await res.text();
      showInfoModal(`Failed to pick student: ${error}`);
    }
  } catch (err) {
    console.error("Pick student error:", err);
    showInfoModal("Failed to pick student. Please try again.");
  }
}

async function skipStudentAuthenticated() {
  const currentRecitaId = localStorage.getItem('currentRecitaId');
  if (!currentRecitaId) {
    showInfoModal("Please save a recita topic first.");
    return;
  }

  try {
    const res = await apiFetch(`/attendance?action=pick&recitaId=${currentRecitaId}`);
    
    if (res.ok) {
      const data = await res.json();
      
      if (!data.student) {
        showInfoModal("No more students to pick! All students have been called.");
        return;
      }

      // Record as skipped
      await recordStudentScore(data.student.id, parseInt(currentRecitaId), 'Skipped', 'skipped');
      
    } else {
      const error = await res.text();
      showInfoModal(`Failed to skip student: ${error}`);
    }
  } catch (err) {
    console.error("Skip student error:", err);
    showInfoModal("Failed to skip student. Please try again.");
  }
}

function showPickedStudentModalAuth(student) {
  // Show modal with score options
  const modalHtml = `
    <div id="pickedStudentAuthModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3 text-center">
          <h3 class="text-lg font-medium text-gray-900">Selected Student</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-2xl font-bold text-blue-600 mb-4">${student.name}</p>
            <p class="text-sm text-gray-500 mb-4">Choose a score:</p>
            <div class="flex flex-wrap gap-2 justify-center mb-4">
              <button onclick="scoreStudent(100)" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded">100</button>
              <button onclick="scoreStudent(95)" class="bg-green-400 hover:bg-green-500 text-white px-3 py-1 rounded">95</button>
              <button onclick="scoreStudent(90)" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded">90</button>
              <button onclick="scoreStudent(85)" class="bg-blue-400 hover:bg-blue-500 text-white px-3 py-1 rounded">85</button>
              <button onclick="scoreStudent(80)" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded">80</button>
              <button onclick="scoreStudent(75)" class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded">75</button>
              <button onclick="scoreStudent(70)" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded">70</button>
            </div>
          </div>
          <div class="flex gap-2 justify-center px-4 py-3">
            <button onclick="closePickedStudentAuthModal()" class="px-4 py-2 bg-gray-300 text-gray-700 text-base font-medium rounded-md shadow-sm hover:bg-gray-400">
              Cancel
            </button>
            <button onclick="showCustomScoreForCurrent()" class="px-4 py-2 bg-purple-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-purple-600">
              Custom
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.closePickedStudentAuthModal = function() {
  const modal = document.getElementById('pickedStudentAuthModal');
  if (modal) {
    modal.remove();
  }
};

window.scoreStudent = async function(score) {
  if (!window.currentPickedStudent) return;
  
  const currentRecitaId = localStorage.getItem('currentRecitaId');
  await recordStudentScore(window.currentPickedStudent.id, parseInt(currentRecitaId), score, 'called');
  closePickedStudentAuthModal();
};

window.showCustomScoreForCurrent = function() {
  closePickedStudentAuthModal();
  showCustomScoreModalForCurrent();
};

function showCustomScoreModalForCurrent() {
  const modalHtml = `
    <div id="customScoreCurrentModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div class="relative top-20 mx-auto border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3 text-center">
          <h3 class="text-lg font-medium text-gray-900 p-4">Custom Score</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-sm text-gray-500 mb-3">Enter a custom score for ${window.currentPickedStudent?.name || 'this student'}:</p>
            <input type="text" id="customScoreCurrentInput" placeholder="e.g., 95, Excellent, Good job!" 
                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
          </div>
          <div class="flex gap-3 justify-center px-4 py-3">
            <button onclick="closeCustomScoreCurrentModal()" class="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-md">Cancel</button>
            <button onclick="submitCustomScoreCurrent()" class="bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-md">Submit</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  setTimeout(() => {
    const input = document.getElementById('customScoreCurrentInput');
    if (input) {
      input.focus();
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          submitCustomScoreCurrent();
        }
      });
    }
  }, 100);
}

window.submitCustomScoreCurrent = async function() {
  const input = document.getElementById('customScoreCurrentInput');
  const customScore = input?.value?.trim();
  
  if (!customScore) {
    showInfoModal("Please enter a score");
    return;
  }
  
  if (!window.currentPickedStudent) return;
  
  const currentRecitaId = localStorage.getItem('currentRecitaId');
  await recordStudentScore(window.currentPickedStudent.id, parseInt(currentRecitaId), customScore, 'called');
  closeCustomScoreCurrentModal();
};

window.closeCustomScoreCurrentModal = function() {
  const modal = document.getElementById('customScoreCurrentModal');
  if (modal) {
    modal.remove();
  }
};

async function recordStudentScore(studentId, recitaId, score, status) {
  try {
    const res = await apiFetch("/attendance", {
      method: "PUT",
      body: JSON.stringify({ 
        studentId: parseInt(studentId), 
        recitaId: parseInt(recitaId), 
        score: score.toString(),
        status: status
      })
    });

    if (res.ok) {
      const student = window.currentPickedStudent;
      const isSkipped = status === 'skipped';
      const statusText = isSkipped ? 'skipped' : `called with score: ${score}`;
      showSuccessModal(`${student.name} ${statusText}`);
      
      // Reload the student list to show updated table
      await loadRecitaStudents(recitaId);
      
    } else {
      const error = await res.text();
      showInfoModal(`Failed to record score: ${error}`);
    }
  } catch (err) {
    console.error("Record score error:", err);
    showInfoModal("Failed to record score. Please try again.");
  }
}

async function loadRecitaStudents(recitaId) {
  try {
    const res = await apiFetch(`/attendance?recitaId=${recitaId}`);
    if (res.ok) {
      const data = await res.json();
      
      // Update topic display
      if (data.topic) {
        const topicDisplay = document.getElementById("currentTopic");
        if (topicDisplay) {
          topicDisplay.textContent = data.topic;
        }
        localStorage.setItem('currentTopic', data.topic);
      }
      
      // Update student table
      updateStudentTable(data.students);
      
      // Update status
      updateRecitaStatus(data.students);
      
      // Update export button state
      updateExportButton(data.students);
      
    } else {
      console.error("Failed to load recita students");
    }
  } catch (err) {
    console.error("Load recita students error:", err);
  }
}

function updateRecitaStatus(students) {
  const statusEl = document.getElementById("recitaStatus");
  if (!statusEl || !students) return;
  
  const totalStudents = students.length;
  const calledStudents = students.filter(s => s.status).length;
  const remainingCount = totalStudents - calledStudents;
  
  const currentTopic = localStorage.getItem('currentTopic') || 'Current Recitation';
  
  let statusHtml = `
    <div class="flex justify-between items-center">
      <div>
        <h3 class="text-lg font-semibold">${currentTopic}</h3>
        <p class="text-sm text-gray-600">
          Called: ${calledStudents}/${totalStudents} 
          ${remainingCount > 0 ? `(${remainingCount} remaining)` : '(Complete!)'}
        </p>
      </div>
  `;
  
  // Add export button if all students are called
  if (remainingCount === 0 && totalStudents > 0) {
    const recitaId = localStorage.getItem('currentRecitaId');
    statusHtml += `
      <div>
        <button onclick="exportRecitaCSV(${recitaId})" 
                class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm">
          Export CSV
        </button>
      </div>
    `;
  }
  
  statusHtml += `</div>`;
  statusEl.innerHTML = statusHtml;
}

function updateExportButton(students) {
  const exportBtn = document.getElementById("exportCurrentBtn");
  if (!exportBtn || !students) return;
  
  const totalStudents = students.length;
  const calledStudents = students.filter(s => s.status).length;
  const remainingCount = totalStudents - calledStudents;
  
  if (remainingCount > 0) {
    exportBtn.textContent = `Export (${remainingCount} left)`;
    exportBtn.disabled = true;
    exportBtn.className = "bg-gray-400 text-white px-4 py-2 rounded-md text-sm cursor-not-allowed";
  } else {
    exportBtn.textContent = "Export CSV";
    exportBtn.disabled = false;
    exportBtn.className = "bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm";
  }
}

async function loadRecitaHistory(classId) {
  try {
    const res = await apiFetch(`/recitas?classId=${classId}`);
    if (res.ok) {
      const recitas = await res.json();
      displayRecitaHistory(recitas, classId);
    } else {
      console.error("Failed to load recita history");
    }
  } catch (err) {
    console.error("Load recita history error:", err);
  }
}

function displayRecitaHistory(recitas, classId) {
  const historyEl = document.getElementById("recitaHistory");
  if (!historyEl) return;
  
  if (!recitas || recitas.length === 0) {
    historyEl.innerHTML = `
      <div class="bg-white rounded-lg shadow p-6 text-center">
        <p class="text-gray-500">No recitations yet for this class.</p>
        <div class="mt-4">
          <button onclick="exportClassCSV(${classId})" 
                  class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm">
            Export All (Empty)
          </button>
        </div>
      </div>
    `;
    return;
  }
  
  let historyHtml = `
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <div class="px-6 py-4 bg-gray-50 border-b">
        <div class="flex justify-between items-center">
          <h3 class="text-lg font-semibold text-gray-900">Recitation History</h3>
          <button onclick="exportClassCSV(${classId})" 
                  class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm">
            Export All Recitations
          </button>
        </div>
      </div>
      <div class="divide-y divide-gray-200">
  `;
  
  recitas.forEach(recita => {
    const date = new Date(recita.created_at).toLocaleDateString();
    const time = new Date(recita.created_at).toLocaleTimeString();
    const studentCount = recita.student_count || 0;
    
    // Calculate remaining students for export button state
    const totalStudents = recita.total_students || 0;
    const calledStudents = recita.student_count || 0;
    const remainingCount = totalStudents - calledStudents;
    
    historyHtml += `
      <div class="px-6 py-4">
        <div class="flex justify-between items-center">
          <div>
            <h4 class="text-lg font-medium text-gray-900">${recita.topic}</h4>
            <p class="text-sm text-gray-500">${date} at ${time}</p>
            <p class="text-sm text-gray-600">${studentCount} students called</p>
            ${remainingCount > 0 ? `<p class="text-sm text-orange-600">${remainingCount} students remaining</p>` : ''}
          </div>
          <div class="flex gap-2">
            <button onclick="exportRecitaCSV(${recita.id})" 
                    class="export-recita-btn ${remainingCount > 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white px-3 py-1 rounded text-sm" 
                    ${remainingCount > 0 ? 'disabled' : ''}>
              ${remainingCount > 0 ? `Export (${remainingCount} left)` : 'Export CSV'}
            </button>
            <button onclick="viewRecitaDetails(${recita.id})" 
                    class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
              View Details
            </button>
          </div>
        </div>
      </div>
    `;
  });
  
  historyHtml += `
      </div>
    </div>
  `;
  
  historyEl.innerHTML = historyHtml;
}

window.viewRecitaDetails = async function(recitaId) {
  try {
    const res = await apiFetch(`/attendance?recitaId=${recitaId}`);
    if (res.ok) {
      const data = await res.json();
      showRecitaDetailsModal(data);
    } else {
      showInfoModal("Failed to load recitation details.");
    }
  } catch (err) {
    console.error("View details error:", err);
    showInfoModal("Failed to load recitation details.");
  }
};

function showRecitaDetailsModal(data) {
  const students = data.students || [];
  const calledStudents = students.filter(s => s.status);
  const topic = data.topic || 'Unknown Topic';
  
  let studentsHtml = '';
  if (calledStudents.length > 0) {
    studentsHtml = `
      <div class="max-h-60 overflow-y-auto">
        <table class="min-w-full text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-3 py-2 text-left">Name</th>
              <th class="px-3 py-2 text-left">Score</th>
              <th class="px-3 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200">
            ${calledStudents.map(student => `
              <tr>
                <td class="px-3 py-2">${student.name}</td>
                <td class="px-3 py-2">${student.score || 'No score'}</td>
                <td class="px-3 py-2">${student.status || 'called'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    studentsHtml = '<p class="text-gray-500 text-center py-4">No students called in this recitation.</p>';
  }
  
  showModal(
    `${topic} - Details`,
    `
      <div class="text-left">
        <p class="mb-4"><strong>Topic:</strong> ${topic}</p>
        <p class="mb-4"><strong>Students Called:</strong> ${calledStudents.length}/${students.length}</p>
        ${studentsHtml}
      </div>
    `,
    [{
      text: "Close",
      class: "bg-blue-500 hover:bg-blue-700 text-white px-4 py-2 rounded-md",
      onclick: "closeModal()"
    }]
  );
}
