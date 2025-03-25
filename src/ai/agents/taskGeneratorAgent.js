/**
 * taskGeneratorAgent.js
 * Agent responsible for generating detailed tasks for the project
 */
import { BaseAgent } from "./baseAgent.js";

export class TaskGeneratorAgent extends BaseAgent {
  constructor() {
    super("TaskGeneratorAgent");
    this.temperature = 0.6; // Balanced between creativity and consistency
  }

  /**
   * Process the sprint plan and resource analysis to generate detailed tasks
   * @param {Object} sprintPlan - Sprint plan data from SprintPlanningAgent
   * @param {Object} resourceAnalysis - Resource analysis from ResourceAnalysisAgent
   * @returns {Promise<Array>} - Array of generated tasks
   */
  async process(sprintPlan, resourceAnalysis) {
    try {
      this.log("Starting task generation process");
      this.log("Received sprint plan with sprints", {
        totalSprints: sprintPlan.totalSprints,
        sprintCount: sprintPlan.sprints ? sprintPlan.sprints.length : 0,
      });

      // Generate tasks based on the sprint plan and resource analysis
      const tasks = await this.generateTasks(sprintPlan, resourceAnalysis);

      this.log(
        `Task generation completed successfully. Generated ${tasks.length} tasks.`
      );
      return tasks;
    } catch (error) {
      this.reportError(error, "task generation process");
    }
  }

  /**
   * Generate detailed tasks for each sprint
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Object} resourceAnalysis - Resource analysis data
   * @returns {Promise<Array>} - Array of tasks
   */
  async generateTasks(sprintPlan, resourceAnalysis) {
    try {
      let allTasks = [];

      // Generate tasks for each sprint
      for (const sprint of sprintPlan.sprints) {
        this.log(`Generating tasks for ${sprint.name}`);

        const sprintAnalysis = resourceAnalysis.sprintAnalysis.find(
          (analysis) => analysis.sprintId === sprint.id
        );

        const prompt = this.createTaskGenerationPrompt(
          sprint,
          sprintAnalysis,
          resourceAnalysis
        );

        const response = await this.queryLLM(prompt, {
          temperature: this.temperature,
          maxTokens: 3000,
        });

        // Parse the LLM response into structured tasks
        const sprintTasks = this.parseTasksResponse(response, sprint.id);

        // Add sprint information to each task
        const tasksWithSprintInfo = sprintTasks.map((task) => ({
          ...task,
          sprintId: sprint.id,
          sprintName: sprint.name,
          sprintStartDate: sprint.startDate,
          sprintEndDate: sprint.endDate,
        }));

        allTasks = [...allTasks, ...tasksWithSprintInfo];
      }

      // Generate global/cross-sprint tasks if needed
      if (sprintPlan.sprints.length > 1) {
        const globalTasks = await this.generateGlobalTasks(
          sprintPlan,
          resourceAnalysis,
          allTasks
        );
        allTasks = [...allTasks, ...globalTasks];
      }

      // Assign task IDs
      const tasksWithIds = this.assignTaskIds(allTasks);

      return tasksWithIds;
    } catch (error) {
      this.reportError(error, "generating tasks");
    }
  }

  /**
   * Create a prompt for task generation
   * @param {Object} sprint - Sprint information
   * @param {Object} sprintAnalysis - Analysis for this sprint
   * @param {Object} resourceAnalysis - Overall resource analysis
   * @returns {string} - Formatted prompt
   */
  createTaskGenerationPrompt(sprint, sprintAnalysis, resourceAnalysis) {
    // Format key deliverables
    const deliverables = sprint.keyDeliverables
      ? sprint.keyDeliverables.map((d) => `- ${d}`).join("\n")
      : "No specific deliverables defined.";

    // Format team capacity information
    const teamCapacity = resourceAnalysis.teamCapacity.memberCapacities
      .map(
        (member) =>
          `- ${member.name}: ${
            member.capacityPerSprint
          } hours available (${member.roles.join(", ")})`
      )
      .join("\n");

    // Format team members information
    const teamMembersInfo = resourceAnalysis.teamCapacity.memberCapacities
      .map(
        (member) =>
          `- ${member.name}: Role: ${member.roles.join(", ")}, Skills: ${
            member.skills ? member.skills.join(", ") : "Not specified"
          }`
      )
      .join("\n");

    return `
As a technical project manager, generate detailed tasks for the following sprint:

SPRINT INFORMATION:
Sprint: ${sprint.name}
Goal: ${sprint.goal}
Timeline: ${sprint.startDate} to ${sprint.endDate}

KEY DELIVERABLES:
${deliverables}

OBJECTIVES:
${
  sprint.objectives
    ? sprint.objectives.map((o) => `- ${o}`).join("\n")
    : "No specific objectives defined."
}

TEAM MEMBERS:
${teamMembersInfo}

TEAM CAPACITY:
${teamCapacity}

RESOURCE CONSTRAINTS:
${
  sprintAnalysis && sprintAnalysis.isOverallocated
    ? `This sprint is currently overallocated at ${sprintAnalysis.utilizationPercentage}% utilization.`
    : "This sprint has adequate resources."
}

REQUIREMENTS:
1. Create detailed tasks that will achieve the sprint goals and deliverables
2. Each task should be specific, measurable, and achievable
3. Include a mix of development, testing, and documentation tasks
4. Consider dependencies between tasks
5. Estimate hours for each task (most tasks should be between 2-16 hours)
6. Assign a category to each task (e.g. Frontend, Backend, Design, Testing)
7. Include acceptance criteria for each task
8. Suggest an appropriate team member name for each task based on their skills and role

Please provide your response in JSON format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "category": "Frontend|Backend|Design|Testing|Documentation|DevOps|Other",
      "estimatedHours": number,
      "priority": "High|Medium|Low",
      "assigneeRole": "Name of the best suited team member",
      "dependencies": ["Dependency 1", "Dependency 2"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
    }
  ]
}
`;
  }

  /**
   * Generate tasks that span multiple sprints or are project-wide
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Object} resourceAnalysis - Resource analysis data
   * @param {Array} existingTasks - Tasks already generated
   * @returns {Promise<Array>} - Global/cross-sprint tasks
   */
  async generateGlobalTasks(sprintPlan, resourceAnalysis, existingTasks) {
    try {
      this.log("Generating global/cross-sprint tasks");

      // Create a summary of existing tasks by category
      const taskSummary = this.summarizeExistingTasks(existingTasks);

      const prompt = this.createGlobalTasksPrompt(
        sprintPlan,
        resourceAnalysis,
        taskSummary
      );

      const response = await this.queryLLM(prompt, {
        temperature: this.temperature,
        maxTokens: 2000,
      });

      // Parse the response
      const globalTasks = this.parseTasksResponse(response, "global");

      // Tag tasks as global
      return globalTasks.map((task) => ({
        ...task,
        sprintId: "global",
        sprintName: "Cross-Sprint",
        isGlobal: true,
      }));
    } catch (error) {
      this.log("Error generating global tasks: " + error.message);
      return []; // Return empty array if there's an error
    }
  }

  /**
   * Create a summary of existing tasks
   * @param {Array} tasks - Existing tasks
   * @returns {Object} - Summary of tasks by category
   */
  summarizeExistingTasks(tasks) {
    const categoryCounts = {};
    const sprintCounts = {};

    // Count tasks by category and sprint
    tasks.forEach((task) => {
      // Count by category
      const category = task.category || "Uncategorized";
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;

      // Count by sprint
      const sprintId = task.sprintId || "Unassigned";
      sprintCounts[sprintId] = (sprintCounts[sprintId] || 0) + 1;
    });

    return {
      totalTasks: tasks.length,
      categoryCounts,
      sprintCounts,
    };
  }

  /**
   * Create a prompt for generating global/cross-sprint tasks
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Object} resourceAnalysis - Resource analysis data
   * @param {Object} taskSummary - Summary of existing tasks
   * @returns {string} - Formatted prompt
   */
  createGlobalTasksPrompt(sprintPlan, resourceAnalysis, taskSummary) {
    // Format task summary
    const categoryList = Object.entries(taskSummary.categoryCounts)
      .map(([category, count]) => `- ${category}: ${count} tasks`)
      .join("\n");

    const sprintList = Object.entries(taskSummary.sprintCounts)
      .map(([sprintId, count]) => `- ${sprintId}: ${count} tasks`)
      .join("\n");

    // Format team members information
    const teamMembersInfo = resourceAnalysis.teamCapacity.memberCapacities
      .map(
        (member) =>
          `- ${member.name}: Role: ${member.roles.join(", ")}, Skills: ${
            member.skills ? member.skills.join(", ") : "Not specified"
          }`
      )
      .join("\n");

    return `
As a technical project manager, identify cross-cutting or global tasks that span multiple sprints for this project.

PROJECT OVERVIEW:
Total Sprints: ${sprintPlan.totalSprints}
Duration: ${sprintPlan.sprintDuration} per sprint

TEAM MEMBERS:
${teamMembersInfo}

EXISTING TASKS SUMMARY:
Total tasks: ${taskSummary.totalTasks}

Tasks by category:
${categoryList}

Tasks by sprint:
${sprintList}

REQUIREMENTS:
1. Identify global tasks that are needed across multiple sprints
2. Include project management tasks like status reporting and backlog refinement
3. Consider DevOps, CI/CD, and infrastructure tasks
4. Include project-wide documentation and quality assurance tasks
5. Consider cross-sprint dependencies and integration tasks
6. Don't duplicate tasks that are already covered in individual sprints
7. Suggest an appropriate team member name for each task based on their skills and role

Please provide your response in JSON format:
{
  "tasks": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "category": "Project Management|DevOps|Documentation|QA|Other",
      "estimatedHours": number,
      "priority": "High|Medium|Low",
      "assigneeRole": "Name of the best suited team member",
      "affectedSprints": ["Sprint 1", "Sprint 2"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
    }
  ]
}
`;
  }

  /**
   * Parse the tasks response from the LLM
   * @param {string} response - LLM response
   * @param {string} sprintId - ID of the sprint these tasks belong to
   * @returns {Array} - Structured tasks
   */
  parseTasksResponse(response, sprintId) {
    try {
      // Try to extract and parse JSON from the response
      const jsonMatch =
        response.match(/```json\s*([\s\S]*?)\s*```/) ||
        response.match(/```\s*([\s\S]*?)\s*```/) ||
        response.match(/({[\s\S]*})/);

      const jsonText = jsonMatch ? jsonMatch[1] : response;
      const parsedResponse = JSON.parse(jsonText);

      if (parsedResponse.tasks && Array.isArray(parsedResponse.tasks)) {
        return parsedResponse.tasks.map((task) => ({
          ...task,
          generatedAt: new Date().toISOString(),
        }));
      }

      throw new Error("Invalid response format");
    } catch (error) {
      this.log(
        `Error parsing tasks response for sprint ${sprintId}: ${error.message}`
      );

      // Make a best effort to extract tasks using regex
      return this.extractTasksWithRegex(response, sprintId);
    }
  }

  /**
   * Extract tasks using regex when JSON parsing fails
   * @param {string} text - Raw text response from LLM
   * @param {string} sprintId - ID of the sprint these tasks belong to
   * @returns {Array} - Array of task objects
   */
  extractTasksWithRegex(text, sprintId) {
    const tasks = [];
    const taskBlockPattern =
      /Task\s*(\d+|title)?:?\s*([^\n]+)(?:\n|$)(?:Description:?\s*([^\n]+))?/gi;

    let match;
    while ((match = taskBlockPattern.exec(text)) !== null) {
      const taskTitle = match[2].trim();
      const taskDescription = match[3]
        ? match[3].trim()
        : "No description provided";

      // Find an estimated hours value
      const hoursMatch = text
        .slice(match.index)
        .match(/(?:estimated|hours|effort|duration)[^\d]*(\d+(?:\.\d+)?)/i);
      const estimatedHours = hoursMatch ? parseFloat(hoursMatch[1]) : 4; // Default to 4 hours

      // Find a category
      const categoryMatch = text
        .slice(match.index)
        .match(/(?:category|type)[^\w]*(\w+)/i);
      const category = categoryMatch ? categoryMatch[1] : "Other";

      // Find a priority
      const priorityMatch = text
        .slice(match.index)
        .match(/(?:priority)[^\w]*(High|Medium|Low)/i);
      const priority = priorityMatch ? priorityMatch[1] : "Medium";

      // Find a name for the assignee instead of a role
      const assigneeMatch = text
        .slice(match.index)
        .match(/(?:assignee|assigned to)[^\w]*([\w\s]+)/i);
      const assigneeRole = assigneeMatch ? assigneeMatch[1].trim() : ""; // Empty string instead of default

      tasks.push({
        title: taskTitle,
        description: taskDescription,
        category,
        estimatedHours,
        priority,
        assigneeRole, // Could be a name or empty string
        dependencies: [],
        acceptanceCriteria: ["Task completed successfully"],
        generatedAt: new Date().toISOString(),
      });
    }

    return tasks.length > 0
      ? tasks
      : [
          {
            title: `Tasks for ${sprintId}`,
            description: "Placeholder task created due to parsing error",
            category: "Other",
            estimatedHours: 8,
            priority: "Medium",
            assigneeRole: "", // Empty string instead of "Developer"
            dependencies: [],
            acceptanceCriteria: ["Task completed successfully"],
            generatedAt: new Date().toISOString(),
            parsingError: true,
            rawText: text,
          },
        ];
  }

  /**
   * Assign unique IDs to tasks
   * @param {Array} tasks - Tasks without IDs
   * @returns {Array} - Tasks with assigned IDs
   */
  assignTaskIds(tasks) {
    return tasks.map((task, index) => ({
      id: `T${index + 1}`,
      ...task,
    }));
  }
}
