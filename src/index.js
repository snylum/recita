export default {
  async fetch(request) {
    return new Response(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Speak Up – Random Picker</title>
        <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 min-h-screen flex items-center justify-center">
        <div class="bg-white shadow-xl rounded-2xl p-8 w-full max-w-lg">
          <h1 class="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            🎤 Speak Up
          </h1>
          <p class="text-gray-600 mb-6">Click below to randomly select a student for recitation.</p>
          
          <button 
            onclick="pickStudent()" 
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition"
          >
            Pick Student
          </button>

          <ul id="studentList" class="mt-6 divide-y divide-gray-200"></ul>
        </div>

        <script>
          // Example student list
          let students = [
            { name: "Alice", grade: "" },
            { name: "Bob", grade: "" },
            { name: "Charlie", grade: "" },
            { name: "Diana", grade: "" }
          ];

          const studentList = document.getElementById("studentList");

          function renderList() {
            studentList.innerHTML = "";
            students.forEach((s, i) => {
              const li = document.createElement("li");
              li.className = "flex justify-between items-center py-2 px-2 " + (s.picked ? "bg-blue-50" : "");
              li.innerHTML = \`
                <span class="font-medium text-gray-800">\${s.name}</span>
                <input 
                  type="number" 
                  min="0" max="10" 
                  value="\${s.grade}" 
                  onchange="setGrade(\${i}, this.value)"
                  class="w-16 border border-gray-300 rounded px-2 py-1 text-center"
                >
              \`;
              studentList.appendChild(li);
            });
          }

          function pickStudent() {
            const index = Math.floor(Math.random() * students.length);
            students.forEach(s => s.picked = false);
            students[index].picked = true;
            renderList();
          }

          function setGrade(i, val) {
            students[i].grade = val;
          }

          renderList();
        </script>
      </body>
      </html>
    `, {
      headers: { "content-type": "text/html" },
    });
  },
};
