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

/* =========================
DATABASE INITIALIZATION
========================= */

db.exec(`
CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
password TEXT,
role TEXT,
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
content TEXT,
vocabulary TEXT
);

CREATE TABLE IF NOT EXISTS exercises (
id INTEGER PRIMARY KEY AUTOINCREMENT,
lesson_id INTEGER,
title TEXT,
content TEXT,
type TEXT,
audio_url TEXT
);

CREATE TABLE IF NOT EXISTS submissions (
id INTEGER PRIMARY KEY AUTOINCREMENT,
exercise_id INTEGER,
student_id INTEGER,
answers TEXT,
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
status TEXT DEFAULT 'pending'
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

/* =========================
EXPRESS APP
========================= */

const app = express();
app.use(express.json());

/* =========================
FILE UPLOAD
========================= */

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

/* =========================
AUTH
========================= */

const authenticate = (req:any,res:any,next:any)=>{
const token=req.headers.authorization?.split(" ")[1];
if(!token) return res.status(401).json({error:"Unauthorized"});

try{
req.user=jwt.verify(token,JWT_SECRET);
next();
}catch{
res.status(401).json({error:"Invalid token"});
}
};

/* =========================
LOGIN
========================= */

app.post("/api/login",(req:any,res:any)=>{
const {email,password}=req.body;

const user=db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;

if(!user || !bcrypt.compareSync(password,user.password)){
return res.status(401).json({error:"Email hoặc mật khẩu không đúng"});
}

db.prepare("UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?").run(user.id);

const token=jwt.sign({
id:user.id,
email:user.email,
role:user.role,
name:user.name
},JWT_SECRET);

res.json({
token,
user:{
id:user.id,
email:user.email,
role:user.role,
name:user.name
}
});
});

/* =========================
HEALTH CHECK
========================= */

app.get("/api/health",(req,res)=>{
res.json({status:"ok"});
});

/* =========================
START SERVER (Railway Ready)
========================= */

async function startServer(){

app.use(express.static("public"));

if(process.env.NODE_ENV !== "production"){

const vite = await createViteServer({
server:{middlewareMode:true},
appType:"spa"
});

app.use(vite.middlewares);

app.use("*", async (req,res)=>{
const url=req.originalUrl;

try{

let template = fs.readFileSync(
path.resolve(__dirname,"index.html"),
"utf-8"
);

template = await vite.transformIndexHtml(url,template);

res.status(200).set({"Content-Type":"text/html"}).end(template);

}catch(e:any){
vite.ssrFixStacktrace(e);
res.status(500).end(e);
}

});

}else{

const distPath = path.resolve(__dirname,"dist");

if(!fs.existsSync(distPath)){
console.error("dist folder not found. Did you run vite build?");
}

app.use(express.static(distPath));

app.get("*",(req,res)=>{
const indexPath = path.join(distPath,"index.html");

if(fs.existsSync(indexPath)){
res.sendFile(indexPath);
}else{
res.status(500).send("index.html not found in dist folder");
}

});

}

// ✅ ĐÃ SỬA: Convert PORT sang number để tránh lỗi TypeScript
const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT,"0.0.0.0",()=>{
console.log("Server running on port "+PORT);
});

}

startServer();