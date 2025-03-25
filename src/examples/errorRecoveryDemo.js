/**
 * errorRecoveryDemo.js
 * Demonstrates the error recovery capabilities of the project management system
 */
import {
  generateAgentBasedProjectPlan,
  resumeProjectPlanGeneration,
  checkProjectResumable,
  listSavedProjects,
} from "../ai/agentBasedProjectPlanGenerator.js";
import { ErrorRecoveryManager } from "../ai/errorRecoveryManager.js";

// Sample project data
const sampleProject = {
  projectName: "Recovery Demo Project",
  projectDescription: "A project to demonstrate error recovery features",
  projectTimeline: "2 months",
  projectType: "Web Application",
  priority: "Medium",
  techStack: ["React", "Node.js", "MongoDB"],
  teamMembers: [
    {
      id: "tm1",
      name: "Alex Johnson",
      role: "Project Manager",
      skills: ["Planning", "Risk Management", "Agile"],
      experience: "5 years",
      availability: 40,
    },
    {
      id: "tm2",
      name: "Taylor Smith",
      role: "Full Stack Developer",
      skills: ["JavaScript", "React", "Node.js", "MongoDB"],
      experience: "3 years",
      availability: 35,
    },
  ],
};

/**
 * Main demo function
 */
async function runErrorRecoveryDemo() {
  console.log("=== ERROR RECOVERY DEMONSTRATION ===");

  try {
    // 1. Initial project generation with automatic state saving
    console.log("\n1. Starting initial project generation...");
    console.log("This will automatically save state during processing...");

    const result = await generateAgentBasedProjectPlan(sampleProject, {
      // Additional options to simulate errors could be added here
    });

    if (result.success) {
      console.log(`Project generation completed successfully.`);
      console.log(`Project ID: ${result.projectId}`);
      console.log(
        `Processing metadata:`,
        JSON.stringify(result.processingMetadata, null, 2)
      );
    } else {
      console.log(`Project generation failed at stage: ${result.stageFailed}`);
      console.log(`Error: ${result.error}`);
      console.log(`Error ID for tracking: ${result.errorId}`);

      if (result.resumable) {
        console.log(
          "The failed project can be resumed from its last saved state."
        );
      }
    }

    // 2. List all saved project states
    console.log("\n2. Listing all saved project states...");
    const savedProjects = await listSavedProjects();

    if (savedProjects.success) {
      console.log(
        `Found ${
          Object.keys(savedProjects.projects).length
        } projects with saved states:`
      );

      Object.entries(savedProjects.projects).forEach(([projectId, states]) => {
        console.log(`\nProject ID: ${projectId}`);
        console.log(`Has ${states.length} saved states:`);

        states.slice(0, 3).forEach((state, i) => {
          console.log(
            `  ${i + 1}. Stage: ${state.stageName}, Timestamp: ${
              state.timestamp
            }`
          );
        });

        if (states.length > 3) {
          console.log(`  ... and ${states.length - 3} more states`);
        }
      });

      // Select the first project for demonstration
      const firstProjectId = Object.keys(savedProjects.projects)[0];

      if (firstProjectId) {
        // 3. Check if a project is resumable
        console.log("\n3. Checking if project is resumable...");
        const resumable = await checkProjectResumable(firstProjectId);

        console.log(
          `Project ${firstProjectId} resumable status: ${resumable.resumable}`
        );

        if (resumable.resumable) {
          console.log("Project state information:");
          console.log(`  Last stage: ${resumable.stateInfo.stageName}`);
          console.log(`  Saved at: ${resumable.stateInfo.timestamp}`);

          // 4. Resume a project from saved state
          console.log("\n4. Resuming project from saved state...");
          const resumeResult = await resumeProjectPlanGeneration(
            firstProjectId
          );

          if (resumeResult.success) {
            console.log("Project successfully resumed and completed!");
            console.log(
              `Resume count: ${resumeResult.processingMetadata.resumeCount}`
            );
          } else {
            console.log(`Failed to resume project: ${resumeResult.error}`);
          }
        }
      }
    } else {
      console.log(`Failed to list saved projects: ${savedProjects.error}`);
    }

    // 5. Demonstrate manual error handling and recovery
    console.log("\n5. Demonstrating manual error handling and recovery...");

    const errorRecovery = new ErrorRecoveryManager();

    try {
      // Simulate an operation that might fail
      await errorRecovery.retryManager.executeWithRetry(
        async () => {
          console.log("  Executing operation that might fail...");

          // Simulate a random failure 50% of the time
          if (Math.random() > 0.5) {
            const error = new Error("Simulated random failure");
            error.code = "SIMULATION_ERROR";
            throw error;
          }

          return "Operation completed successfully";
        },
        "demonstration",
        { maxRetries: 3 }
      );

      console.log("  Operation succeeded!");
    } catch (error) {
      console.log(`  Operation failed after retries: ${error.message}`);
      console.log(`  Retries attempted: ${error.retriesAttempted}`);

      // Log detailed error information
      errorRecovery.errorReporter.logError(error, "demo", {
        simulatedError: true,
      });
    }

    console.log("\nDemonstration completed!");
  } catch (error) {
    console.error("Error in demonstration:", error);
  }
}

// Run the demo
runErrorRecoveryDemo().catch(console.error);
