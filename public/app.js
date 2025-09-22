


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
      const names = studentInput.value.split("\n").map((n) => n.trim()).filter(Boolean);

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

    loadRecitaHistory(classId);
  }

  async function loadRecitaHistory(classId) {
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

  // -------------------
  // RECITA PAGE - ENHANCED VERSION WITH PROPER MODAL SEPARATION
  // -------------------
  const saveRecitaBtn = document.getElementById("saveRecitaBtn");
  const pickSection = document.getElementById("pickSection");

  console.log("saveRecitaBtn found:", !!saveRecitaBtn);
  console.log("pickSection found:", !!pickSection);

  if (saveRecitaBtn) {
    const classId = localStorage.getItem("classId");
    console.log("Class ID from localStorage:", classId);
    
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
        showRecitaInfoModal("Topic input not found!", "Error");
        return;
      }
      
      const topic = topicInput.value.trim();
      console.log("Saving recita with topic:", topic, "and classId:", classId);
      
      if (!topic) {
        showRecitaInfoModal("Please enter a topic for the recita");
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
          showRecitaInfoModal("Recita saved but ID not found. Please refresh and try again.", "Error");
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
        showRecitaInfoModal(`Recita "${topic}" saved successfully!`, "Success");
        
      } catch (err) {
        console.error("Save recita error:", err);
        showRecitaInfoModal("Failed to save recita: " + err.message, "Error");
      }
    });
  }

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
            <button id="editRecitaBtn" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm">Edit</button>
            <button id="exportCurrentRecitaBtn" class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-sm">Export CSV</button>
          </div>
        </div>
      `;
      
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

      const exportBtn = document.getElementById("exportCurrentRecitaBtn");
      if (exportBtn) {
        exportBtn.addEventListener("click", () => {
          window.location.href = `/export?recitaId=${recitaId}`;
        });
      }
    }
  }

  // Pick student event listener - ENHANCED FOR PROPER MODAL ISOLATION
  console.log("Setting up pick student event listener");
  
  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "pickStudentBtn") {
      e.preventDefault();
      console.log("Pick student button clicked!");
      
      const recitaId = localStorage.getItem("recitaId");
      console.log("Pick student clicked, recitaId from localStorage:", recitaId);
      
      if (!recitaId || recitaId === 'null' || recitaId === 'undefined') {
        console.error("No valid recita ID found");
        showRecitaInfoModal("No recita ID found. Please save a recita first.");
        return;
      }
      
      try {
        const requestUrl = `/attendance?action=pick&recitaId=${recitaId}`;
        console.log("Making request to:", requestUrl);
        const student = await apiFetch(requestUrl);
        console.log("Student picked:", student);
        
        if (!student) {
          // All students called - offer export using RECITA modal system
          const modal = document.createElement("div");
          modal.className = "modal recita-modal confirm-export-modal";
          modal.style.zIndex = "10000";
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
        
        // USE THE SEPARATE AUTHENTICATED MODAL FUNCTION
        showAuthenticatedStudentModal(student);
      } catch (err) {
        console.error("Pick student error:", err);
        showRecitaInfoModal("Failed to pick student: " + err.message, "Error");
      }
    }
  });

  // Record score function - ENHANCED
  async function recordScore(studentId, score, studentName, customScore = null) {
    const recitaId = localStorage.getItem("recitaId");
    
    if (!recitaId || !studentId) {
      showRecitaInfoModal("Missing recita or student ID", "Error");
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
      showRecitaInfoModal("Failed to record score: " + err.message, "Error");
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
    
    tableHTML += `</tbody></table>`;
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
      window.location.href = `/export?classId=${classId}`;
    });
  }
});

// --- Cache-busting logo system ---
(function() {
  // Generate cache-busting parameter once
  const cacheBuster = "v=" + Date.now();
  const logoUrl = "/logo.png?" + cacheBuster;
  
  // Insert favicon dynamically with cache busting
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = logoUrl;
  document.head.appendChild(link);
  
  // Store the cache-busted URL globally for use in other functions
  window.RECITA_LOGO_URL = logoUrl;
})();

// --- Style Recita with logo (cache-busted version) ---
function addRecitaLogos() {
  if (document.body.dataset.recitaLogosProcessed === 'true') {
    return;
  }

  // Use the cache-busted logo URL
  const logoUrl = window.RECITA_LOGO_URL || "/logo.png?" + Date.now();

  document.querySelectorAll("h1, h2, h3, h4, h5, h6, p, span, div, a, button").forEach(el => {
    if (el.dataset.recitaProcessed === 'true' || el.querySelector('img[alt="Recita Logo"]')) {
      return;
    }

    if (el.textContent.includes("Recita") && el.children.length === 0) {
      const fontSize = window.getComputedStyle(el).fontSize;
      
      el.innerHTML = el.textContent.replace(
        /Recita/g,
        `<img src="${logoUrl}" alt="Recita Logo" style="height:${fontSize}; width:auto; vertical-align:middle; margin-right:0.3em; display:inline-block;"><span style="color:#fe731f; font-weight:bold;">Recita</span>`
      );
      
      el.dataset.recitaProcessed = 'true';
    }
  });

  document.body.dataset.recitaLogosProcessed = 'true';
}

// Function to update all existing logo images with cache-busted version
function updateAllLogoImages() {
  const cacheBuster = "v=" + Date.now();
  const newLogoUrl = "/logo.png?" + cacheBuster;
  
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

// Call this function whenever you want to force refresh all logos
window.refreshAllLogos = updateAllLogoImages;

document.addEventListener("DOMContentLoaded", () => {
  addRecitaLogos();
  setTimeout(addRecitaLogos, 100);
  setTimeout(addRecitaLogos, 500);
  
  // Also call refresh function on page load to ensure latest logo
  setTimeout(updateAllLogoImages, 1000);
});
