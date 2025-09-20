-- Drop old tables if reapplying
DROP TABLE IF EXISTS attendance;
DROP TABLE IF EXISTS recita_sessions;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS teachers;

-- Teachers (accounts)
CREATE TABLE teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Login sessions (cookies reference these)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY, -- UUID or random string
  teacher_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Classes (owned by teacher)
CREATE TABLE classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

-- Students (belong to a class)
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Recita sessions (topics within a class)
CREATE TABLE recita_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  topic TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

-- Attendance / Recitation scores
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recita_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  score INTEGER, -- null if absent/skip
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recita_id) REFERENCES recita_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);
