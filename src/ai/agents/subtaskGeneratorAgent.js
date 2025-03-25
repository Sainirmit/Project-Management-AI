/**
 * subtaskGeneratorAgent.js
 * Agent responsible for breaking down tasks into smaller subtasks
 */
import { BaseAgent } from "./baseAgent.js";

export class SubtaskGeneratorAgent extends BaseAgent {
  constructor() {
    super("SubtaskGeneratorAgent");
    this.temperature = 0.7; // Higher temperature for creative subtask breakdown
  }

  /**
   * Process tasks and generate subtasks
   * @param {Array} tasks - Array of tasks from TaskGeneratorAgent
   * @returns {Promise<Array>} - Array of subtasks
   */
  async process(tasks) {
    try {
      this.log("Starting subtask generation process");
      this.log(`Received ${tasks ? tasks.length : 0} tasks`);

      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        this.log("No tasks provided, returning empty subtasks array");
        return [];
      }

      // Filter out tasks that are too small to break down
      const tasksToBreakDown = tasks.filter(
        (task) => task.estimatedHours >= 8 && !task.isGlobal
      );

      this.log(
        `Found ${tasksToBreakDown.length} tasks to break down into subtasks`
      );

      // Generate subtasks for qualifying tasks
      const allSubtasks = [];

      for (const task of tasksToBreakDown) {
        this.log(`Generating subtasks for task: ${task.title}`);

        const taskSubtasks = await this.generateSubtasksForTask(task);

        if (taskSubtasks && taskSubtasks.length > 0) {
          // Add IDs and parent task references
          const subtasksWithIds = this.assignSubtaskIds(taskSubtasks, task.id);

          // Add to collection
          allSubtasks.push(...subtasksWithIds);
        }
      }

      this.log(
        `Subtask generation completed successfully. Generated ${allSubtasks.length} subtasks.`
      );
      return allSubtasks;
    } catch (error) {
      this.reportError(error, "subtask generation process");
    }
  }

  /**
   * Generate subtasks for a specific task
   * @param {Object} task - Task to break down
   * @returns {Promise<Array>} - Array of subtasks for this task
   */
  async generateSubtasksForTask(task) {
    try {
      const prompt = this.createSubtaskGenerationPrompt(task);

      const response = await this.queryLLM(prompt, {
        temperature: this.temperature,
        maxTokens: 2000,
      });

      // Parse the LLM response into structured subtasks
      const subtasks = this.parseSubtasksResponse(response, task.id);

      return subtasks;
    } catch (error) {
      this.log(
        `Error generating subtasks for task ${task.id}: ${error.message}`
      );
      return [];
    }
  }

  /**
   * Create a prompt for subtask generation
   * @param {Object} task - Task to break down
   * @returns {string} - Formatted prompt
   */
  createSubtaskGenerationPrompt(task) {
    return `
As a technical project manager, break down the following task into smaller subtasks:

TASK INFORMATION:
Title: ${task.title}
Description: ${task.description}
Category: ${task.category || "Not specified"}
Estimated Hours: ${task.estimatedHours}
Priority: ${task.priority || "Medium"}
Sprint: ${task.sprintName || "Not specified"}
Dependencies: ${task.dependencies ? task.dependencies.join(", ") : "None"}

ACCEPTANCE CRITERIA:
${
  task.acceptanceCriteria
    ? task.acceptanceCriteria.map((ac) => `- ${ac}`).join("\n")
    : "Not specified"
}

REQUIREMENTS:
1. Break down this task into 3-7 smaller subtasks that are clearly defined
2. Each subtask should be specific, measurable, and achievable in 1-4 hours
3. Make sure the subtasks collectively fulfill the parent task's acceptance criteria
4. Identify any dependencies between subtasks
5. Assign a category to each subtask (can be same or different from parent task)
6. Estimate hours for each subtask (the sum should be roughly equal to the parent task's hours)
7. Include acceptance criteria for each subtask

Please provide your response in JSON format:
{
  "subtasks": [
    {
      "title": "Subtask title",
      "description": "Detailed description",
      "category": "Frontend|Backend|Design|Testing|Documentation|DevOps|Other",
      "estimatedHours": number,
      "priority": "High|Medium|Low",
      "dependsOn": ["Other subtask titles or empty array if no dependencies"],
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
    }
  ]
}
`;
  }

  /**
   * Parse the subtasks response from the LLM
   * @param {string} response - LLM response
   * @param {string} parentTaskId - ID of the parent task
   * @returns {Array} - Structured subtasks
   */
  parseSubtasksResponse(response, parentTaskId) {
    try {
      // Try to extract and parse JSON from the response
      const jsonMatch =
        response.match(/```json\s*([\s\S]*?)\s*```/) ||
        response.match(/```\s*([\s\S]*?)\s*```/) ||
        response.match(/({[\s\S]*})/);

      const jsonText = jsonMatch ? jsonMatch[1] : response;
      const parsedResponse = JSON.parse(jsonText);

      // Check if we have the expected structure
      if (parsedResponse.subtasks && Array.isArray(parsedResponse.subtasks)) {
        return parsedResponse.subtasks.map((subtask) => ({
          ...subtask,
          parentTaskId,
          generatedAt: new Date().toISOString(),
        }));
      }

      throw new Error("Invalid response format");
    } catch (error) {
      this.log(
        `Error parsing subtasks response for task ${parentTaskId}: ${error.message}`
      );

      // Extract subtasks using regex as a fallback
      return this.extractSubtasksWithRegex(response, parentTaskId);
    }
  }

  /**
   * Extract subtasks using regex when JSON parsing fails
   * @param {string} text - Raw text response from LLM
   * @param {string} parentTaskId - ID of the parent task
   * @returns {Array} - Array of subtask objects
   */
  extractSubtasksWithRegex(text, parentTaskId) {
    const subtasks = [];
    const subtaskPattern =
      /(?:Subtask|Step)\s*(\d+):?\s*([^\n]+)(?:\n|$)(?:Description:?\s*([^\n]+))?/gi;

    let match;
    while ((match = subtaskPattern.exec(text)) !== null) {
      const subtaskTitle = match[2].trim();
      const subtaskDescription = match[3]
        ? match[3].trim()
        : "No description provided";

      // Find an estimated hours value
      const hoursMatch = text
        .slice(match.index)
        .match(/(?:estimated|hours|effort|duration)[^\d]*(\d+(?:\.\d+)?)/i);
      const estimatedHours = hoursMatch ? parseFloat(hoursMatch[1]) : 2; // Default to 2 hours

      // Find a category
      const categoryMatch = text
        .slice(match.index)
        .match(/(?:category|type)[^\w]*(\w+)/i);
      const category = categoryMatch ? categoryMatch[1] : "Other";

      subtasks.push({
        title: subtaskTitle,
        description: subtaskDescription,
        category,
        estimatedHours,
        priority: "Medium",
        dependsOn: [],
        acceptanceCriteria: ["Subtask completed successfully"],
        parentTaskId,
        generatedAt: new Date().toISOString(),
      });
    }

    return subtasks.length > 0
      ? subtasks
      : [
          {
            title: `Component of ${parentTaskId}`,
            description: "Placeholder subtask created due to parsing error",
            category: "Other",
            estimatedHours: 2,
            priority: "Medium",
            dependsOn: [],
            acceptanceCriteria: ["Subtask completed successfully"],
            parentTaskId,
            generatedAt: new Date().toISOString(),
            parsingError: true,
          },
        ];
  }

  /**
   * Assign IDs to subtasks
   * @param {Array} subtasks - Subtasks without IDs
   * @param {string} parentTaskId - ID of the parent task
   * @returns {Array} - Subtasks with assigned IDs
   */
  assignSubtaskIds(subtasks, parentTaskId) {
    return subtasks.map((subtask, index) => ({
      id: `${parentTaskId}.${index + 1}`,
      ...subtask,
    }));
  }
}
