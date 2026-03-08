import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* API health check */

app.get("/api/health", (req, res) => {
res.json({ status: "ok" });
});

/* Serve frontend */

const distPath = path.join(process.cwd(), "dist");

app.use(express.static(distPath));

app.get("*", (req, res) => {
res.sendFile(path.join(distPath, "index.html"));
});

/* Railway PORT */

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
console.log("Server running on port", PORT);
});
