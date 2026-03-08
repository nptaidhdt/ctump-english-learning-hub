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

const app = express();
app.use(express.json());

/* =========================
DATABASE
========================= */

const db = new Database("english_hub.db");
const JWT_SECRET = "ctump-secret-key-2024";

db.exec(`CREATE TABLE IF NOT EXISTS users (
id INTEGER PRIMARY KEY AUTOINCREMENT,
email TEXT UNIQUE,
password TEXT,
role TEXT,
name TEXT,
teacher_id INTEGER,
last_login DATETIME,
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);`);

/* =========================
FILE UPLOAD
========================= */

const storage = multer.diskStorage({
destination: (req, file, cb) => {
const dir = "uploads";
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
req.user = jwt.verify(token,JWT_SECRET);
next();
}catch{
return res.status(401).json({error:"Invalid token"});
}
};

/* =========================
LOGIN
========================= */

app.post("/api/login",(req:any,res:any)=>{

const {email,password} = req.body;

const user = db.prepare("SELECT * FROM users WHERE email=?").get(email) as any;

if(!user || !bcrypt.compareSync(password,user.password)){
return res.status(401).json({error:"Email hoặc mật khẩu không đúng"});
}

const token = jwt.sign({
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
START SERVER
========================= */

async function startServer(){

if(process.env.NODE_ENV !== "production"){

const vite = await createViteServer({
server:{middlewareMode:true},
appType:"spa"
});

app.use(vite.middlewares);

app.use("*", async (req,res)=>{

try{

let template = fs.readFileSync(
path.resolve(__dirname,"index.html"),
"utf-8"
);

template = await vite.transformIndexHtml(req.originalUrl,template);

res.status(200)
.set({"Content-Type":"text/html"})
.end(template);

}catch(e:any){

vite.ssrFixStacktrace(e);
res.status(500).end(e.message);

}

});

}else{

const distPath = path.join(process.cwd(),"dist");

app.use(express.static(distPath));

app.get("*",(req,res)=>{
res.sendFile(path.join(distPath,"index.html"));
});

}

/* =========================
PORT (Railway)
========================= */

const PORT = parseInt(process.env.PORT || "3000");

app.listen(PORT,"0.0.0.0",()=>{
console.log("🚀 Server running on port",PORT);
});

}

/* =========================
ERROR HANDLER
========================= */

process.on("uncaughtException",(err)=>{
console.error("Uncaught Exception:",err);
});

process.on("unhandledRejection",(err)=>{
console.error("Unhandled Rejection:",err);
});

startServer();