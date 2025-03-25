/**
 * projectOverviewAgent.js
 * Agent that generates a comprehensive project overview
 */
import { BaseAgent } from "./baseAgent.js";

export class ProjectOverviewAgent extends BaseAgent {
  constructor() {
    super("ProjectOverviewAgent");
    // Set a lower temperature for more consistent output
    this.temperature = 0.5;
  }

  /**
   * Process the engineered prompt to generate a project overview
   * @param {Object} promptContainer - Container with engineered prompt
   * @returns {Promise<Object>} - Generated project overview
   */
  async process(promptContainer) {
    try {
      this.log("Generating project overview");

      // Extract the project overview prompt
      const { overviewPrompt, projectId } = promptContainer;

      // Query the LLM with the engineered prompt
      const llmResponse = await this.queryLLM(overviewPrompt, {
        temperature: this.temperature,
        maxTokens: 6000, // Allow for a longer response
      });

      // Process the LLM response into structured data
      const structuredOverview = this.processLLMResponse(llmResponse);

      this.log("Project overview generated successfully");

      // Return the structured overview with additional metadata
      return {
        projectId,
        overview: structuredOverview,
        rawResponse: llmResponse,
        metadata: {
          generatedAt: new Date().toISOString(),
          generatorVersion: "1.0",
        },
      };
    } catch (error) {
      this.reportError(error, "generating project overview");
    }
  }

  /**
   * Process the LLM response into structured data
   * @param {string} llmResponse - Raw response from the LLM
   * @returns {Object} - Structured project overview
   */
  processLLMResponse(llmResponse) {
    try {
      // Try to parse the response as JSON first
      const jsonStart = llmResponse.indexOf("{");
      const jsonEnd = llmResponse.lastIndexOf("}");

      if (jsonStart !== -1 && jsonEnd !== -1) {
        const jsonString = llmResponse.substring(jsonStart, jsonEnd + 1);
        return JSON.parse(jsonString);
      }

      // If JSON parsing fails, fall back to extracting structured data manually
      this.log("JSON parsing failed, falling back to manual extraction");

      // Build a basic structure with what we can extract
      return {
        projectOverview: {
          summary: this.extractSection(llmResponse, "Project Overview"),
          approach: "Extracted from text response",
          keyConsiderations: [],
        },
        phases: this.extractPhases(llmResponse),
        sprints: this.extractSprints(llmResponse),
        tasks: this.extractTasks(llmResponse),
        risks: this.extractRisks(llmResponse),
        milestones: this.extractMilestones(llmResponse),
        rawText: llmResponse,
      };
    } catch (error) {
      this.log("Error processing LLM response", error);

      // Return a minimal structure with the raw text
      return {
        projectOverview: {
          summary: "Failed to extract structured data",
          approach: "Manual processing required",
          keyConsiderations: ["Error in automated processing"],
        },
        rawText: llmResponse,
      };
    }
  }

  /**
   * Extract a specific section from the LLM response
   * @param {string} text - Full LLM response
   * @param {string} sectionTitle - Title of the section to extract
   * @returns {string} - Extracted section content
   */
  extractSection(text, sectionTitle) {
    const regex = new RegExp(
      `## ${sectionTitle}\\s*([\\s\\S]*?)(?=## |$)`,
      "i"
    );
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  }

  /**
   * Extract phases from the LLM response
   * @param {string} text - Full LLM response
   * @returns {Array} - Array of phase objects
   */
  extractPhases(text) {
    const phasesText = this.extractSection(text, "Project Phases");
    const phases = [];

    // Simple regex-based extraction
    const phaseRegex = /(\d+)\.\s+([^:]+):?\s+([^(]+)(?:\(([^)]+)\))?/g;
    let match;

    while ((match = phaseRegex.exec(phasesText)) !== null) {
      const [, phaseNumber, phaseName, phaseDescription, timeline] = match;

      phases.push({
        phaseId: `phase-${phaseNumber}`,
        name: phaseName.trim(),
        description: phaseDescription.trim(),
        timeline: timeline ? timeline.trim() : "Not specified",
        deliverables: [],
      });
    }

    return phases;
  }

  /**
   * Extract sprints from the LLM response
   * @param {string} text - Full LLM response
   * @returns {Array} - Array of sprint objects
   */
  extractSprints(text) {
    const sprintText = this.extractSection(text, "Sprint Plan");
    const sprints = [];

    // Simple regex-based extraction
    const sprintRegex =
      /Sprint (\d+)[:\s]+([^:]+):?\s+([^(]+)(?:\(([^)]+)\))?/g;
    let match;

    while ((match = sprintRegex.exec(sprintText)) !== null) {
      const [, sprintNumber, sprintName, sprintGoals, timeline] = match;

      sprints.push({
        sprintId: `sprint-${sprintNumber}`,
        name: sprintName ? sprintName.trim() : `Sprint ${sprintNumber}`,
        goals: sprintGoals ? sprintGoals.split(",").map((g) => g.trim()) : [],
        timeline: timeline ? timeline.trim() : "Not specified",
      });
    }

    return sprints;
  }

  /**
   * Extract tasks from the LLM response
   * @param {string} text - Full LLM response
   * @returns {Array} - Array of task objects
   */
  extractTasks(text) {
    const backlogText = this.extractSection(text, "Product Backlog");
    const tasks = [];

    // Split the backlog text into lines and filter out empty lines
    const lines = backlogText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("["));

    for (const line of lines) {
      // Use regex to extract task information
      const taskMatch = line.match(
        /\d+\.\s+([^:]+):\s+(.+?)(?:\s*\(([^)]+)\))?$/
      );

      if (taskMatch) {
        const [, taskTitle, taskDescription, details] = taskMatch;

        // Parse details - typically contains assignee, priority, hours, sprint, dependencies
        const task = {
          taskId: `task-${tasks.length + 1}`,
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          assignedTo: "Not assigned",
          priority: "Medium",
          estimatedHours: 0,
          sprintId: "",
          dependencies: [],
        };

        if (details) {
          // Extract details if available
          const detailParts = details.split(",").map((d) => d.trim());

          for (const part of detailParts) {
            if (part.toLowerCase().includes("priority")) {
              task.priority = part.split(":")[1]?.trim() || "Medium";
            } else if (part.toLowerCase().includes("hours")) {
              const hours = parseInt(part.split(":")[1]?.trim() || "0", 10);
              task.estimatedHours = isNaN(hours) ? 0 : hours;
            } else if (part.toLowerCase().includes("sprint")) {
              task.sprintId = part.split(":")[1]?.trim() || "";
            } else if (part.toLowerCase().includes("assigned")) {
              task.assignedTo = part.split(":")[1]?.trim() || "Not assigned";
            }
          }
        }

        tasks.push(task);
      }
    }

    return tasks;
  }

  /**
   * Extract risks from the LLM response
   * @param {string} text - Full LLM response
   * @returns {Array} - Array of risk objects
   */
  extractRisks(text) {
    const risksText = this.extractSection(text, "Risk Management");
    const risks = [];

    // Simple regex-based extraction
    const riskRegex = /(\d+)\.\s+([^:]+):?\s+([^(]+)(?:\(([^)]+)\))?/g;
    let match;

    while ((match = riskRegex.exec(risksText)) !== null) {
      const [, riskNumber, riskType, riskDescription, mitigation] = match;

      risks.push({
        riskId: `risk-${riskNumber}`,
        type: riskType.trim(),
        description: riskDescription.trim(),
        mitigation: mitigation ? mitigation.trim() : "Not specified",
        impact: "Medium", // Default value
        probability: "Medium", // Default value
      });
    }

    return risks;
  }

  /**
   * Extract milestones from the LLM response
   * @param {string} text - Full LLM response
   * @returns {Array} - Array of milestone objects
   */
  extractMilestones(text) {
    const milestonesText = this.extractSection(
      text,
      "Milestones & Deliverables"
    );
    const milestones = [];

    // Simple regex-based extraction
    const milestoneRegex = /(\d+)\.\s+([^:]+):?\s+([^(]+)(?:\(([^)]+)\))?/g;
    let match;

    while ((match = milestoneRegex.exec(milestonesText)) !== null) {
      const [, milestoneNumber, milestoneName, milestoneDescription, timeline] =
        match;

      milestones.push({
        milestoneId: `ms-${milestoneNumber}`,
        name: milestoneName.trim(),
        description: milestoneDescription.trim(),
        date: timeline ? timeline.trim() : "Not specified",
        deliverables: [],
      });
    }

    return milestones;
  }
}
