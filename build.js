import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "Frontend");
const dest = path.join(__dirname, "public");

if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

fs.cpSync(src, dest, { recursive: true });
console.log("Successfully built and synced Frontend/ assets into public/ directory for Vercel CDN.");
