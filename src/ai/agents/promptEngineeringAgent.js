/**
 * promptEngineeringAgent.js
 * Specialized agent for crafting optimized prompts for the LLM
 */
import { BaseAgent } from "./baseAgent.js";

export class PromptEngineeringAgent extends BaseAgent {
  constructor() {
    super("PromptEngineeringAgent");
  }

  /**
   * Generate an optimized prompt based on project data
   * @param {Object} projectData - Validated project data
   * @returns {Promise<Object>} - Engineered prompt container
   */
  async process(projectData) {
    try {
      this.log("Generating optimized prompts for LLM");

      // Create the main prompt for project overview
      const overviewPrompt = this.createProjectOverviewPrompt(projectData);

      this.log("Prompt engineering completed successfully");

      // Return container with all prompts
      return {
        projectId: projectData.projectId,
        overviewPrompt,
        metadata: {
          engineeredAt: new Date().toISOString(),
          promptType: "comprehensive",
          promptVersion: "2.0",
        },
      };
    } catch (error) {
      this.reportError(error, "engineering prompts");
    }
  }

  /**
   * Create a comprehensive project overview prompt
   * @param {Object} data - Project data
   * @returns {string} - Optimized prompt for the LLM
   */
  createProjectOverviewPrompt(data) {
    // Format team members section
    const teamSection = data.teamMembers
      .map(
        (member) => `
- ${member.name}
  - Roles: ${member.roles.join(", ")}
  - Experience: ${member.experience}
  - Skills: ${member.skills.join(", ") || "Not specified"}
  - Availability: ${member.availability.hoursPerWeek} hours/week, ${
          member.availability.allocationPercentage
        }% allocated to this project`
      )
      .join("");

    // Calculate total available man-hours for the project
    const totalManHours = this.calculateTotalManHours(data);

    // Format constraints
    const constraintsSection =
      data.constraints.length > 0
        ? `# CONSTRAINTS\n${data.constraints.map((c) => `- ${c}`).join("\n")}`
        : "";

    // Create the prompt
    return `
You are ProjectManagerGPT, an expert AI project manager with 15+ years of experience managing software development projects.

# PROJECT DETAILS
- Project Name: ${data.projectName}
- Project ID: ${data.projectId}
- Project Type: ${data.projectType}
- Project Timeline: ${data.projectTimeline}
- Project Priority: ${data.priority}
- Tech Stack: ${data.techStack.join(", ")}

# TEAM COMPOSITION
Total Team Size: ${data.teamSize}
Total Available Man-Hours: ${totalManHours} hours
${teamSection}

# PROJECT DESCRIPTION
${data.projectDescription}

${constraintsSection}

# TASK
Create a comprehensive project plan for the team with the following:

1. Break down the project into logical phases based on the project timeline of ${
      data.projectTimeline
    }
2. Create weekly sprints with specific goals that fit within the total project timeline
3. Create a detailed product backlog with tasks and user stories
4. Ensure all tasks can be completed within the ${totalManHours} total available man-hours
5. Assign tasks to team members based on their roles, skills, and availability
6. Create detailed descriptions for each task, including implementation guidance
7. Assign priorities (Critical, High, Medium, Low) to each task
8. Estimate time for each task in hours
9. Assign tasks to specific sprints
10. Identify potential risks and mitigation strategies
11. Set up clear milestones and deliverables with deadlines
12. Include testing and review processes

Your response should be detailed, practical, and structured in a way that can be directly implemented. Format the output as JSON with the following structure:

{
  "projectOverview": {
    "summary": "Brief project summary",
    "approach": "Overall approach to the project",
    "keyConsiderations": ["Consideration 1", "Consideration 2"]
  },
  "phases": [
    {
      "phaseId": "phase-1",
      "name": "Phase name",
      "description": "Phase description",
      "startDate": "ISO date",
      "endDate": "ISO date",
      "deliverables": ["Deliverable 1", "Deliverable 2"]
    }
  ],
  "sprints": [
    {
      "sprintId": "sprint-1",
      "name": "Sprint name",
      "goals": ["Goal 1", "Goal 2"],
      "startDate": "ISO date",
      "endDate": "ISO date",
      "phaseId": "phase-1"
    }
  ],
  "tasks": [
    {
      "taskId": "task-1",
      "title": "Task title",
      "description": "Task description",
      "implementationGuidance": "How to implement this task",
      "assignedTo": "team-member-id",
      "priority": "High/Medium/Low",
      "estimatedHours": 8,
      "sprintId": "sprint-1",
      "dependencies": ["task-2"],
      "status": "Not Started"
    }
  ],
  "risks": [
    {
      "riskId": "risk-1",
      "description": "Risk description",
      "impact": "High/Medium/Low",
      "probability": "High/Medium/Low",
      "mitigation": "Mitigation strategy"
    }
  ],
  "milestones": [
    {
      "milestoneId": "ms-1",
      "name": "Milestone name",
      "description": "Milestone description",
      "date": "ISO date",
      "deliverables": ["Deliverable 1"]
    }
  ]
}

Remember to consider the technical stack and assign tasks that align with each team member's expertise. Ensure that the backlog items are specific, measurable, and actionable.
`;
  }

  /**
   * Calculate total available man-hours for the project
   * @param {Object} data - Project data
   * @returns {number} - Total available man-hours
   */
  calculateTotalManHours(data) {
    // Extract the number of weeks from the project timeline
    const timelineMatches = data.projectTimeline.match(
      /(\d+)\s*(day|week|month|year)s?/i
    );

    if (!timelineMatches) {
      return 0; // Cannot calculate without proper timeline format
    }

    const amount = parseInt(timelineMatches[1], 10);
    const unit = timelineMatches[2].toLowerCase();

    // Convert to weeks
    let weeks = 0;
    switch (unit) {
      case "day":
        weeks = amount / 7;
        break;
      case "week":
        weeks = amount;
        break;
      case "month":
        weeks = amount * 4.33; // Average weeks per month
        break;
      case "year":
        weeks = amount * 52;
        break;
      default:
        weeks = 0;
    }

    // Calculate total man-hours
    let totalHours = 0;

    for (const member of data.teamMembers) {
      const weeklyHours =
        member.availability.hoursPerWeek *
        (member.availability.allocationPercentage / 100);
      totalHours += weeklyHours * weeks;
    }

    return Math.round(totalHours);
  }
}
