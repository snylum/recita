-- Demo teacher (password = "test123" → fake hash here)
INSERT INTO teachers (name, email, password_hash) 
VALUES ('Demo Teacher', 'demo@example.com', 'hashed_test123');

-- Demo class
INSERT INTO classes (teacher_id, name) VALUES (1, 'Demo Class A');

-- Demo students
INSERT INTO students (class_id, name) VALUES 
  (1, 'Alice'),
  (1, 'Bob'),
  (1, 'Charlie');
