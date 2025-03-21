/**
 * responseProcessor.js
 * Processes and structures the LLM response
 */

/**
 * Processes raw LLM response into structured format
 * @param {string} llmResponse - Raw response from the LLM
 * @returns {Object} - Structured project plan
 */
export function processLLMResponse(llmResponse) {
  // Split the response into sections
  const sections = {
    projectOverview: extractSection(llmResponse, "Project Overview"),
    projectPhases: extractSection(llmResponse, "Project Phases"),
    sprintPlan: extractSection(llmResponse, "Sprint Plan"),
    productBacklog: extractSection(llmResponse, "Product Backlog"),
    taskAssignments: extractSection(llmResponse, "Task Assignments"),
    milestones: extractSection(llmResponse, "Milestones & Deliverables"),
    riskManagement: extractSection(llmResponse, "Risk Management"),
  };

  // Parse sprint plan into structured format
  const structuredSprints = parseSprintPlan(sections.sprintPlan);

  // Parse product backlog
  const structuredBacklog = parseProductBacklog(sections.productBacklog);

  // Parse task assignments
  const structuredTasks = parseTaskAssignments(sections.taskAssignments);

  return {
    overview: sections.projectOverview,
    phases: sections.projectPhases,
    sprints: structuredSprints,
    backlog: structuredBacklog,
    tasks: structuredTasks,
    milestones: sections.milestones,
    risks: sections.riskManagement,
    rawResponse: llmResponse, // Keep the original response for reference
  };
}

/**
 * Extracts a specific section from the LLM response
 * @param {string} text - Full LLM response
 * @param {string} sectionTitle - Title of the section to extract
 * @returns {string} - Extracted section content
 */
function extractSection(text, sectionTitle) {
  const regex = new RegExp(`## ${sectionTitle}\\s*([\\s\\S]*?)(?=## |$)`, "i");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

function parseSprintPlan(sprintText) {
  // Implementation to parse sprint text into structured format
  // This is a simple implementation for the MVP
  // Could be enhanced to extract sprint numbers, dates, goals, etc.
  return sprintText;
}

/**
 * Parses the product backlog section into a more structured format
 * Extracts individual backlog items with their details
 * @param {string} backlogText - Raw backlog text from LLM
 * @returns {Object} - Structured backlog data
 */
function parseProductBacklog(backlogText) {
  // If the backlog is empty, return an empty array
  if (!backlogText || backlogText.trim() === "") {
    return {
      rawText: backlogText,
      tasks: [],
    };
  }

  // Split the backlog text into lines and filter out empty lines
  const lines = backlogText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("[") && !line.startsWith("..."));

  // Extract tasks
  const tasks = [];

  for (const line of lines) {
    // Use regex to extract task information
    // Format is typically: "1. T001 - Task Name (Assignee, Priority, Hours, Sprint, Dependencies)"
    const taskMatch = line.match(/\d+\.\s+(\w+)\s*-\s*(.+?)\s*\((.+?)\)/);

    if (taskMatch) {
      const [, taskId, taskTitle, detailsStr] = taskMatch;

      // Parse details - typically comma-separated values for assignee, priority, hours, sprint, dependencies
      const details = detailsStr.split(",").map((item) => item.trim());

      // Extract individual fields based on their position (may vary based on LLM output)
      const task = {
        id: taskId,
        title: taskTitle,
        assignedTo: details[0] || "",
        priority: details[1] || "",
        estimatedHours: details[2]
          ? parseInt(details[2], 10) || details[2]
          : "",
        sprint: details[3] || "",
        dependencies: details.length > 4 ? details.slice(4).join(", ") : "",
      };

      tasks.push(task);
    }
  }

  return {
    rawText: backlogText,
    tasks: tasks,
  };
}

function parseTaskAssignments(tasksText) {
  // Implementation to parse task assignments into structured format
  // This is a simple implementation for the MVP
  // Could be enhanced to extract specific tasks per team member
  return tasksText;
}
