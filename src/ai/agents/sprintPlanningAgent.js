/**
 * sprintPlanningAgent.js
 * Agent responsible for breaking down the project into sprints
 */
import { BaseAgent } from "./baseAgent.js";

export class SprintPlanningAgent extends BaseAgent {
  constructor() {
    // Use a lower temperature for more consistent sprint planning
    super("SprintPlanningAgent");
    this.temperature = 0.5;
  }

  /**
   * Process the project overview and generate a sprint plan
   * @param {Object} projectOverview - Project overview data from ProjectOverviewAgent
   * @returns {Promise<Object>} - Structured sprint plan
   */
  async process(projectOverview) {
    try {
      this.log("Starting sprint planning process");
      this.log("Received project overview data", {
        title: projectOverview.title,
        phases: projectOverview.phases ? projectOverview.phases.length : 0,
      });

      // Generate a structured sprint plan based on the project overview
      const sprintPlan = await this.generateSprintPlan(projectOverview);

      this.log("Sprint planning completed successfully");
      return sprintPlan;
    } catch (error) {
      this.reportError(error, "sprint planning process");
    }
  }

  /**
   * Generate a comprehensive sprint plan with timeline, resources, and goals
   * @param {Object} projectOverview - Project overview data
   * @returns {Promise<Object>} - Structured sprint plan
   */
  async generateSprintPlan(projectOverview) {
    try {
      const prompt = this.createSprintPlanningPrompt(projectOverview);

      const response = await this.queryLLM(prompt, {
        temperature: this.temperature,
        maxTokens: 3000,
      });

      // Parse the LLM response into a structured sprint plan
      const sprintPlan = this.parseSprintPlan(response, projectOverview);

      return sprintPlan;
    } catch (error) {
      this.reportError(error, "generating sprint plan");
    }
  }

  /**
   * Create a prompt for the LLM to generate a sprint plan
   * @param {Object} projectOverview - Project overview data
   * @returns {string} - Formatted prompt for sprint planning
   */
  createSprintPlanningPrompt(projectOverview) {
    return `
You are an expert sprint planner for agile software development projects.

I need you to create a detailed sprint plan for the following project:

PROJECT TITLE: ${projectOverview.title || projectOverview.projectName}

PROJECT DESCRIPTION:
${projectOverview.description || projectOverview.projectDescription}

PROJECT DURATION: ${projectOverview.duration || projectOverview.projectTimeline}

PROJECT PHASES:
${this.formatPhases(projectOverview.phases)}

TEAM INFORMATION:
${this.formatTeamMembers(projectOverview.teamMembers)}

TECHNOLOGY STACK:
${this.formatTechStack(projectOverview.techStack)}

REQUIREMENTS:
1. Create a sprint plan that spans the entire project duration
2. Each sprint should be 2 weeks in length
3. Distribute tasks and objectives across sprints based on dependencies and logical workflow
4. Consider team capacity and skills when allocating work
5. Include clear sprint goals, start and end dates, and key deliverables for each sprint
6. Plan for a kickoff sprint and a final review/presentation sprint
7. Include buffer time for unexpected issues and refinements

Your response should be in JSON format with the following structure:
{
  "sprintPlan": {
    "totalSprints": number,
    "sprintDuration": "2 weeks",
    "sprints": [
      {
        "id": "Sprint 1",
        "name": "Sprint name/title",
        "goal": "Main objective for this sprint",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "keyDeliverables": ["Deliverable 1", "Deliverable 2"],
        "objectives": ["Objective 1", "Objective 2"],
        "mainPhases": ["Phase names this sprint contributes to"],
        "requiredResources": ["Resource 1", "Resource 2"],
        "estimatedVelocity": number,
        "risks": ["Risk 1", "Risk 2"]
      }
    ]
  }
}
`;
  }

  /**
   * Format project phases for the prompt
   * @param {Array} phases - Project phases
   * @returns {string} - Formatted phases text
   */
  formatPhases(phases) {
    if (!phases || !Array.isArray(phases) || phases.length === 0) {
      return "No specific phases provided. Please define appropriate phases.";
    }

    return phases
      .map((phase, index) => {
        const phaseName = phase.name || phase.title || `Phase ${index + 1}`;
        const phaseDescription = phase.description || "No description provided";
        return `Phase ${index + 1}: ${phaseName} - ${phaseDescription}`;
      })
      .join("\n");
  }

  /**
   * Format team members for the prompt
   * @param {Array} teamMembers - Team members information
   * @returns {string} - Formatted team members text
   */
  formatTeamMembers(teamMembers) {
    if (
      !teamMembers ||
      !Array.isArray(teamMembers) ||
      teamMembers.length === 0
    ) {
      return "No specific team members provided. Please define appropriate team allocations.";
    }

    return teamMembers
      .map((member) => {
        const roles = Array.isArray(member.roles)
          ? member.roles.join(", ")
          : member.roles;
        const skills = member.skills
          ? ` - Skills: ${
              Array.isArray(member.skills)
                ? member.skills.join(", ")
                : member.skills
            }`
          : "";
        return `- ${member.name}: ${roles} (${member.experience} experience)${skills}`;
      })
      .join("\n");
  }

  /**
   * Format tech stack for the prompt
   * @param {Array} techStack - Technology stack information
   * @returns {string} - Formatted tech stack text
   */
  formatTechStack(techStack) {
    if (!techStack || !Array.isArray(techStack) || techStack.length === 0) {
      return "No specific technology stack provided.";
    }

    return techStack.map((tech) => `- ${tech}`).join("\n");
  }

  /**
   * Parse the LLM response into a structured sprint plan
   * @param {string} response - LLM response text
   * @param {Object} projectOverview - Original project overview
   * @returns {Object} - Structured sprint plan
   */
  parseSprintPlan(response, projectOverview) {
    try {
      // Try to parse the response as JSON
      let jsonResponse;

      try {
        // Extract the JSON part if there's surrounding text
        const jsonMatch =
          response.match(/```json\s*([\s\S]*?)\s*```/) ||
          response.match(/```\s*([\s\S]*?)\s*```/) ||
          response.match(/({[\s\S]*})/);

        const jsonText = jsonMatch ? jsonMatch[1] : response;
        jsonResponse = JSON.parse(jsonText);
      } catch (jsonError) {
        // If JSON parsing fails, extract data using regex
        this.log(
          "Failed to parse JSON response, falling back to regex extraction"
        );
        return this.extractSprintPlanWithRegex(response, projectOverview);
      }

      // Check if we have the expected structure
      if (jsonResponse && jsonResponse.sprintPlan) {
        return {
          ...jsonResponse.sprintPlan,
          generatedAt: new Date().toISOString(),
          sourceProjectName:
            projectOverview.title || projectOverview.projectName,
        };
      } else {
        this.log(
          "JSON response doesn't have expected structure, falling back to regex extraction"
        );
        return this.extractSprintPlanWithRegex(response, projectOverview);
      }
    } catch (error) {
      this.log("Error parsing sprint plan: " + error.message);
      // Return a basic structured object with the raw response
      return {
        totalSprints: 0,
        sprintDuration: "2 weeks",
        sprints: [],
        rawResponse: response,
        generatedAt: new Date().toISOString(),
        sourceProjectName: projectOverview.title || projectOverview.projectName,
        error: "Failed to parse sprint plan",
      };
    }
  }

  /**
   * Extract sprint information using regex when JSON parsing fails
   * @param {string} text - Raw text response from LLM
   * @param {Object} projectOverview - Original project overview
   * @returns {Object} - Structured sprint plan
   */
  extractSprintPlanWithRegex(text, projectOverview) {
    const sprints = [];
    const sprintPattern =
      /Sprint (\d+)[\s\S]*?Goal:[\s\S]*?(.*?)(?:Start Date|Dates)/i;
    const datePattern =
      /(?:Start Date|Dates)[\s\S]*?([\w\d\s,-]+)(?:End Date|to|Deliverables)/i;
    const deliverablesPattern =
      /(?:Deliverables|Key Deliverables)[\s\S]*?([\s\S]*?)(?:Objectives|Risks|Sprint \d+|$)/i;

    let sprintMatch;
    let lastIndex = 0;
    const sprintBlockPattern = /Sprint (\d+)[\s\S]*?(?=Sprint \d+|$)/g;

    while ((sprintMatch = sprintBlockPattern.exec(text)) !== null) {
      const sprintBlock = sprintMatch[0];
      const sprintId = sprintMatch[1];

      // Extract goal
      const goalMatch = sprintBlock.match(
        /Goal:[\s\S]*?(.*?)(?:Start Date|Dates)/i
      );
      const goal = goalMatch
        ? goalMatch[1].trim()
        : `Sprint ${sprintId} execution`;

      // Extract dates
      const dateMatch = sprintBlock.match(datePattern);
      let startDate = "TBD";
      let endDate = "TBD";

      if (dateMatch) {
        const dateText = dateMatch[1].trim();
        if (dateText.includes("to")) {
          [startDate, endDate] = dateText.split("to").map((d) => d.trim());
        } else if (dateText.includes("-")) {
          [startDate, endDate] = dateText.split("-").map((d) => d.trim());
        } else if (dateText.includes(",")) {
          [startDate, endDate] = dateText.split(",").map((d) => d.trim());
        }
      }

      // Extract deliverables
      const deliverablesMatch = sprintBlock.match(deliverablesPattern);
      const deliverablesText = deliverablesMatch
        ? deliverablesMatch[1].trim()
        : "";
      const keyDeliverables = deliverablesText
        .split(/\n|•|-|[0-9]\.|[0-9]\)/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

      // Create sprint object
      sprints.push({
        id: `Sprint ${sprintId}`,
        name: `Sprint ${sprintId}`,
        goal,
        startDate,
        endDate,
        keyDeliverables,
        objectives: [],
        mainPhases: [],
        requiredResources: [],
        estimatedVelocity: 0,
        risks: [],
      });

      lastIndex = sprintBlockPattern.lastIndex;
    }

    return {
      totalSprints: sprints.length,
      sprintDuration: "2 weeks",
      sprints,
      generatedAt: new Date().toISOString(),
      sourceProjectName: projectOverview.title || projectOverview.projectName,
    };
  }
}
