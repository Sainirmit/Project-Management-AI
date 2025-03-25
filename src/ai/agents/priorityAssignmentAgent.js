/**
 * priorityAssignmentAgent.js
 * Agent responsible for assigning priorities to tasks and subtasks
 */
import { BaseAgent } from "./baseAgent.js";

export class PriorityAssignmentAgent extends BaseAgent {
  constructor() {
    super("PriorityAssignmentAgent");
    this.temperature = 0.3; // Lower temperature for more consistent priority assignment
  }

  /**
   * Process tasks and subtasks to assign priorities
   * @param {Array} tasks - Array of tasks
   * @param {Array} subtasks - Array of subtasks
   * @returns {Promise<Object>} - Priority assignments for tasks and subtasks
   */
  async process(tasks, subtasks) {
    try {
      this.log("Starting priority assignment process");
      this.log(
        `Received ${tasks ? tasks.length : 0} tasks and ${
          subtasks ? subtasks.length : 0
        } subtasks`
      );

      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        this.log("No tasks provided, returning empty priority assignments");
        return { tasks: {}, subtasks: {} };
      }

      // Analyze dependencies to determine task order
      const dependencyGraph = this.buildDependencyGraph(tasks);

      // Calculate critical path and assign initial priorities based on it
      const criticalPath = this.calculateCriticalPath(dependencyGraph, tasks);
      this.log(`Identified critical path with ${criticalPath.length} tasks`);

      // Determine priorities based on critical path, dependencies, and task characteristics
      const taskPriorities = this.assignTaskPriorities(
        tasks,
        criticalPath,
        dependencyGraph
      );

      // Assign subtask priorities based on parent task priorities and dependencies
      const subtaskPriorities = this.assignSubtaskPriorities(
        subtasks,
        taskPriorities
      );

      // Combine results
      const priorityAssignments = {
        tasks: taskPriorities,
        subtasks: subtaskPriorities,
      };

      this.log("Priority assignment completed successfully");
      return priorityAssignments;
    } catch (error) {
      this.reportError(error, "priority assignment process");
      return { tasks: {}, subtasks: {} };
    }
  }

  /**
   * Build a dependency graph from tasks
   * @param {Array} tasks - Array of tasks
   * @returns {Object} - Dependency graph
   */
  buildDependencyGraph(tasks) {
    const graph = {};

    // Initialize graph nodes
    tasks.forEach((task) => {
      graph[task.id] = {
        dependsOn: [],
        dependents: [],
      };
    });

    // Populate dependencies
    tasks.forEach((task) => {
      if (task.dependencies && Array.isArray(task.dependencies)) {
        task.dependencies.forEach((depId) => {
          if (graph[depId]) {
            graph[task.id].dependsOn.push(depId);
            graph[depId].dependents.push(task.id);
          }
        });
      }
    });

    return graph;
  }

  /**
   * Calculate the critical path in the task dependency graph
   * @param {Object} graph - Dependency graph
   * @param {Array} tasks - Array of tasks
   * @returns {Array} - Array of task IDs in the critical path
   */
  calculateCriticalPath(graph, tasks) {
    // Find start nodes (no dependencies)
    const startNodes = Object.keys(graph).filter(
      (id) => graph[id].dependsOn.length === 0
    );

    // Find end nodes (no dependents)
    const endNodes = Object.keys(graph).filter(
      (id) => graph[id].dependents.length === 0
    );

    // Create task map for quick lookup
    const taskMap = {};
    tasks.forEach((task) => {
      taskMap[task.id] = task;
    });

    // Calculate longest path from each start node to each end node
    let criticalPath = [];
    let maxPathLength = 0;

    startNodes.forEach((startId) => {
      endNodes.forEach((endId) => {
        const paths = this.findAllPaths(graph, startId, endId);

        paths.forEach((path) => {
          const pathLength = path.reduce((sum, id) => {
            return sum + (taskMap[id] ? taskMap[id].estimatedHours || 0 : 0);
          }, 0);

          if (pathLength > maxPathLength) {
            maxPathLength = pathLength;
            criticalPath = path;
          }
        });
      });
    });

    return criticalPath;
  }

  /**
   * Find all possible paths between two nodes in the graph
   * @param {Object} graph - Dependency graph
   * @param {string} start - Start node ID
   * @param {string} end - End node ID
   * @returns {Array} - Array of paths (each path is an array of task IDs)
   */
  findAllPaths(graph, start, end, visited = new Set(), path = []) {
    // Add current node to path and visited set
    path.push(start);
    visited.add(start);

    // If reached the end node, return the current path
    if (start === end) {
      const result = [Array.from(path)];
      path.pop();
      visited.delete(start);
      return result;
    }

    // Recursively explore all dependents
    const paths = [];
    for (const dependent of graph[start].dependents) {
      if (!visited.has(dependent)) {
        const newPaths = this.findAllPaths(
          graph,
          dependent,
          end,
          visited,
          path
        );
        paths.push(...newPaths);
      }
    }

    // Backtrack
    path.pop();
    visited.delete(start);

    return paths;
  }

  /**
   * Assign priorities to tasks based on critical path and dependencies
   * @param {Array} tasks - Array of tasks
   * @param {Array} criticalPath - Array of task IDs in the critical path
   * @param {Object} dependencyGraph - Dependency graph
   * @returns {Object} - Map of task IDs to priority values
   */
  assignTaskPriorities(tasks, criticalPath, dependencyGraph) {
    const priorities = {};
    const criticalPathSet = new Set(criticalPath);

    // First pass: Assign initial priority based on critical path and deadline proximity
    tasks.forEach((task) => {
      let priorityScore = 0;

      // Critical path tasks get highest base priority
      if (criticalPathSet.has(task.id)) {
        priorityScore += 100;
      }

      // Tasks with more dependents are more important
      const dependentCount = dependencyGraph[task.id].dependents.length;
      priorityScore += dependentCount * 10;

      // Early sprints get higher priority
      if (task.sprintNumber) {
        priorityScore += (10 - Math.min(task.sprintNumber, 10)) * 5;
      }

      // Convert score to priority level
      let priority;
      if (priorityScore >= 100) {
        priority = "Critical";
      } else if (priorityScore >= 70) {
        priority = "High";
      } else if (priorityScore >= 40) {
        priority = "Medium";
      } else {
        priority = "Low";
      }

      priorities[task.id] = priority;
    });

    return priorities;
  }

  /**
   * Assign priorities to subtasks based on parent task priorities
   * @param {Array} subtasks - Array of subtasks
   * @param {Object} taskPriorities - Map of task IDs to priority values
   * @returns {Object} - Map of subtask IDs to priority values
   */
  assignSubtaskPriorities(subtasks, taskPriorities) {
    if (!subtasks || !Array.isArray(subtasks) || subtasks.length === 0) {
      return {};
    }

    const priorities = {};

    // Go through each subtask
    subtasks.forEach((subtask) => {
      const parentId = subtask.parentTaskId;
      const parentPriority = taskPriorities[parentId] || "Medium";

      // By default, inherit parent task priority
      let priority = parentPriority;

      // Adjust priority based on dependencies
      if (subtask.dependsOn && subtask.dependsOn.length > 0) {
        // If this subtask blocks other subtasks, increase priority
        priority = this.adjustPriorityForDependencies(priority);
      }

      priorities[subtask.id] = priority;
    });

    return priorities;
  }

  /**
   * Adjust priority level based on dependencies
   * @param {string} currentPriority - Current priority level
   * @returns {string} - Adjusted priority level
   */
  adjustPriorityForDependencies(currentPriority) {
    const priorityLevels = ["Low", "Medium", "High", "Critical"];
    const currentIndex = priorityLevels.indexOf(currentPriority);

    // Increase priority by one level if possible
    if (currentIndex < priorityLevels.length - 1) {
      return priorityLevels[currentIndex + 1];
    }

    return currentPriority;
  }
}
