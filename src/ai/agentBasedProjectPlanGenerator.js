/**
 * agentBasedProjectPlanGenerator.js
 * Main entry point for the agent-based project plan generation system
 */
import { AgentCoordinator } from "./agents/agentCoordinator.js";
import { ErrorRecoveryManager } from "./errorRecoveryManager.js";

/**
 * Main function to generate a comprehensive project plan using the agent-based system
 * @param {Object} projectData - Raw project data from the frontend
 * @param {Object} options - Options for plan generation
 * @returns {Promise<Object>} - Result containing the generated plan or error
 */
export async function generateAgentBasedProjectPlan(projectData, options = {}) {
  try {
    console.log("Starting agent-based project plan generation...");

    // Create an agent coordinator to manage the workflow
    const coordinator = new AgentCoordinator();

    // Process the project through the full agent pipeline
    const result = await coordinator.processProject(projectData, options);

    console.log("Agent-based project plan generation completed successfully");

    return result;
  } catch (error) {
    console.error("Error in agent-based project plan generation:", error);
    return {
      success: false,
      error: error.message || "Unknown error occurred",
      stage: error.stage || "unknown",
      errorId: error.errorId || null,
      resumable: true,
    };
  }
}

/**
 * Resume a project plan generation from previously saved state
 * @param {string} projectId - ID of the project to resume
 * @param {Object} options - Options for resuming
 * @returns {Promise<Object>} - Result containing the resumed project plan or error
 */
export async function resumeProjectPlanGeneration(projectId, options = {}) {
  try {
    console.log(`Resuming project plan generation for project ${projectId}...`);

    // Validate project ID
    if (!projectId) {
      throw new Error("Project ID is required to resume a project");
    }

    // Create a coordinator to resume the workflow
    const coordinator = new AgentCoordinator();

    // Attempt to resume the project
    const result = await coordinator.resumeProject(projectId, options);

    console.log(
      `Project ${projectId} plan generation resumed and completed successfully`
    );

    return result;
  } catch (error) {
    console.error(`Error resuming project ${projectId}:`, error);
    return {
      success: false,
      error: error.message || "Failed to resume project",
      projectId,
      stage: error.stage || "resume",
      errorId: error.errorId || null,
      resumable: false,
    };
  }
}

/**
 * Check if a project has a resumable saved state
 * @param {string} projectId - ID of the project to check
 * @returns {Promise<Object>} - Information about the resumable state
 */
export async function checkProjectResumable(projectId) {
  try {
    if (!projectId) {
      return { resumable: false, error: "Project ID is required" };
    }

    const errorRecovery = new ErrorRecoveryManager();
    const hasState = await errorRecovery.hasResumableState(projectId);

    if (hasState) {
      // Get information about the saved state
      const stateInfo = await errorRecovery.getSavedStateInfo(projectId);
      return {
        resumable: true,
        projectId,
        stateInfo: stateInfo[0] || {}, // Return most recent state info
      };
    }

    return { resumable: false, projectId };
  } catch (error) {
    console.error(
      `Error checking if project ${projectId} is resumable:`,
      error
    );
    return {
      resumable: false,
      error: error.message || "Error checking project state",
      projectId,
    };
  }
}

/**
 * List all saved project states
 * @returns {Promise<Object>} - List of projects with saved states
 */
export async function listSavedProjects() {
  try {
    const errorRecovery = new ErrorRecoveryManager();

    // Get metadata about all saved projects (use empty string to get all)
    const savedProjects = await errorRecovery.stateManager.listSavedStates("");

    // Group projects by ID
    const projects = {};
    for (const state of savedProjects) {
      if (!projects[state.id]) {
        projects[state.id] = [];
      }
      projects[state.id].push(state);
    }

    // Sort each project's states by timestamp (newest first)
    Object.keys(projects).forEach((id) => {
      projects[id].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    });

    return {
      success: true,
      projects,
    };
  } catch (error) {
    console.error("Error listing saved projects:", error);
    return {
      success: false,
      error: error.message || "Failed to list saved projects",
    };
  }
}
