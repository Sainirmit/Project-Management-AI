/**
 * outputManager.js
 * Handles the saving and management of project plan outputs
 */
import fs from "fs";
import path from "path";

export class OutputManager {
  constructor() {
    this.outputDir = path.resolve(process.cwd());
    this.outputFile = path.join(this.outputDir, "project-plans-output.json");
    this.ensureOutputFileExists();
  }

  /**
   * Ensure the output file exists with a valid JSON structure
   */
  ensureOutputFileExists() {
    try {
      if (!fs.existsSync(this.outputFile)) {
        fs.writeFileSync(
          this.outputFile,
          JSON.stringify(
            {
              runs: [],
            },
            null,
            2
          )
        );
      } else {
        // Validate JSON format
        try {
          const content = fs.readFileSync(this.outputFile, "utf8");
          JSON.parse(content);
        } catch (error) {
          // If not valid JSON, reset the file
          fs.writeFileSync(
            this.outputFile,
            JSON.stringify(
              {
                runs: [],
              },
              null,
              2
            )
          );
        }
      }
    } catch (error) {
      console.error("Error ensuring output file exists:", error);
    }
  }

  /**
   * Save a project plan to the combined output file
   * @param {Object} projectPlan - The project plan to save
   * @param {string} testName - Name of the test scenario
   * @param {string} projectName - Name of the project
   * @returns {boolean} - Success or failure
   */
  saveProjectPlan(projectPlan, testName, projectName) {
    try {
      // Read existing data
      let outputData = { runs: [] };

      try {
        const fileContent = fs.readFileSync(this.outputFile, "utf8");
        outputData = JSON.parse(fileContent);
      } catch (error) {
        // Reset if there's an error reading the file
        outputData = { runs: [] };
      }

      // Create a new run entry
      const runEntry = {
        runId: `run_${Date.now()}`,
        timestamp: new Date().toISOString(),
        testName,
        projectName,
        plan: projectPlan,
      };

      // Add the new run
      outputData.runs.push(runEntry);

      // Write back to the file
      fs.writeFileSync(this.outputFile, JSON.stringify(outputData, null, 2));

      console.log(
        `Project plan saved to combined output file with runId: ${runEntry.runId}`
      );
      return true;
    } catch (error) {
      console.error("Error saving project plan:", error);
      return false;
    }
  }

  /**
   * Clean up old individual output files
   */
  cleanupOldOutputFiles() {
    try {
      const files = fs.readdirSync(this.outputDir);

      // Find JSON files that match the pattern of individual plan outputs
      const planFiles = files.filter(
        (file) =>
          file.endsWith("-plan.json") ||
          file.includes("plan-output") ||
          (file.endsWith(".json") &&
            file !== "project-plans-output.json" &&
            file !== "package-lock.json" &&
            file !== "package.json")
      );

      // Delete each file
      planFiles.forEach((file) => {
        try {
          fs.unlinkSync(path.join(this.outputDir, file));
          console.log(`Deleted old output file: ${file}`);
        } catch (error) {
          console.error(`Error deleting file ${file}:`, error);
        }
      });

      return true;
    } catch (error) {
      console.error("Error cleaning up old output files:", error);
      return false;
    }
  }
}
