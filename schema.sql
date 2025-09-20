-- Teachers
CREATE TABLE teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sections
CREATE TABLE sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER,
  name TEXT,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);

-- Students
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER,
  name TEXT,
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

-- Attendance / Recitation Records
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER,
  date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status TEXT,       -- "present", "absent", "skipped"
  points INTEGER,    -- NULL, 5, 10
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- random session token
  teacher_id INTEGER,
  expires_at TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id)
);
