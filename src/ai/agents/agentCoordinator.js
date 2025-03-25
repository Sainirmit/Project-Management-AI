/**
 * agentCoordinator.js
 * Coordinates the flow between multiple specialized AI agents
 */
import { ProjectInitAgent } from "./projectInitAgent.js";
import { PromptEngineeringAgent } from "./promptEngineeringAgent.js";
import { ProjectOverviewAgent } from "./projectOverviewAgent.js";
import { SprintPlanningAgent } from "./sprintPlanningAgent.js";
import { ResourceAnalysisAgent } from "./resourceAnalysisAgent.js";
import { TaskGeneratorAgent } from "./taskGeneratorAgent.js";
import { SubtaskGeneratorAgent } from "./subtaskGeneratorAgent.js";
import { PriorityAssignmentAgent } from "./priorityAssignmentAgent.js";
import { WorkerAssignmentAgent } from "./workerAssignmentAgent.js";
import { DataCompilationAgent } from "./dataCompilationAgent.js";
import { VerificationAgent } from "./verificationAgent.js";
import { ErrorRecoveryManager } from "../errorRecoveryManager.js";
import crypto from "crypto";

/**
 * Main coordinator that manages the flow between specialized agents
 */
export class AgentCoordinator {
  constructor() {
    // Initialize all agents
    this.projectInitAgent = new ProjectInitAgent();
    this.promptEngineeringAgent = new PromptEngineeringAgent();
    this.projectOverviewAgent = new ProjectOverviewAgent();
    this.sprintPlanningAgent = new SprintPlanningAgent();
    this.resourceAnalysisAgent = new ResourceAnalysisAgent();
    this.taskGeneratorAgent = new TaskGeneratorAgent();
    this.subtaskGeneratorAgent = new SubtaskGeneratorAgent();
    this.priorityAssignmentAgent = new PriorityAssignmentAgent();
    this.workerAssignmentAgent = new WorkerAssignmentAgent();
    this.dataCompilationAgent = new DataCompilationAgent();
    this.verificationAgent = new VerificationAgent();

    // Initialize error recovery manager
    this.errorRecovery = new ErrorRecoveryManager();

    // Define the workflow stages
    this.workflowStages = [
      {
        name: "projectInit",
        agent: this.projectInitAgent,
        stateKey: "projectDetails",
      },
      {
        name: "promptEngineering",
        agent: this.promptEngineeringAgent,
        stateKey: "engineeredPrompt",
      },
      {
        name: "projectOverview",
        agent: this.projectOverviewAgent,
        stateKey: "projectOverview",
      },
      {
        name: "sprintPlanning",
        agent: this.sprintPlanningAgent,
        stateKey: "sprintPlan",
      },
      {
        name: "resourceAnalysis",
        agent: this.resourceAnalysisAgent,
        stateKey: "resourceAnalysis",
      },
      {
        name: "taskGeneration",
        agent: this.taskGeneratorAgent,
        stateKey: "tasks",
      },
      {
        name: "subtaskGeneration",
        agent: this.subtaskGeneratorAgent,
        stateKey: "subtasks",
      },
      {
        name: "priorityAssignment",
        agent: this.priorityAssignmentAgent,
        stateKey: "priorities",
      },
      {
        name: "workerAssignment",
        agent: this.workerAssignmentAgent,
        stateKey: "assignments",
      },
      {
        name: "dataCompilation",
        agent: this.dataCompilationAgent,
        stateKey: "compiledData",
      },
      {
        name: "verification",
        agent: this.verificationAgent,
        stateKey: "verificationResult",
      },
    ];

    // Store project state
    this.projectState = {
      projectDetails: null,
      teamMembers: [],
      engineeredPrompt: null,
      projectOverview: null,
      sprintPlan: null,
      resourceAnalysis: null,
      tasks: [],
      subtasks: [],
      priorities: {},
      assignments: {},
      compiledData: null,
      verificationResult: null,
      status: "not_started",
      errorLog: [],
      processingMetadata: {
        startTime: null,
        endTime: null,
        lastStageCompleted: null,
        stageTimings: {},
        resumeCount: 0,
      },
    };
  }

  /**
   * Main function to process a project through all agents
   * @param {Object} initialProjectData - Initial project data
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Final processed project plan
   */
  async processProject(initialProjectData, options = {}) {
    try {
      // Generate or extract project ID
      const projectId = this._generateProjectId(initialProjectData);
      this.log(
        `Starting multi-agent project processing workflow for ${projectId}...`
      );

      // Check for resumable state if needed
      if (options.checkResumable !== false) {
        const hasResumableState = await this.errorRecovery.hasResumableState(
          projectId
        );
        if (hasResumableState) {
          return await this.resumeProject(projectId, options);
        }
      }

      // Initialize metadata
      this.projectState.processingMetadata.startTime = new Date().toISOString();
      this.projectState.status = "processing";

      // Execute each stage of the workflow
      return await this._executeWorkflow(
        projectId,
        initialProjectData,
        options
      );
    } catch (error) {
      this.log(`Error in agent coordination process: ${error.message}`, error);

      // Record the error
      this.projectState.errorLog.push({
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
        stage: error.stage || "unknown",
        errorId: error.errorId || null,
      });

      // Update state
      this.projectState.status = "failed";
      this.projectState.processingMetadata.endTime = new Date().toISOString();

      return {
        success: false,
        error: error.message,
        errorId: error.errorId || null,
        stageFailed: error.stage || "unknown",
        currentState: this.projectState,
        resumable: true,
      };
    }
  }

  /**
   * Resume a project from previously saved state
   * @param {string} projectId - Project ID to resume
   * @param {Object} options - Processing options
   * @returns {Promise<Object>} - Final processed project plan
   */
  async resumeProject(projectId, options = {}) {
    try {
      this.log(`Attempting to resume project ${projectId} from saved state`);

      // Load latest state
      const savedState = await this.errorRecovery.resumeFromState(projectId);
      if (!savedState) {
        throw new Error(`No saved state found for project ${projectId}`);
      }

      // Restore state
      this.projectState = savedState;

      // Update resume count
      this.projectState.processingMetadata.resumeCount += 1;
      this.projectState.status = "resuming";

      this.log(
        `Successfully loaded state for project ${projectId}. Last completed stage: ${this.projectState.processingMetadata.lastStageCompleted}`
      );

      // Find index of last completed stage
      const lastCompletedStageIndex = this.workflowStages.findIndex(
        (stage) =>
          stage.name === this.projectState.processingMetadata.lastStageCompleted
      );

      // If no stages were completed or we can't find the last stage, start from beginning
      const startIndex =
        lastCompletedStageIndex >= 0 ? lastCompletedStageIndex + 1 : 0;

      // Execute remaining workflow steps
      return await this._executeWorkflow(projectId, null, options, startIndex);
    } catch (error) {
      this.log(`Error resuming project ${projectId}: ${error.message}`, error);
      return {
        success: false,
        error: error.message,
        errorId: error.errorId || null,
        context: "resume_project",
        resumable: false,
      };
    }
  }

  /**
   * Generate a unique project ID from project data
   * @param {Object} projectData - Project data
   * @returns {string} - Unique project ID
   */
  _generateProjectId(projectData) {
    // If the project already has an ID, use it
    if (projectData.id) {
      return projectData.id;
    }

    // Create a hash based on project name and current timestamp
    const projectName = projectData.projectName || "unknown_project";
    const timestamp = Date.now();
    const hash = crypto
      .createHash("md5")
      .update(`${projectName}_${timestamp}`)
      .digest("hex")
      .substr(0, 10);

    return `proj_${hash}`;
  }

  /**
   * Execute the workflow from a specified start index
   * @param {string} projectId - Project ID
   * @param {Object} initialData - Initial data if starting from beginning
   * @param {Object} options - Processing options
   * @param {number} startIndex - Index to start from in workflow
   * @returns {Promise<Object>} - Final processed project plan
   */
  async _executeWorkflow(projectId, initialData, options = {}, startIndex = 0) {
    // First stage special handling for initial data
    if (startIndex === 0 && initialData) {
      this.log("Step 1: Project initialization");
      this.projectState.projectDetails = await this._executeStageWithRecovery(
        this.projectInitAgent,
        "projectInit",
        [initialData],
        projectId
      );
      startIndex = 1; // Skip first stage in the loop
    }

    // Process remaining stages
    for (let i = startIndex; i < this.workflowStages.length; i++) {
      const stage = this.workflowStages[i];
      this.log(`Step ${i + 1}: ${this._stageTitleMap(stage.name)}`);

      // Prepare inputs for the current stage
      const inputs = this._prepareStageInputs(stage);

      // Execute the stage with recovery support
      const result = await this._executeStageWithRecovery(
        stage.agent,
        stage.name,
        inputs,
        projectId
      );

      // Store result in project state
      this.projectState[stage.stateKey] = result;

      // Update metadata
      this.projectState.processingMetadata.lastStageCompleted = stage.name;

      // Regularly save state
      await this.errorRecovery.stateManager.saveState(
        projectId,
        this.projectState,
        stage.name
      );

      // Handle special case for team members from project details
      if (stage.name === "projectInit" && result.teamMembers) {
        this.projectState.teamMembers = result.teamMembers;
      }
    }

    // Mark as completed
    this.projectState.status = "completed";
    this.projectState.processingMetadata.endTime = new Date().toISOString();

    // Final save of the completed state
    await this.errorRecovery.stateManager.saveState(
      projectId,
      this.projectState,
      "completed"
    );

    this.log("Multi-agent workflow completed successfully!");

    // Return final compiled and verified data
    return {
      success: true,
      plan: this.projectState.compiledData,
      verification: this.projectState.verificationResult,
      projectId,
      processingMetadata: this.projectState.processingMetadata,
    };
  }

  /**
   * Execute a single stage with error recovery
   * @param {Object} agent - Agent to execute
   * @param {string} stageName - Stage name
   * @param {Array} inputs - Inputs for the agent
   * @param {string} projectId - Project ID
   * @returns {Promise<any>} - Stage result
   */
  async _executeStageWithRecovery(agent, stageName, inputs, projectId) {
    const startTime = Date.now();

    try {
      // Execute with recovery
      const result = await agent.executeWithRecovery(
        async () => {
          // Call the agent's process method with the correct number of arguments
          return await agent.process(...inputs);
        },
        stageName,
        {
          projectId,
          state: this.projectState,
          context: stageName,
        }
      );

      // Record timing information
      const endTime = Date.now();
      this.projectState.processingMetadata.stageTimings[stageName] = {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        durationMs: endTime - startTime,
      };

      return result;
    } catch (error) {
      // Record timing for failed stage too
      const endTime = Date.now();
      this.projectState.processingMetadata.stageTimings[stageName] = {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        durationMs: endTime - startTime,
        failed: true,
      };

      // Add stage-specific information to the error
      error.stage = stageName;
      error.stageInputs = inputs.map((input) =>
        typeof input === "object"
          ? JSON.stringify(input).substring(0, 100) + "..."
          : input
      );

      throw error;
    }
  }

  /**
   * Prepare inputs for a stage based on the workflow definition
   * @param {Object} stage - Stage definition
   * @returns {Array} - Inputs for the stage
   */
  _prepareStageInputs(stage) {
    switch (stage.name) {
      case "promptEngineering":
        return [this.projectState.projectDetails];
      case "projectOverview":
        return [this.projectState.engineeredPrompt];
      case "sprintPlanning":
        return [this.projectState.projectOverview];
      case "resourceAnalysis":
        return [
          this.projectState.sprintPlan,
          this.projectState.projectDetails.teamMembers,
        ];
      case "taskGeneration":
        return [
          this.projectState.sprintPlan,
          this.projectState.resourceAnalysis,
        ];
      case "subtaskGeneration":
        return [this.projectState.tasks];
      case "priorityAssignment":
        return [this.projectState.tasks, this.projectState.subtasks];
      case "workerAssignment":
        return [
          this.projectState.tasks,
          this.projectState.subtasks,
          this.projectState.priorities,
          this.projectState.projectDetails.teamMembers,
        ];
      case "dataCompilation":
        return [this.projectState];
      case "verification":
        return [this.projectState.compiledData];
      default:
        return [];
    }
  }

  /**
   * Map stage names to human-readable titles
   * @param {string} stageName - Stage name
   * @returns {string} - Human-readable title
   */
  _stageTitleMap(stageName) {
    const map = {
      projectInit: "Project initialization",
      promptEngineering: "Engineering prompt for LLM",
      projectOverview: "Generating project overview",
      sprintPlanning: "Creating sprint plan",
      resourceAnalysis:
        "Analyzing resource availability and sprint feasibility",
      taskGeneration: "Generating detailed tasks",
      subtaskGeneration: "Generating subtasks",
      priorityAssignment: "Assigning priorities",
      workerAssignment: "Assigning workers to tasks and subtasks",
      dataCompilation: "Compiling all data into structured format",
      verification: "Verifying project plan for completeness and consistency",
    };

    return map[stageName] || stageName;
  }

  /**
   * Log coordinator activity
   * @param {string} message - Message to log
   * @param {Object} data - Optional data to log
   */
  log(message, data = null) {
    console.log(`[AgentCoordinator] ${message}`);

    // Also log to structured event log if available
    if (this.errorRecovery && this.errorRecovery.errorReporter) {
      this.errorRecovery.errorReporter.recordEvent("info", message, data);
    }
  }
}
