/**
 * server.js
 * A simple web server to serve the generated project plans and provide a web interface
 */

import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateAgentBasedProjectPlan } from "./ai/agentBasedProjectPlanGenerator.js";

// Convert __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Serve available project plans
app.get("/api/plans", (req, res) => {
  try {
    const files = fs.readdirSync(path.join(__dirname, ".."));
    const planFiles = files.filter((file) => file.endsWith("-plan.json"));

    const plans = planFiles.map((file) => {
      try {
        const rawData = fs.readFileSync(path.join(__dirname, "..", file));
        const plan = JSON.parse(rawData);
        return {
          id: file.replace("-plan.json", ""),
          name: plan.projectName || file.replace("-plan.json", ""),
          file: file,
        };
      } catch (error) {
        console.error(`Error parsing file ${file}:`, error);
        return {
          id: file.replace("-plan.json", ""),
          name: file.replace("-plan.json", ""),
          file: file,
        };
      }
    });

    res.json(plans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch plans" });
  }
});

// Get a specific plan by filename
app.get("/api/plans/:filename", (req, res) => {
  try {
    const rawData = fs.readFileSync(
      path.join(__dirname, "..", req.params.filename)
    );
    const plan = JSON.parse(rawData);
    res.json(plan);
  } catch (error) {
    console.error("Error fetching plan:", error);
    res.status(500).json({ error: "Failed to fetch plan" });
  }
});

// Generate a new plan
app.post("/api/generate", async (req, res) => {
  try {
    const projectData = req.body;

    if (!projectData || !projectData.projectName) {
      return res.status(400).json({ error: "Invalid project data" });
    }

    const result = await generateAgentBasedProjectPlan(projectData);

    if (result.success) {
      const outputFile = `${projectData.projectName
        .toLowerCase()
        .replace(/\s+/g, "-")}-plan.json`;

      fs.writeFileSync(
        path.join(__dirname, "..", outputFile),
        JSON.stringify(result.plan, null, 2)
      );

      res.json({
        success: true,
        plan: result.plan,
        verification: result.verification,
        filename: outputFile,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
        stageFailed: result.stageFailed,
      });
    }
  } catch (error) {
    console.error("Error generating plan:", error);
    res.status(500).json({ error: "Failed to generate plan" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
