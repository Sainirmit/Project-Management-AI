/**
 * dataCompilationAgent.js
 * Agent responsible for compiling data from all other agents into a structured format
 */
import { BaseAgent } from "./baseAgent.js";

export class DataCompilationAgent extends BaseAgent {
  constructor() {
    super("DataCompilationAgent");
    this.temperature = 0.2; // Low temperature for consistent data structuring
  }

  /**
   * Process all data from previous agents and compile into a structured format
   * @param {Object} projectState - Current state of the project from all agents
   * @returns {Promise<Object>} - Compiled structured data
   */
  async process(projectState) {
    try {
      this.log("Starting data compilation process");

      // Extract relevant data from the project state
      const {
        projectDetails,
        teamMembers,
        projectOverview,
        sprintPlan,
        resourceAnalysis,
        tasks,
        subtasks,
        priorities,
        assignments,
      } = projectState;

      // Compile the data into a structured format
      const compiledData = this.compileData(
        projectDetails,
        projectOverview,
        sprintPlan,
        resourceAnalysis,
        tasks,
        subtasks,
        priorities,
        assignments
      );

      this.log("Data compilation completed successfully");
      return compiledData;
    } catch (error) {
      this.reportError(error, "data compilation process");
    }
  }

  /**
   * Compile all data into a structured format
   * @param {Object} projectDetails - Project initialization data
   * @param {Object} projectOverview - Project overview data
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Object} resourceAnalysis - Resource analysis data
   * @param {Array} tasks - Task data
   * @param {Array} subtasks - Subtask data
   * @param {Object} priorities - Task priorities
   * @param {Object} assignments - Worker assignments
   * @returns {Object} - Compiled data
   */
  compileData(
    projectDetails,
    projectOverview,
    sprintPlan,
    resourceAnalysis,
    tasks,
    subtasks,
    priorities,
    assignments
  ) {
    // Combine project details and overview
    const combinedProjectData = this.combineProjectData(
      projectDetails,
      projectOverview
    );

    // Structure the sprint data
    const structuredSprints = this.structureSprints(
      sprintPlan,
      resourceAnalysis
    );

    // Structure the task data
    const structuredTasks = this.structureTasks(
      tasks,
      subtasks,
      priorities,
      assignments
    );

    // Extract risks and mitigation strategies
    const risks = this.extractRisks(resourceAnalysis, projectOverview);

    // Create project timeline and milestones
    const timeline = this.createTimeline(sprintPlan, tasks);

    return {
      project: combinedProjectData,
      sprints: structuredSprints,
      tasks: structuredTasks,
      subtasks: subtasks || [],
      risks,
      timeline,
      resourceAllocation: this.summarizeResourceAllocation(
        resourceAnalysis,
        assignments
      ),
      metadata: {
        generatedAt: new Date().toISOString(),
        generatorVersion: "1.0.0",
        agentVersion: "2.0.0",
      },
    };
  }

  /**
   * Combine project details and overview
   * @param {Object} projectDetails - Project initialization data
   * @param {Object} projectOverview - Project overview data
   * @returns {Object} - Combined project data
   */
  combineProjectData(projectDetails, projectOverview) {
    // Start with project details
    const combined = {
      name: projectDetails.projectName,
      type: projectDetails.projectType,
      description: projectDetails.projectDescription,
      timeline: projectDetails.projectTimeline,
      priority: projectDetails.priority,
      techStack: projectDetails.techStack || [],
      teamMembers: projectDetails.teamMembers || [],
    };

    // Add data from project overview if available
    if (projectOverview) {
      combined.title = projectOverview.title || combined.name;
      combined.description =
        projectOverview.description || combined.description;
      combined.phases = projectOverview.phases || [];
      combined.objectives = projectOverview.objectives || [];
      combined.constraints = projectOverview.constraints || [];
      combined.assumptions = projectOverview.assumptions || [];
      combined.successCriteria = projectOverview.successCriteria || [];
    }

    return combined;
  }

  /**
   * Structure the sprint data
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Object} resourceAnalysis - Resource analysis data
   * @returns {Array} - Structured sprint data
   */
  structureSprints(sprintPlan, resourceAnalysis) {
    if (!sprintPlan || !sprintPlan.sprints) {
      return [];
    }

    return sprintPlan.sprints.map((sprint) => {
      // Find resource analysis for this sprint if available
      const sprintAnalysis =
        resourceAnalysis && resourceAnalysis.sprintAnalysis
          ? resourceAnalysis.sprintAnalysis.find(
              (a) => a.sprintId === sprint.id
            )
          : null;

      return {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        keyDeliverables: sprint.keyDeliverables || [],
        objectives: sprint.objectives || [],
        mainPhases: sprint.mainPhases || [],
        estimatedVelocity: sprint.estimatedVelocity || 0,
        resourceUtilization: sprintAnalysis
          ? sprintAnalysis.utilizationPercentage
          : null,
        isOverallocated: sprintAnalysis
          ? sprintAnalysis.isOverallocated
          : false,
        estimatedEffort: sprintAnalysis ? sprintAnalysis.estimatedHours : null,
      };
    });
  }

  /**
   * Structure the task data
   * @param {Array} tasks - Task data
   * @param {Array} subtasks - Subtask data
   * @param {Object} priorities - Task priorities
   * @param {Object} assignments - Worker assignments
   * @returns {Array} - Structured task data
   */
  structureTasks(tasks, subtasks, priorities, assignments) {
    if (!tasks || !Array.isArray(tasks)) {
      return [];
    }

    return tasks.map((task) => {
      // Find related subtasks if available
      const relatedSubtasks =
        subtasks && Array.isArray(subtasks)
          ? subtasks.filter((st) => st.parentTaskId === task.id)
          : [];

      // Get priority if available
      const priority =
        priorities && priorities.tasks && priorities.tasks[task.id]
          ? priorities.tasks[task.id]
          : task.priority || "Medium";

      // Get assignment if available - always prioritize actual assignments over original assigneeRole
      let assignedTo = null;

      // First check worker assignments (highest priority)
      if (assignments && assignments.tasks && assignments.tasks[task.id]) {
        assignedTo = assignments.tasks[task.id];
      }
      // If no assignment was found, fall back to the task's assigneeRole
      else if (task.assigneeRole) {
        assignedTo = task.assigneeRole;
      }

      return {
        ...task,
        priority,
        assignedTo,
        subtaskCount: relatedSubtasks.length,
        subtaskIds: relatedSubtasks.map((st) => st.id),
      };
    });
  }

  /**
   * Extract risks and mitigation strategies
   * @param {Object} resourceAnalysis - Resource analysis data
   * @param {Object} projectOverview - Project overview data
   * @returns {Array} - Risk data
   */
  extractRisks(resourceAnalysis, projectOverview) {
    const risks = [];

    // Add risks from resource analysis if available
    if (
      resourceAnalysis &&
      resourceAnalysis.constraintsAndBottlenecks &&
      resourceAnalysis.constraintsAndBottlenecks.riskAreas
    ) {
      resourceAnalysis.constraintsAndBottlenecks.riskAreas.forEach((risk) => {
        risks.push({
          category: "Resource",
          title: risk.area || "Unknown risk",
          description: risk.risk || "No description provided",
          mitigation: risk.mitigation || "No mitigation provided",
          impact: "Medium",
          probability: "Medium",
          source: "ResourceAnalysisAgent",
        });
      });
    }

    // Add skill gaps as risks
    if (
      resourceAnalysis &&
      resourceAnalysis.constraintsAndBottlenecks &&
      resourceAnalysis.constraintsAndBottlenecks.skillGaps
    ) {
      resourceAnalysis.constraintsAndBottlenecks.skillGaps.forEach((gap) => {
        risks.push({
          category: "Skill Gap",
          title: gap.area || "Unknown skill gap",
          description: gap.impact || "No description provided",
          mitigation: gap.mitigation || "No mitigation provided",
          impact: "Medium",
          probability: "High",
          source: "ResourceAnalysisAgent",
        });
      });
    }

    // Add risks from project overview if available
    if (
      projectOverview &&
      projectOverview.risks &&
      Array.isArray(projectOverview.risks)
    ) {
      projectOverview.risks.forEach((risk) => {
        risks.push({
          category: "Project",
          title: risk.title || risk.name || "Unknown risk",
          description: risk.description || "No description provided",
          mitigation: risk.mitigation || "No mitigation provided",
          impact: risk.impact || "Medium",
          probability: risk.probability || "Medium",
          source: "ProjectOverviewAgent",
        });
      });
    }

    return risks;
  }

  /**
   * Create a project timeline with milestones
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Array} tasks - Task data
   * @returns {Object} - Timeline data
   */
  createTimeline(sprintPlan, tasks) {
    const milestones = [];
    const events = [];

    // Add sprint start/end dates as events
    if (sprintPlan && sprintPlan.sprints && Array.isArray(sprintPlan.sprints)) {
      sprintPlan.sprints.forEach((sprint) => {
        if (sprint.startDate) {
          events.push({
            date: sprint.startDate,
            type: "sprint_start",
            title: `${sprint.name} Start`,
            description: `Beginning of ${sprint.name}`,
            relatedId: sprint.id,
          });
        }

        if (sprint.endDate) {
          events.push({
            date: sprint.endDate,
            type: "sprint_end",
            title: `${sprint.name} End`,
            description: `End of ${sprint.name}`,
            relatedId: sprint.id,
          });
        }
      });
    }

    // Add high priority tasks as milestones
    if (tasks && Array.isArray(tasks)) {
      tasks.forEach((task) => {
        if (task.priority === "High" && task.sprintEndDate) {
          milestones.push({
            date: task.sprintEndDate,
            title: task.title,
            description: task.description,
            type: "task_completion",
            relatedId: task.id,
          });
        }
      });
    }

    return {
      milestones,
      events,
      startDate:
        sprintPlan && sprintPlan.sprints && sprintPlan.sprints.length > 0
          ? sprintPlan.sprints[0].startDate
          : null,
      endDate:
        sprintPlan && sprintPlan.sprints && sprintPlan.sprints.length > 0
          ? sprintPlan.sprints[sprintPlan.sprints.length - 1].endDate
          : null,
    };
  }

  /**
   * Summarize resource allocation across the project
   * @param {Object} resourceAnalysis - Resource analysis data
   * @param {Object} assignments - Worker assignments
   * @returns {Object} - Resource allocation summary
   */
  summarizeResourceAllocation(resourceAnalysis, assignments) {
    // Calculate overall team utilization
    const teamUtilization =
      resourceAnalysis && resourceAnalysis.sprintAnalysis
        ? {
            averageUtilization: this.calculateAverageUtilization(
              resourceAnalysis.sprintAnalysis
            ),
            overallocatedSprints: resourceAnalysis.sprintAnalysis.filter(
              (s) => s.isOverallocated
            ).length,
            totalSprints: resourceAnalysis.sprintAnalysis.length,
          }
        : {
            averageUtilization: 0,
            overallocatedSprints: 0,
            totalSprints: 0,
          };

    // Summarize member allocation if assignments are available
    const memberAllocation = this.summarizeMemberAllocation(assignments);

    return {
      teamUtilization,
      memberAllocation,
      hasResourceRisks: teamUtilization.overallocatedSprints > 0,
      recommendations: resourceAnalysis
        ? resourceAnalysis.recommendedAdjustments || []
        : [],
    };
  }

  /**
   * Calculate average utilization across sprints
   * @param {Array} sprintAnalysis - Sprint analysis data
   * @returns {number} - Average utilization percentage
   */
  calculateAverageUtilization(sprintAnalysis) {
    if (
      !sprintAnalysis ||
      !Array.isArray(sprintAnalysis) ||
      sprintAnalysis.length === 0
    ) {
      return 0;
    }

    const totalUtilization = sprintAnalysis.reduce(
      (sum, sprint) => sum + (sprint.utilizationPercentage || 0),
      0
    );

    return Math.round(totalUtilization / sprintAnalysis.length);
  }

  /**
   * Summarize allocation per team member
   * @param {Object} assignments - Worker assignments
   * @returns {Array} - Member allocation summary
   */
  summarizeMemberAllocation(assignments) {
    if (!assignments || !assignments.tasks) {
      return [];
    }

    // Count tasks per assignee
    const tasksPerAssignee = {};

    // Process task assignments
    Object.values(assignments.tasks || {}).forEach((assignee) => {
      if (assignee) {
        const assigneeName =
          typeof assignee === "string" ? assignee : assignee.name || "Unknown";
        tasksPerAssignee[assigneeName] =
          (tasksPerAssignee[assigneeName] || 0) + 1;
      }
    });

    // Process subtask assignments if available
    Object.values(assignments.subtasks || {}).forEach((assignee) => {
      if (assignee) {
        const assigneeName =
          typeof assignee === "string" ? assignee : assignee.name || "Unknown";
        tasksPerAssignee[assigneeName] =
          (tasksPerAssignee[assigneeName] || 0) + 1;
      }
    });

    // Convert to array
    return Object.entries(tasksPerAssignee).map(([name, taskCount]) => ({
      name,
      taskCount,
      estimatedWorkload: this.calculateWorkloadLevel(taskCount),
    }));
  }

  /**
   * Calculate workload level based on task count
   * @param {number} taskCount - Number of tasks assigned
   * @returns {string} - Workload level (Low, Medium, High)
   */
  calculateWorkloadLevel(taskCount) {
    if (taskCount <= 2) return "Low";
    if (taskCount <= 5) return "Medium";
    return "High";
  }
}
