import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import multer from "multer";
import fs from "fs";
import pdf from "pdf-parse-fork";
import mammoth from "mammoth";
import XLSX from "xlsx";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("english_hub.db");
const JWT_SECRET = "ctump-secret-key-2024";

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT, -- 'teacher', 'student'
    name TEXT,
    teacher_id INTEGER,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    teacher_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lesson_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    filename TEXT,
    original_name TEXT,
    content TEXT, -- Extracted text
    vocabulary TEXT -- JSON string of extracted vocab
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    title TEXT,
    content TEXT, -- JSON string of questions
    type TEXT, -- 'multiple_choice', 'writing', 'listening', 'pronunciation'
    audio_url TEXT
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exercise_id INTEGER,
    student_id INTEGER,
    answers TEXT, -- JSON string
    score REAL,
    feedback TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER,
    student_id INTEGER,
    assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed'
    FOREIGN KEY(lesson_id) REFERENCES lessons(id),
    FOREIGN KEY(student_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    lesson_id INTEGER,
    content TEXT,
    answer TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Migration Helper
const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string) => {
  try {
    const info = db.prepare(`PRAGMA table_info(${tableName})`).all() as any[];
    const exists = info.some(col => col.name === columnName);
    if (!exists) {
      db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
      console.log(`Migration: Added ${columnName} to ${tableName}`);
    }
  } catch (e) {
    console.error(`Migration check/apply failed for ${columnName} in ${tableName}:`, e);
  }
};

addColumnIfNotExists('assignments', 'due_date', 'DATETIME');
addColumnIfNotExists('exercises', 'audio_url', 'TEXT');

// Run Migrations
addColumnIfNotExists('users', 'last_login', 'DATETIME');
addColumnIfNotExists('users', 'teacher_id', 'INTEGER');
addColumnIfNotExists('users', 'created_at', 'DATETIME');
addColumnIfNotExists('lessons', 'created_at', 'DATETIME');
addColumnIfNotExists('questions', 'created_at', 'DATETIME');
addColumnIfNotExists('lesson_files', 'created_at', 'DATETIME');
addColumnIfNotExists('exercises', 'created_at', 'DATETIME');
addColumnIfNotExists('submissions', 'created_at', 'DATETIME');
addColumnIfNotExists('assignments', 'created_at', 'DATETIME');

// Seed Teachers
const seedTeachers = [
  { email: 'nthung@ctump.edu.vn', password: '123456A@', name: 'Nguyễn Thanh Hùng' },
  { email: 'nptai@ctump.edu.vn', password: '123456A@', name: 'Nguyễn Phước Tài' }
];

seedTeachers.forEach(t => {
  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(t.email);
  if (!exists) {
    const hash = bcrypt.hashSync(t.password, 10);
    db.prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, 'teacher', ?)").run(t.email, hash, t.name);
  }
});

const app = express();
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "uploads/";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
};

// Auth Routes
app.post("/api/login", (req: any, res: any) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Email hoặc mật khẩu không đúng" });
  }
  
  // Update last_login
  db.prepare("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?").run(user.id);

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.name } });
});

app.get("/api/recent-logins", (req, res) => {
  try {
    const recent = db.prepare(`
      SELECT name, last_login 
      FROM users 
      WHERE role = 'student' AND last_login IS NOT NULL 
      ORDER BY last_login DESC 
      LIMIT 5
    `).all();
    res.json(recent);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Teacher Routes
app.post("/api/lessons", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { title, description } = req.body;
  const result = db.prepare("INSERT INTO lessons (title, description, teacher_id) VALUES (?, ?, ?)").run(title, description, req.user.id);
  res.json({ id: result.lastInsertRowid });
});

app.get("/api/lessons", authenticate, (req: any, res: any) => {
  try {
    const lessons = db.prepare("SELECT * FROM lessons ORDER BY created_at DESC").all() as any[];
    
    // Enrich lessons with their files and perform filesystem sync
    const enrichedLessons = lessons.map(lesson => {
      const files = db.prepare("SELECT * FROM lesson_files WHERE lesson_id = ?").all(lesson.id) as any[];
      
      const validFiles = files.filter(file => {
        const filePath = path.join(process.cwd(), "uploads", file.filename);
        if (!fs.existsSync(filePath)) {
          console.log(`Sync: Removing missing file ${file.filename} from DB for lesson ${lesson.id}`);
          db.prepare("DELETE FROM lesson_files WHERE id = ?").run(file.id);
          return false;
        }
        return true;
      });
      
      return { ...lesson, files: validFiles };
    });
    
    res.json(enrichedLessons);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/lessons/:id", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  
  const lessonId = req.params.id;
  
  // Use a transaction for atomic deletion
  const deleteTx = db.transaction(() => {
    // 1. Get files to delete from disk later
    const files = db.prepare("SELECT filename FROM lesson_files WHERE lesson_id = ?").all(lessonId) as any[];

    // 2. Delete submissions linked to exercises of this lesson
    db.prepare(`
      DELETE FROM submissions 
      WHERE exercise_id IN (SELECT id FROM exercises WHERE lesson_id = ?)
    `).run(lessonId);

    // 3. Delete exercises
    db.prepare("DELETE FROM exercises WHERE lesson_id = ?").run(lessonId);
    
    // 4. Delete file records
    db.prepare("DELETE FROM lesson_files WHERE lesson_id = ?").run(lessonId);
    
    // 5. Delete questions
    db.prepare("DELETE FROM questions WHERE lesson_id = ?").run(lessonId);
    
    // 6. Delete the lesson itself
    const result = db.prepare("DELETE FROM lessons WHERE id = ?").run(lessonId);
    
    return { files, changes: result.changes };
  });

  try {
    const { files, changes } = deleteTx();
    
    // Delete physical files only after DB transaction succeeds
    files.forEach(f => {
      const filePath = path.join(process.cwd(), "uploads", f.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {
          console.error(`Failed to delete physical file ${filePath}:`, e);
        }
      }
    });
    
    res.json({ success: true, changes });
  } catch (error: any) {
    console.error("Delete lesson error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/lesson-files/:id", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  
  const fileId = req.params.id;
  try {
    const file = db.prepare("SELECT filename FROM lesson_files WHERE id = ?").get(fileId) as any;
    if (file) {
      const filePath = path.join(process.cwd(), "uploads", file.filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
      db.prepare("DELETE FROM lesson_files WHERE id = ?").run(fileId);
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/lessons/:id", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { title, description } = req.body;
  db.prepare("UPDATE lessons SET title = ?, description = ? WHERE id = ?").run(title, description, req.params.id);
  res.json({ success: true });
});

app.post("/api/upload-lesson-file", authenticate, upload.single("file"), async (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { lessonId } = req.body;
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });
  const filePath = file.path;
  let content = "";

  try {
    if (file.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      content = data.text;
    } else if (file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const data = await mammoth.extractRawText({ path: filePath });
      content = data.value;
    }

    db.prepare("INSERT INTO lesson_files (lesson_id, filename, original_name, content) VALUES (?, ?, ?, ?)")
      .run(lessonId, file.filename, file.originalname, content);

    const fileId = db.prepare("SELECT last_insert_rowid() as id").get() as any;

    res.json({ success: true, fileId: fileId.id, content: content.substring(0, 5000) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Lỗi xử lý file" });
  }
});

app.post("/api/upload-students", authenticate, upload.single("file"), (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  try {
    console.log("Processing student upload:", req.file.path);
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

    const insert = db.prepare("INSERT OR IGNORE INTO users (email, password, role, name, teacher_id) VALUES (?, ?, 'student', ?, ?)");
    const defaultPassword = bcrypt.hashSync("123456A@", 10);

    let count = 0;
    rawData.forEach(row => {
      // Normalize keys to lowercase and trim
      const normalizedRow: any = {};
      Object.keys(row).forEach(key => {
        normalizedRow[key.toLowerCase().trim()] = row[key];
      });

      const email = (normalizedRow.email || normalizedRow.mail || normalizedRow.account)?.toString().trim();
      let name = (normalizedRow.name || normalizedRow.fullname || normalizedRow.ten)?.toString().trim();
      
      if (email) {
        if (!name) name = email.split('@')[0];
        try {
          const result = insert.run(email, defaultPassword, name, req.user.id);
          if (result.changes > 0) count++;
        } catch (err) {
          console.error(`Error inserting student ${email}:`, err);
        }
      }
    });

    // Clean up uploaded file
    try { fs.unlinkSync(req.file.path); } catch (e) {}

    res.json({ success: true, count });
  } catch (e: any) {
    console.error("Excel processing error:", e);
    res.status(500).json({ error: "Lỗi xử lý file Excel: " + e.message });
  }
});

app.post("/api/students", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { email, name } = req.body;
  
  if (!email || !name) {
    return res.status(400).json({ error: "Email và tên là bắt buộc" });
  }

  try {
    const defaultPassword = bcrypt.hashSync("123456A@", 10);
    const result = db.prepare("INSERT INTO users (email, password, role, name, teacher_id) VALUES (?, ?, 'student', ?, ?)")
      .run(email, defaultPassword, name, req.user.id);
    
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e: any) {
    if (e.message.includes("UNIQUE constraint failed")) {
      return res.status(400).json({ error: "Email này đã tồn tại trên hệ thống" });
    }
    res.status(500).json({ error: e.message });
  }
});

app.put("/api/teacher/students/:id", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { name, email } = req.body;
  try {
    db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ? AND teacher_id = ?").run(name, email, req.params.id, req.user.id);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete("/api/teacher/students/:id", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  try {
    // Also delete submissions and assignments for this student
    db.transaction(() => {
      db.prepare("DELETE FROM submissions WHERE student_id = ?").run(req.params.id);
      db.prepare("DELETE FROM assignments WHERE student_id = ?").run(req.params.id);
      db.prepare("DELETE FROM questions WHERE student_id = ?").run(req.params.id);
      db.prepare("DELETE FROM users WHERE id = ? AND teacher_id = ?").run(req.params.id, req.user.id);
    })();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/lesson-files/:id/vocabulary", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { vocabulary } = req.body;
  db.prepare("UPDATE lesson_files SET vocabulary = ? WHERE id = ?").run(JSON.stringify(vocabulary), req.params.id);
  res.json({ success: true });
});

app.get("/api/lessons/:id/files", authenticate, (req: any, res: any) => {
  const lessonId = req.params.id;
  const files = db.prepare("SELECT * FROM lesson_files WHERE lesson_id = ?").all(lessonId) as any[];
  
  // Sync logic: Check if physical files exist. If not, remove from DB.
  const validFiles = files.filter(file => {
    const filePath = path.join(process.cwd(), "uploads", file.filename);
    if (!fs.existsSync(filePath)) {
      console.log(`File ${file.filename} missing from disk, removing from DB.`);
      db.prepare("DELETE FROM lesson_files WHERE id = ?").run(file.id);
      return false;
    }
    return true;
  });
  
  res.json(validFiles);
});

app.post("/api/exercises", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { lesson_id, title, content, type, audio_url } = req.body;
  db.prepare("INSERT INTO exercises (lesson_id, title, content, type, audio_url) VALUES (?, ?, ?, ?, ?)").run(lesson_id, title, JSON.stringify(content), type, audio_url);
  res.json({ success: true });
});

app.get("/api/lessons/:id/exercises", authenticate, (req: any, res: any) => {
  const exercises = db.prepare("SELECT * FROM exercises WHERE lesson_id = ?").all(req.params.id);
  res.json(exercises.map((e: any) => ({ ...e, content: JSON.parse(e.content) })));
});

app.post("/api/submissions", authenticate, (req: any, res: any) => {
  const { exercise_id, answers, score, feedback } = req.body;
  db.prepare("INSERT INTO submissions (exercise_id, student_id, answers, score, feedback) VALUES (?, ?, ?, ?, ?)")
    .run(exercise_id, req.user.id, JSON.stringify(answers), score, feedback);
  res.json({ success: true });
});

app.get("/api/teacher/submissions", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const subs = db.prepare(`
    SELECT s.*, u.name as student_name, e.title as exercise_title, l.title as lesson_title
    FROM submissions s
    JOIN users u ON s.student_id = u.id
    JOIN exercises e ON s.exercise_id = e.id
    JOIN lessons l ON e.lesson_id = l.id
    ORDER BY s.submitted_at DESC
  `).all();
  res.json(subs);
});

app.get("/api/student/submissions", authenticate, (req: any, res: any) => {
  const subs = db.prepare(`
    SELECT s.*, e.title as exercise_title
    FROM submissions s
    JOIN exercises e ON s.exercise_id = e.id
    WHERE s.student_id = ?
    ORDER BY s.submitted_at DESC
  `).all(req.user.id);
  res.json(subs);
});

app.get("/api/teacher/students", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const students = db.prepare("SELECT id, name, email, created_at FROM users WHERE role = 'student' AND teacher_id = ?").all(req.user.id);
  
  const studentsWithProgress = students.map((s: any) => {
    const subs = db.prepare(`
      SELECT s.*, e.title as exercise_title 
      FROM submissions s 
      JOIN exercises e ON s.exercise_id = e.id 
      WHERE s.student_id = ?
    `).all(s.id);
    return { ...s, submissions: subs };
  });
  
  res.json(studentsWithProgress);
});

app.post("/api/assignments", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { lesson_id, student_ids, due_date } = req.body; // student_ids is an array
  
  const insert = db.prepare("INSERT INTO assignments (lesson_id, student_id, due_date) VALUES (?, ?, ?)");
  const transaction = db.transaction((ids) => {
    for (const id of ids) insert.run(lesson_id, id, due_date);
  });
  
  transaction(student_ids);
  res.json({ success: true });
});

app.get("/api/student/assignments", authenticate, (req: any, res: any) => {
  const assignments = db.prepare(`
    SELECT a.*, l.title as lesson_title, l.description as lesson_description
    FROM assignments a
    JOIN lessons l ON a.lesson_id = l.id
    WHERE a.student_id = ?
  `).all(req.user.id);
  res.json(assignments);
});

app.get("/api/teacher/assignments", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const assignments = db.prepare(`
    SELECT a.*, l.title as lesson_title, s.name as student_name, s.email as student_email
    FROM assignments a
    JOIN lessons l ON a.lesson_id = l.id
    JOIN users s ON a.student_id = s.id
  `).all();
  res.json(assignments);
});

// Questions
app.post("/api/questions", authenticate, (req: any, res: any) => {
  const { lesson_id, content } = req.body;
  db.prepare("INSERT INTO questions (student_id, lesson_id, content) VALUES (?, ?, ?)").run(req.user.id, lesson_id, content);
  res.json({ success: true });
});

app.get("/api/questions/:lessonId", authenticate, (req: any, res: any) => {
  const questions = db.prepare(`
    SELECT q.*, u.name as student_name
    FROM questions q
    JOIN users u ON q.student_id = u.id
    WHERE q.lesson_id = ?
    ORDER BY q.created_at DESC
  `).all(req.params.lessonId);
  res.json(questions);
});

app.post("/api/questions/:id/answer", authenticate, (req: any, res: any) => {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: "Forbidden" });
  const { answer } = req.body;
  db.prepare("UPDATE questions SET answer = ? WHERE id = ?").run(answer, req.params.id);
  res.json({ success: true });
});

async function startServer() {
  app.use(express.static("public"));
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
