/**
 * simple-server.js
 * A simplified web server just to serve static files
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Convert __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 9000;

// Serve static files
app.use(express.static(path.join(__dirname, "..", "public")));

// Serve index.html for all routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Simple server running at http://localhost:${PORT}`);
});
