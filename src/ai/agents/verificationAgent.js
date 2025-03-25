/**
 * verificationAgent.js
 * Agent responsible for verifying the completeness and consistency of the project plan
 */
import { BaseAgent } from "./baseAgent.js";

export class VerificationAgent extends BaseAgent {
  constructor() {
    super("VerificationAgent");
    this.temperature = 0.1; // Very low temperature for consistent verification
  }

  /**
   * Process the compiled data and verify its completeness and consistency
   * @param {Object} compiledData - Compiled project data from DataCompilationAgent
   * @returns {Promise<Object>} - Verification results
   */
  async process(compiledData) {
    try {
      this.log("Starting project plan verification process");

      // Perform various checks on the compiled data
      const checks = {
        projectDetailsCheck: this.verifyProjectDetails(compiledData.project),
        sprintsCheck: this.verifySprints(compiledData.sprints),
        tasksCheck: this.verifyTasks(compiledData.tasks, compiledData.sprints),
        risksCheck: this.verifyRisks(compiledData.risks),
        resourceCheck: this.verifyResourceAllocation(
          compiledData.resourceAllocation,
          compiledData.tasks
        ),
      };

      // Additional holistic verification via LLM if necessary
      const holisticCheck = await this.performHolisticVerification(
        compiledData,
        checks
      );

      // Compile verification results
      const verificationResults = this.compileVerificationResults(
        checks,
        holisticCheck
      );

      this.log("Project plan verification completed");
      return verificationResults;
    } catch (error) {
      this.reportError(error, "project plan verification process");
    }
  }

  /**
   * Verify the project details
   * @param {Object} project - Project details
   * @returns {Object} - Verification results
   */
  verifyProjectDetails(project) {
    const issues = [];

    // Check for required fields
    const requiredFields = [
      "name",
      "description",
      "timeline",
      "teamMembers",
      "techStack",
    ];

    requiredFields.forEach((field) => {
      if (!project[field]) {
        issues.push({
          type: "missing_field",
          field,
          severity: "high",
          message: `Project ${field} is missing`,
        });
      }
    });

    // Check team members
    if (project.teamMembers && Array.isArray(project.teamMembers)) {
      if (project.teamMembers.length === 0) {
        issues.push({
          type: "empty_array",
          field: "teamMembers",
          severity: "high",
          message: "No team members specified",
        });
      } else {
        // Check each team member
        project.teamMembers.forEach((member, index) => {
          if (!member.name) {
            issues.push({
              type: "missing_field",
              field: `teamMembers[${index}].name`,
              severity: "medium",
              message: `Team member at index ${index} is missing a name`,
            });
          }

          if (
            !member.roles ||
            !Array.isArray(member.roles) ||
            member.roles.length === 0
          ) {
            issues.push({
              type: "missing_field",
              field: `teamMembers[${index}].roles`,
              severity: "medium",
              message: `Team member ${member.name || index} is missing roles`,
            });
          }
        });
      }
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendedFixes: this.generateFixRecommendations(issues),
    };
  }

  /**
   * Verify the sprints data
   * @param {Array} sprints - Sprint data
   * @returns {Object} - Verification results
   */
  verifySprints(sprints) {
    const issues = [];

    if (!sprints || !Array.isArray(sprints)) {
      issues.push({
        type: "missing_data",
        field: "sprints",
        severity: "critical",
        message: "Sprints data is missing or not an array",
      });

      return {
        passed: false,
        issues,
        recommendedFixes: this.generateFixRecommendations(issues),
      };
    }

    if (sprints.length === 0) {
      issues.push({
        type: "empty_array",
        field: "sprints",
        severity: "critical",
        message: "No sprints defined in the project plan",
      });

      return {
        passed: false,
        issues,
        recommendedFixes: this.generateFixRecommendations(issues),
      };
    }

    // Check each sprint for required fields
    const requiredSprintFields = ["id", "name", "goal", "startDate", "endDate"];

    sprints.forEach((sprint, index) => {
      requiredSprintFields.forEach((field) => {
        if (!sprint[field]) {
          issues.push({
            type: "missing_field",
            field: `sprints[${index}].${field}`,
            severity: "high",
            message: `Sprint ${sprint.id || index} is missing ${field}`,
          });
        }
      });

      // Check for timeline consistency
      if (sprint.startDate && sprint.endDate) {
        try {
          const startDate = new Date(sprint.startDate);
          const endDate = new Date(sprint.endDate);

          if (startDate > endDate) {
            issues.push({
              type: "invalid_data",
              field: `sprints[${index}].dates`,
              severity: "high",
              message: `Sprint ${sprint.id || index} has start date (${
                sprint.startDate
              }) after end date (${sprint.endDate})`,
            });
          }

          // Check for overlapping sprints
          sprints.forEach((otherSprint, otherIndex) => {
            if (
              index !== otherIndex &&
              otherSprint.startDate &&
              otherSprint.endDate
            ) {
              const otherStartDate = new Date(otherSprint.startDate);
              const otherEndDate = new Date(otherSprint.endDate);

              // Check if sprints overlap
              if (
                (startDate <= otherEndDate && endDate >= otherStartDate) ||
                (otherStartDate <= endDate && otherEndDate >= startDate)
              ) {
                issues.push({
                  type: "overlap",
                  field: `sprints[${index}].dates`,
                  severity: "medium",
                  message: `Sprint ${sprint.id || index} overlaps with sprint ${
                    otherSprint.id || otherIndex
                  }`,
                });
              }
            }
          });
        } catch (error) {
          issues.push({
            type: "invalid_data",
            field: `sprints[${index}].dates`,
            severity: "medium",
            message: `Sprint ${sprint.id || index} has invalid date format`,
          });
        }
      }

      // Check for key deliverables
      if (
        !sprint.keyDeliverables ||
        !Array.isArray(sprint.keyDeliverables) ||
        sprint.keyDeliverables.length === 0
      ) {
        issues.push({
          type: "missing_data",
          field: `sprints[${index}].keyDeliverables`,
          severity: "medium",
          message: `Sprint ${
            sprint.id || index
          } has no key deliverables defined`,
        });
      }
    });

    return {
      passed: issues.length === 0,
      issues,
      recommendedFixes: this.generateFixRecommendations(issues),
    };
  }

  /**
   * Verify the tasks data
   * @param {Array} tasks - Task data
   * @param {Array} sprints - Sprint data
   * @returns {Object} - Verification results
   */
  verifyTasks(tasks, sprints) {
    const issues = [];

    if (!tasks || !Array.isArray(tasks)) {
      issues.push({
        type: "missing_data",
        field: "tasks",
        severity: "critical",
        message: "Tasks data is missing or not an array",
      });

      return {
        passed: false,
        issues,
        recommendedFixes: this.generateFixRecommendations(issues),
      };
    }

    if (tasks.length === 0) {
      issues.push({
        type: "empty_array",
        field: "tasks",
        severity: "critical",
        message: "No tasks defined in the project plan",
      });

      return {
        passed: false,
        issues,
        recommendedFixes: this.generateFixRecommendations(issues),
      };
    }

    // Check each task for required fields
    const requiredTaskFields = [
      "id",
      "title",
      "description",
      "estimatedHours",
      "priority",
      "sprintId",
    ];

    tasks.forEach((task, index) => {
      requiredTaskFields.forEach((field) => {
        if (!task[field]) {
          issues.push({
            type: "missing_field",
            field: `tasks[${index}].${field}`,
            severity: "high",
            message: `Task ${task.id || index} is missing ${field}`,
          });
        }
      });

      // Check if the task's sprint exists
      if (task.sprintId && task.sprintId !== "global") {
        const sprintExists = sprints.some(
          (sprint) => sprint.id === task.sprintId
        );

        if (!sprintExists) {
          issues.push({
            type: "invalid_reference",
            field: `tasks[${index}].sprintId`,
            severity: "high",
            message: `Task ${task.id || index} references non-existent sprint ${
              task.sprintId
            }`,
          });
        }
      }

      // Check if estimated hours is a reasonable number
      if (typeof task.estimatedHours === "number") {
        if (task.estimatedHours <= 0) {
          issues.push({
            type: "invalid_data",
            field: `tasks[${index}].estimatedHours`,
            severity: "medium",
            message: `Task ${task.id || index} has invalid estimated hours (${
              task.estimatedHours
            })`,
          });
        } else if (task.estimatedHours > 80) {
          issues.push({
            type: "potential_issue",
            field: `tasks[${index}].estimatedHours`,
            severity: "low",
            message: `Task ${task.id || index} has high estimated hours (${
              task.estimatedHours
            }), consider breaking it down`,
          });
        }
      }

      // Check for valid priority
      const validPriorities = ["High", "Medium", "Low"];
      if (task.priority && !validPriorities.includes(task.priority)) {
        issues.push({
          type: "invalid_data",
          field: `tasks[${index}].priority`,
          severity: "low",
          message: `Task ${task.id || index} has invalid priority (${
            task.priority
          })`,
        });
      }
    });

    return {
      passed: issues.length === 0,
      issues,
      recommendedFixes: this.generateFixRecommendations(issues),
    };
  }

  /**
   * Verify the risks data
   * @param {Array} risks - Risk data
   * @returns {Object} - Verification results
   */
  verifyRisks(risks) {
    const issues = [];

    if (!risks || !Array.isArray(risks)) {
      issues.push({
        type: "missing_data",
        field: "risks",
        severity: "medium",
        message: "Risks data is missing or not an array",
      });

      return {
        passed: false,
        issues,
        recommendedFixes: this.generateFixRecommendations(issues),
      };
    }

    if (risks.length === 0) {
      issues.push({
        type: "empty_array",
        field: "risks",
        severity: "low",
        message: "No risks identified in the project plan",
      });
    }

    // Check each risk for required fields
    const requiredRiskFields = ["title", "description", "mitigation"];

    risks.forEach((risk, index) => {
      requiredRiskFields.forEach((field) => {
        if (!risk[field]) {
          issues.push({
            type: "missing_field",
            field: `risks[${index}].${field}`,
            severity: "medium",
            message: `Risk ${risk.title || index} is missing ${field}`,
          });
        }
      });

      // Check if mitigation strategy is meaningful
      if (
        risk.mitigation &&
        (risk.mitigation === "No mitigation provided" ||
          risk.mitigation === "None" ||
          risk.mitigation.length < 10)
      ) {
        issues.push({
          type: "potential_issue",
          field: `risks[${index}].mitigation`,
          severity: "low",
          message: `Risk ${
            risk.title || index
          } has an inadequate mitigation strategy`,
        });
      }
    });

    return {
      passed: issues.length === 0,
      issues,
      recommendedFixes: this.generateFixRecommendations(issues),
    };
  }

  /**
   * Verify the resource allocation
   * @param {Object} resourceAllocation - Resource allocation data
   * @param {Array} tasks - Task data
   * @returns {Object} - Verification results
   */
  verifyResourceAllocation(resourceAllocation, tasks) {
    const issues = [];

    if (!resourceAllocation) {
      issues.push({
        type: "missing_data",
        field: "resourceAllocation",
        severity: "high",
        message: "Resource allocation data is missing",
      });

      return {
        passed: false,
        issues,
        recommendedFixes: this.generateFixRecommendations(issues),
      };
    }

    // Check for overallocation
    if (
      resourceAllocation.teamUtilization &&
      resourceAllocation.teamUtilization.averageUtilization > 85
    ) {
      issues.push({
        type: "overallocation",
        field: "resourceAllocation.teamUtilization",
        severity: "high",
        message: `Team is overallocated with ${resourceAllocation.teamUtilization.averageUtilization}% average utilization`,
      });
    }

    if (resourceAllocation.hasResourceRisks) {
      const overallocatedSprints =
        resourceAllocation.teamUtilization.overallocatedSprints;
      const totalSprints = resourceAllocation.teamUtilization.totalSprints;

      issues.push({
        type: "overallocation",
        field: "resourceAllocation.hasResourceRisks",
        severity: "high",
        message: `${overallocatedSprints} out of ${totalSprints} sprints are overallocated`,
      });

      // Check if there are any recommendations to fix the overallocation
      if (
        !resourceAllocation.recommendations ||
        !Array.isArray(resourceAllocation.recommendations) ||
        resourceAllocation.recommendations.length === 0
      ) {
        issues.push({
          type: "missing_data",
          field: "resourceAllocation.recommendations",
          severity: "medium",
          message:
            "No recommendations provided to address resource overallocation",
        });
      }
    }

    // Check if all tasks have assignees
    const unassignedTasks = tasks.filter((task) => !task.assignedTo);

    if (unassignedTasks.length > 0) {
      issues.push({
        type: "incomplete_data",
        field: "tasks[].assignedTo",
        severity: "medium",
        message: `${unassignedTasks.length} tasks do not have assignees`,
      });
    }

    return {
      passed: issues.length === 0,
      issues,
      recommendedFixes: this.generateFixRecommendations(issues),
    };
  }

  /**
   * Perform a holistic verification using LLM
   * @param {Object} compiledData - Compiled project data
   * @param {Object} checks - Results of individual checks
   * @returns {Promise<Object>} - Holistic verification results
   */
  async performHolisticVerification(compiledData, checks) {
    try {
      // If there are already critical issues, skip the LLM check to save resources
      if (this.hasCriticalIssues(checks)) {
        return {
          passed: false,
          issues: [
            {
              type: "dependency",
              field: "holistic",
              severity: "info",
              message:
                "Skipped holistic check due to critical issues in specific checks",
            },
          ],
          recommendedFixes: [],
        };
      }

      const prompt = this.createHolisticVerificationPrompt(
        compiledData,
        checks
      );

      const response = await this.queryLLM(prompt, {
        temperature: this.temperature,
        maxTokens: 2000,
      });

      // Parse the LLM response
      return this.parseHolisticVerificationResponse(response);
    } catch (error) {
      this.log("Error during holistic verification: " + error.message);
      return {
        passed: false,
        issues: [
          {
            type: "error",
            field: "holistic",
            severity: "info",
            message: "Error during holistic verification: " + error.message,
          },
        ],
        recommendedFixes: [],
      };
    }
  }

  /**
   * Check if there are any critical issues in the checks
   * @param {Object} checks - Results of individual checks
   * @returns {boolean} - True if there are critical issues
   */
  hasCriticalIssues(checks) {
    for (const check of Object.values(checks)) {
      if (check.issues) {
        for (const issue of check.issues) {
          if (issue.severity === "critical") {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Create a prompt for holistic verification
   * @param {Object} compiledData - Compiled project data
   * @param {Object} checks - Results of individual checks
   * @returns {string} - Formatted prompt
   */
  createHolisticVerificationPrompt(compiledData, checks) {
    // Summarize the project
    const projectSummary = `
Project: ${compiledData.project.name}
Description: ${compiledData.project.description}
Timeline: ${compiledData.project.timeline}
Team size: ${
      compiledData.project.teamMembers
        ? compiledData.project.teamMembers.length
        : 0
    }
Tech stack: ${
      compiledData.project.techStack
        ? compiledData.project.techStack.join(", ")
        : "N/A"
    }
Sprints: ${compiledData.sprints ? compiledData.sprints.length : 0}
Tasks: ${compiledData.tasks ? compiledData.tasks.length : 0}
Risks: ${compiledData.risks ? compiledData.risks.length : 0}
    `;

    // Summarize existing issues
    const existingIssues = Object.values(checks)
      .flatMap((check) => check.issues || [])
      .map((issue) => `- [${issue.severity.toUpperCase()}] ${issue.message}`)
      .join("\n");

    return `
As a project management expert, perform a holistic verification of this project plan to identify any issues that individual checks might have missed.

PROJECT SUMMARY:
${projectSummary}

EXISTING ISSUES FOUND:
${existingIssues || "No issues found in individual checks."}

HOLISTIC VERIFICATION QUESTIONS:
1. Is the project scope reasonable for the timeline and team size?
2. Are there any inconsistencies between different parts of the plan?
3. Are the sprints balanced in terms of workload and deliverables?
4. Is there anything important missing from the project plan?
5. Are there any unrealistic expectations or deadlines?
6. Is the team composition appropriate for the technical requirements?
7. Is there adequate time for testing, documentation, and deployment?

Please provide your response in JSON format:
{
  "holisticIssues": [
    {
      "type": "scope"|"consistency"|"balance"|"missing"|"unrealistic"|"team"|"process"|"other",
      "description": "Detailed description of the issue",
      "severity": "high"|"medium"|"low",
      "recommendation": "Recommendation to address the issue"
    }
  ],
  "overallAssessment": "A brief overall assessment of the project plan",
  "isPlanRealistic": true|false
}
`;
  }

  /**
   * Parse the holistic verification response from the LLM
   * @param {string} response - LLM response
   * @returns {Object} - Parsed holistic verification results
   */
  parseHolisticVerificationResponse(response) {
    try {
      // Try to extract and parse JSON from the response
      const jsonMatch =
        response.match(/```json\s*([\s\S]*?)\s*```/) ||
        response.match(/```\s*([\s\S]*?)\s*```/) ||
        response.match(/({[\s\S]*})/);

      const jsonText = jsonMatch ? jsonMatch[1] : response;
      const parsedResponse = JSON.parse(jsonText);

      // Map the holistic issues to our standard issue format
      const issues = (parsedResponse.holisticIssues || []).map((issue) => ({
        type: issue.type || "other",
        field: "holistic",
        severity: issue.severity || "medium",
        message: issue.description,
        recommendation: issue.recommendation,
      }));

      return {
        passed: issues.length === 0 && parsedResponse.isPlanRealistic !== false,
        issues,
        overallAssessment:
          parsedResponse.overallAssessment || "No overall assessment provided",
        isPlanRealistic: parsedResponse.isPlanRealistic !== false,
      };
    } catch (error) {
      this.log(
        "Error parsing holistic verification response: " + error.message
      );

      return {
        passed: false,
        issues: [
          {
            type: "parsing_error",
            field: "holistic",
            severity: "info",
            message: "Could not parse holistic verification response",
          },
        ],
        overallAssessment:
          "Could not analyze overall plan due to parsing error",
        isPlanRealistic: false,
      };
    }
  }

  /**
   * Generate fix recommendations for issues
   * @param {Array} issues - Issues to generate recommendations for
   * @returns {Array} - Recommended fixes
   */
  generateFixRecommendations(issues) {
    return issues.map((issue) => {
      let recommendation = "";

      switch (issue.type) {
        case "missing_field":
          recommendation = `Add the missing ${issue.field} to the project plan`;
          break;

        case "missing_data":
          recommendation = `Provide the required ${issue.field} data`;
          break;

        case "empty_array":
          recommendation = `Add at least one item to the ${issue.field} array`;
          break;

        case "invalid_data":
          recommendation = `Correct the invalid data in ${issue.field}`;
          break;

        case "invalid_reference":
          recommendation = `Update the reference in ${issue.field} to a valid value`;
          break;

        case "overlap":
          recommendation = `Adjust the dates to eliminate overlap in ${issue.field}`;
          break;

        case "overallocation":
          recommendation = `Reduce workload or extend timeline to address overallocation`;
          break;

        case "incomplete_data":
          recommendation = `Complete the missing data in ${issue.field}`;
          break;

        case "potential_issue":
          recommendation = `Review and potentially improve ${issue.field}`;
          break;

        default:
          recommendation = "Address the issue as appropriate";
      }

      return {
        issueType: issue.type,
        field: issue.field,
        recommendation,
        priority: this.mapSeverityToPriority(issue.severity),
      };
    });
  }

  /**
   * Map severity to priority
   * @param {string} severity - Issue severity
   * @returns {string} - Priority
   */
  mapSeverityToPriority(severity) {
    switch (severity) {
      case "critical":
      case "high":
        return "High";
      case "medium":
        return "Medium";
      case "low":
      case "info":
      default:
        return "Low";
    }
  }

  /**
   * Compile the verification results
   * @param {Object} checks - Results of individual checks
   * @param {Object} holisticCheck - Results of holistic check
   * @returns {Object} - Compiled verification results
   */
  compileVerificationResults(checks, holisticCheck) {
    // Count issues by severity
    const issueCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    // Collect all issues
    const allIssues = [];

    // Process specific checks
    for (const [checkName, check] of Object.entries(checks)) {
      if (check.issues) {
        check.issues.forEach((issue) => {
          issueCounts[issue.severity] = (issueCounts[issue.severity] || 0) + 1;
          allIssues.push({
            ...issue,
            checkSource: checkName,
          });
        });
      }
    }

    // Add holistic check issues
    if (holisticCheck && holisticCheck.issues) {
      holisticCheck.issues.forEach((issue) => {
        issueCounts[issue.severity] = (issueCounts[issue.severity] || 0) + 1;
        allIssues.push({
          ...issue,
          checkSource: "holisticCheck",
        });
      });
    }

    // Determine overall pass/fail
    const passed =
      issueCounts.critical === 0 &&
      issueCounts.high === 0 &&
      (holisticCheck ? holisticCheck.isPlanRealistic !== false : true);

    // Collect all recommended fixes
    const allRecommendedFixes = [];

    for (const check of Object.values(checks)) {
      if (check.recommendedFixes) {
        allRecommendedFixes.push(...check.recommendedFixes);
      }
    }

    // Sort issues by severity
    const sortedIssues = allIssues.sort((a, b) => {
      const severityOrder = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        info: 4,
      };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return {
      passed,
      issueCounts,
      issues: sortedIssues,
      recommendedFixes: allRecommendedFixes,
      checkResults: {
        ...checks,
        holisticCheck,
      },
      summary: passed
        ? "The project plan passes verification with minor or no issues."
        : "The project plan has critical or high severity issues that need to be addressed.",
      overallAssessment: holisticCheck
        ? holisticCheck.overallAssessment
        : undefined,
      verifiedAt: new Date().toISOString(),
    };
  }
}
