/**
 * workerAssignmentAgent.js
 * Agent responsible for assigning team members to tasks and subtasks
 */
import { BaseAgent } from "./baseAgent.js";

export class WorkerAssignmentAgent extends BaseAgent {
  constructor() {
    super("WorkerAssignmentAgent");
    this.temperature = 0.4; // Moderate temperature for balancing consistent and creative assignments
  }

  /**
   * Process tasks, subtasks, priorities and team members to assign workers
   * @param {Array} tasks - Array of tasks
   * @param {Array} subtasks - Array of subtasks
   * @param {Object} priorities - Task and subtask priorities
   * @param {Array} teamMembers - Array of team members
   * @returns {Promise<Object>} - Worker assignments for tasks and subtasks
   */
  async process(tasks, subtasks, priorities, teamMembers) {
    try {
      this.log("Starting worker assignment process");
      this.log(
        `Received ${tasks ? tasks.length : 0} tasks, ${
          subtasks ? subtasks.length : 0
        } subtasks, and ${teamMembers ? teamMembers.length : 0} team members`
      );

      if (
        !tasks ||
        !Array.isArray(tasks) ||
        tasks.length === 0 ||
        !teamMembers ||
        !Array.isArray(teamMembers) ||
        teamMembers.length === 0
      ) {
        this.log(
          "Insufficient data for worker assignment, returning empty assignments"
        );
        return { tasks: {}, subtasks: {} };
      }

      // Create skill profiles for team members
      const teamSkills = this.createTeamSkillProfiles(teamMembers);

      // Create team member lookup map (id to name)
      const teamMembersMap = this.createTeamMemberMap(teamMembers);

      // Create workload tracking for balanced assignments
      const workloadTracker = this.initializeWorkloadTracker(teamMembers);

      // Process tasks in priority order
      const sortedTasks = this.sortByPriority(tasks, priorities.tasks);
      const taskAssignments = this.assignWorkersToTasks(
        sortedTasks,
        teamSkills,
        workloadTracker,
        teamMembersMap
      );

      // Process subtasks in priority order, considering task assignments
      const sortedSubtasks = this.sortByPriority(subtasks, priorities.subtasks);
      const subtaskAssignments = this.assignWorkersToSubtasks(
        sortedSubtasks,
        taskAssignments,
        teamSkills,
        workloadTracker,
        teamMembersMap,
        teamMembers
      );

      // Balance final workload if needed
      this.balanceWorkload(
        taskAssignments,
        subtaskAssignments,
        workloadTracker,
        tasks,
        subtasks,
        teamMembersMap
      );

      // Combine results
      const workerAssignments = {
        tasks: taskAssignments,
        subtasks: subtaskAssignments,
        workloadSummary: this.generateWorkloadSummary(
          workloadTracker,
          teamMembersMap
        ),
      };

      this.log("Worker assignment completed successfully");
      return workerAssignments;
    } catch (error) {
      this.reportError(error, "worker assignment process");
      return { tasks: {}, subtasks: {} };
    }
  }

  /**
   * Create skill profiles for team members based on their skills and roles
   * @param {Array} teamMembers - Array of team members
   * @returns {Object} - Map of team member IDs to skill profiles
   */
  createTeamSkillProfiles(teamMembers) {
    const skillProfiles = {};

    teamMembers.forEach((member) => {
      // Extract skills, with fallbacks
      const skills = member.skills || this.inferSkillsFromRole(member.role);

      // Create profile
      skillProfiles[member.id] = {
        id: member.id,
        name: member.name,
        role: member.role,
        skills: skills,
        availability: member.availability || 40, // Default to 40 hours if not specified
        specialties: this.determineSpecialties(skills),
        hourlyRate: member.hourlyRate,
      };
    });

    return skillProfiles;
  }

  /**
   * Infer skills from role when no specific skills are provided
   * @param {string} role - Team member role
   * @returns {Array} - Array of inferred skills
   */
  inferSkillsFromRole(role) {
    const roleSkillMap = {
      "Project Manager": [
        "Planning",
        "Coordination",
        "Documentation",
        "Risk Management",
      ],
      "Frontend Developer": ["JavaScript", "HTML", "CSS", "React", "UI/UX"],
      "Backend Developer": [
        "Node.js",
        "Database",
        "API",
        "Server Architecture",
      ],
      "Full Stack Developer": [
        "JavaScript",
        "HTML",
        "CSS",
        "React",
        "Node.js",
        "Database",
        "API",
      ],
      "UI/UX Designer": [
        "Design",
        "Wireframing",
        "Prototyping",
        "User Research",
      ],
      "QA Engineer": ["Testing", "Test Automation", "QA", "Bug Reporting"],
      "DevOps Engineer": [
        "DevOps",
        "CI/CD",
        "Docker",
        "Kubernetes",
        "Cloud Services",
      ],
    };

    return roleSkillMap[role] || ["General"];
  }

  /**
   * Determine specialties from skills (the top 2-3 skills based on skill level or presence)
   * @param {Array} skills - Array of skills
   * @returns {Array} - Array of specialties
   */
  determineSpecialties(skills) {
    if (!skills || !Array.isArray(skills)) {
      return ["General"];
    }

    // If skills are objects with levels, sort by level
    if (typeof skills[0] === "object" && skills[0].level) {
      return skills
        .sort((a, b) => b.level - a.level)
        .slice(0, 3)
        .map((skill) => skill.name);
    }

    // Otherwise just return the first 3 skills
    return skills.slice(0, 3);
  }

  /**
   * Initialize workload tracker for team members
   * @param {Array} teamMembers - Array of team members
   * @returns {Object} - Workload tracker object
   */
  initializeWorkloadTracker(teamMembers) {
    const workloadTracker = {};
    const now = new Date();

    teamMembers.forEach((member) => {
      // Calculate effective availability based on time-based factors
      const effectiveAvailability = this.calculateEffectiveAvailability(
        member,
        now
      );

      workloadTracker[member.id] = {
        assignedHours: 0,
        totalAvailableHours: effectiveAvailability.availableHours,
        remainingHours: effectiveAvailability.availableHours,
        assignedTasks: [],
        assignedSubtasks: [],
        schedule: effectiveAvailability.schedule || {},
        timeOffPeriods: effectiveAvailability.timeOffPeriods || [],
        allocationPercentage: effectiveAvailability.allocationPercentage || 100,
        effectiveStartDate: effectiveAvailability.effectiveStartDate,
        specialties: effectiveAvailability.specialties || [],
        skillProficiencies: effectiveAvailability.skillProficiencies || {},
        historicalPerformance:
          effectiveAvailability.historicalPerformance || null,
        workHistory: [],
      };
    });

    return workloadTracker;
  }

  /**
   * Calculate effective availability based on time-based factors
   * @param {Object} member - Team member data
   * @param {Date} currentDate - Current date to calculate availability from
   * @returns {Object} - Effective availability data
   */
  calculateEffectiveAvailability(member, currentDate) {
    // Default to basic availability if no enhanced data exists
    if (!member.availability || typeof member.availability !== "object") {
      return {
        availableHours:
          typeof member.availability === "number" ? member.availability : 40,
        allocationPercentage: 100,
        effectiveStartDate: currentDate,
        specialties: this.determineSpecialties(member.skills || []),
        skillProficiencies: this.normalizeSkillProficiencies(
          member.skills || []
        ),
      };
    }

    const availability = member.availability;
    let availableHours = availability.baseHoursPerWeek || 40;
    let allocationPercentage = 100;

    // Check if there are time-off periods that include the current date
    const activeTimeOff = Array.isArray(availability.timeOff)
      ? availability.timeOff.filter((period) => {
          const startDate = period.start ? new Date(period.start) : null;
          const endDate = period.end ? new Date(period.end) : null;
          return (
            startDate &&
            endDate &&
            currentDate >= startDate &&
            currentDate <= endDate
          );
        })
      : [];

    // Apply time off reduction if relevant
    if (activeTimeOff.length > 0) {
      // Full week off
      if (activeTimeOff.some((period) => period.fullDay)) {
        availableHours = 0;
      }
    }

    // Apply allocation changes
    if (
      Array.isArray(availability.allocationChanges) &&
      availability.allocationChanges.length > 0
    ) {
      // Find the most recent allocation change that is effective before or on the current date
      const relevantChanges = availability.allocationChanges
        .filter((change) => {
          const effectiveDate = change.effectiveDate
            ? new Date(change.effectiveDate)
            : null;
          return effectiveDate && effectiveDate <= currentDate;
        })
        .sort((a, b) => new Date(b.effectiveDate) - new Date(a.effectiveDate));

      if (relevantChanges.length > 0) {
        allocationPercentage = relevantChanges[0].allocationPercentage;
        availableHours = (availableHours * allocationPercentage) / 100;
      }
    }

    // Apply day-specific schedule if available
    const dayOfWeek = this.getDayOfWeek(currentDate);
    if (availability.schedule && availability.schedule[dayOfWeek]) {
      const daySchedule = availability.schedule[dayOfWeek];
      if (!daySchedule.available) {
        availableHours = 0;
      } else if (typeof daySchedule.hours === "number") {
        availableHours = daySchedule.hours * 5; // Convert daily hours to weekly
      }
    }

    // Extract skill proficiencies
    const skillProficiencies = this.normalizeSkillProficiencies(
      availability.skills || member.skills || []
    );

    // Determine historical performance from project history if available
    const historicalPerformance = this.calculateHistoricalPerformance(
      availability.projectHistory || []
    );

    return {
      availableHours: Math.max(0, availableHours),
      allocationPercentage,
      timeOffPeriods: activeTimeOff,
      schedule: availability.schedule || {},
      effectiveStartDate: currentDate,
      specialties: this.determineSpecialties(member.skills || []),
      skillProficiencies,
      historicalPerformance,
    };
  }

  /**
   * Get day of week from date
   * @param {Date} date - Date to get day from
   * @returns {string} - Day of week
   */
  getDayOfWeek(date) {
    const days = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    return days[date.getDay()];
  }

  /**
   * Normalize skill proficiencies to a standard format
   * @param {Array} skills - Skills array
   * @returns {Object} - Map of skill names to proficiency levels
   */
  normalizeSkillProficiencies(skills) {
    const proficiencyMap = {};

    if (!Array.isArray(skills)) return proficiencyMap;

    skills.forEach((skill) => {
      if (typeof skill === "string") {
        proficiencyMap[skill] = { level: "Medium", score: 0.7 };
      } else if (typeof skill === "object" && skill.name) {
        // Convert string levels to numeric scores for easier calculation
        const levelScore = this.getProficiencyScore(skill.level || "Medium");
        proficiencyMap[skill.name] = {
          level: skill.level || "Medium",
          score: levelScore,
          experience: skill.experience || 0,
          projects: skill.projects || [],
          count: skill.count || 0,
        };
      }
    });

    return proficiencyMap;
  }

  /**
   * Convert proficiency level to numeric score
   * @param {string} level - Proficiency level
   * @returns {number} - Numeric score (0-1)
   */
  getProficiencyScore(level) {
    const levels = {
      Beginner: 0.3,
      Low: 0.4,
      Medium: 0.7,
      Intermediate: 0.7,
      High: 0.9,
      Expert: 1.0,
    };

    return levels[level] || 0.7; // Default to Medium if unknown
  }

  /**
   * Calculate historical performance metrics from project history
   * @param {Array} projectHistory - Project history entries
   * @returns {Object|null} - Performance metrics or null if no history
   */
  calculateHistoricalPerformance(projectHistory) {
    if (!Array.isArray(projectHistory) || projectHistory.length === 0) {
      return null;
    }

    // Extract performance ratings if available
    const ratings = projectHistory
      .filter((project) => typeof project.performanceRating === "number")
      .map((project) => project.performanceRating);

    if (ratings.length === 0) {
      return null;
    }

    // Calculate average rating
    const averageRating =
      ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

    // Calculate project completion count
    const completedProjects = projectHistory.filter(
      (project) => project.endDate && new Date(project.endDate) < new Date()
    ).length;

    return {
      averageRating,
      completedProjects,
      totalProjects: projectHistory.length,
      recentProjects: projectHistory
        .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
        .slice(0, 3)
        .map((p) => p.projectName),
    };
  }

  /**
   * Sort tasks or subtasks by priority
   * @param {Array} items - Array of tasks or subtasks
   * @param {Object} priorities - Priority assignments
   * @returns {Array} - Sorted array of items
   */
  sortByPriority(items, priorities) {
    if (!items || !Array.isArray(items)) {
      return [];
    }

    const priorityOrder = {
      Critical: 0,
      High: 1,
      Medium: 2,
      Low: 3,
    };

    return [...items].sort((a, b) => {
      const priorityA = priorityOrder[priorities[a.id]] || 2; // Default to Medium
      const priorityB = priorityOrder[priorities[b.id]] || 2;

      // First sort by priority
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Then by sprint number if available
      if (a.sprintNumber !== b.sprintNumber) {
        return (a.sprintNumber || 999) - (b.sprintNumber || 999);
      }

      // Then by estimated hours (larger tasks first)
      return (b.estimatedHours || 0) - (a.estimatedHours || 0);
    });
  }

  /**
   * Create a map of team member IDs to team member objects
   * @param {Array} teamMembers - Array of team members
   * @returns {Object} - Map of team member IDs to team member objects
   */
  createTeamMemberMap(teamMembers) {
    const map = {};

    if (teamMembers && Array.isArray(teamMembers)) {
      teamMembers.forEach((member) => {
        if (member && member.id) {
          map[member.id] = member;
        }
      });
    }

    return map;
  }

  /**
   * Create a reverse map from member name to ID
   * @param {Array} teamMembers - Array of team members
   * @returns {Object} - Map of team member names to IDs
   */
  createNameToIdMap(teamMembers) {
    const map = {};

    if (teamMembers && Array.isArray(teamMembers)) {
      teamMembers.forEach((member) => {
        if (member && member.name) {
          map[member.name] = member.id;
        }
      });
    }

    return map;
  }

  /**
   * Assign workers to tasks based on skills, priorities and workload
   * @param {Array} sortedTasks - Sorted array of tasks
   * @param {Object} teamSkills - Team skill profiles
   * @param {Object} workloadTracker - Workload tracking object
   * @param {Object} teamMembersMap - Map of team member IDs to team member objects
   * @returns {Object} - Map of task IDs to assigned worker names
   */
  assignWorkersToTasks(
    sortedTasks,
    teamSkills,
    workloadTracker,
    teamMembersMap
  ) {
    const taskAssignments = {};

    sortedTasks.forEach((task) => {
      // Find the best worker for this task
      const bestWorkerId = this.findBestWorkerForTask(
        task,
        teamSkills,
        workloadTracker
      );

      if (bestWorkerId) {
        // Get the member's name from their ID
        const assignedName = teamMembersMap[bestWorkerId]
          ? teamMembersMap[bestWorkerId].name
          : bestWorkerId;

        // Assign the worker to the task
        taskAssignments[task.id] = assignedName;

        // Update workload tracker
        workloadTracker[bestWorkerId].assignedHours += task.estimatedHours || 0;
        workloadTracker[bestWorkerId].remainingHours -=
          task.estimatedHours || 0;
        workloadTracker[bestWorkerId].assignedTasks.push(task.id);
      } else {
        this.log(`Warning: Could not find suitable worker for task ${task.id}`);
      }
    });

    return taskAssignments;
  }

  /**
   * Find the best worker for a task based on skills and availability
   * @param {Object} task - Task to assign
   * @param {Object} teamSkills - Team skill profiles
   * @param {Object} workloadTracker - Workload tracking object
   * @returns {string|null} - ID of the best worker, or null if none found
   */
  findBestWorkerForTask(task, teamSkills, workloadTracker) {
    // Extract task skills from category and keywords in title/description
    const taskSkills = this.extractTaskSkills(task);

    // Extract required role from task if specified
    const requiredRole =
      task.requiredRole || this.inferRequiredRoleFromTask(task);

    // Calculate match scores for each team member
    const matchScores = [];

    Object.values(teamSkills).forEach((member) => {
      // Skip if worker has no availability
      if (workloadTracker[member.id].remainingHours <= 0) {
        return;
      }

      // Calculate enhanced skill match score with proficiency weighting
      const skillMatchScore = this.calculateEnhancedSkillMatch(
        taskSkills,
        member.skills,
        workloadTracker[member.id].skillProficiencies
      );

      // Calculate role match score (1.0 if role matches exactly, 0.5 otherwise)
      const roleMatchScore =
        requiredRole &&
        member.role &&
        member.role.toLowerCase().includes(requiredRole.toLowerCase())
          ? 1.0
          : 0.5;

      // Calculate availability score (higher is better)
      const availabilityScore =
        workloadTracker[member.id].remainingHours /
        workloadTracker[member.id].totalAvailableHours;

      // Calculate workload balance score
      const workloadScore =
        1 - workloadTracker[member.id].assignedTasks.length / 10; // Normalize to 0-1

      // Calculate history-based score based on past performance and similar tasks
      const historyScore = this.calculateHistoryScore(
        taskSkills,
        workloadTracker[member.id].historicalPerformance,
        workloadTracker[member.id].workHistory
      );

      // Calculate specialty match score between task skills and member specialties
      const specialtyScore = this.calculateSpecialtyMatch(
        taskSkills,
        workloadTracker[member.id].specialties || []
      );

      // Combine scores with enhanced weights
      const totalScore =
        skillMatchScore * 0.35 +
        roleMatchScore * 0.2 +
        availabilityScore * 0.15 +
        workloadScore * 0.1 +
        historyScore * 0.1 +
        specialtyScore * 0.1;

      matchScores.push({
        workerId: member.id,
        score: totalScore,
        details: {
          skillMatchScore,
          roleMatchScore,
          availabilityScore,
          workloadScore,
          historyScore,
          specialtyScore,
        },
      });
    });

    // Sort by score (highest first) and return the best match
    matchScores.sort((a, b) => b.score - a.score);

    // Log detailed scoring for top candidates for transparency
    if (matchScores.length > 0) {
      this.log("Top candidates for task: " + task.title, {
        topCandidates: matchScores.slice(0, Math.min(3, matchScores.length)),
      });
    }

    return matchScores.length > 0 ? matchScores[0].workerId : null;
  }

  /**
   * Extract relevant skills from a task
   * @param {Object} task - Task object
   * @returns {Array} - Array of extracted skills
   */
  extractTaskSkills(task) {
    const skills = [];

    // Add category as a skill
    if (task.category) {
      skills.push(task.category);
    }

    // Add specific skills based on keywords in title and description
    const keywordMap = {
      frontend: ["JavaScript", "HTML", "CSS", "React", "UI/UX"],
      backend: ["Node.js", "Database", "API", "Server Architecture"],
      database: ["Database", "SQL", "NoSQL", "Data Modeling"],
      ui: ["UI/UX", "Design", "CSS"],
      ux: ["UI/UX", "User Research", "Design"],
      api: ["API", "REST", "GraphQL", "Backend"],
      test: ["Testing", "QA", "Test Automation"],
      devops: ["DevOps", "CI/CD", "Docker", "Kubernetes"],
      documentation: ["Documentation", "Technical Writing"],
      research: ["Research", "Analysis"],
      security: ["Security", "Authentication", "Authorization"],
    };

    // Search for keywords in title and description
    const textToSearch = `${task.title} ${task.description}`.toLowerCase();

    Object.entries(keywordMap).forEach(([keyword, relatedSkills]) => {
      if (textToSearch.includes(keyword)) {
        skills.push(...relatedSkills);
      }
    });

    // Remove duplicates
    return [...new Set(skills)];
  }

  /**
   * Calculate enhanced skill match score with proficiency weighting
   * @param {Array} taskSkills - Skills required for the task
   * @param {Array} memberSkills - Skills possessed by the team member
   * @param {Object} proficiencies - Skill proficiency data
   * @returns {number} - Match score from 0 to 1
   */
  calculateEnhancedSkillMatch(taskSkills, memberSkills, proficiencies = {}) {
    if (
      !taskSkills ||
      !taskSkills.length ||
      !memberSkills ||
      !memberSkills.length
    ) {
      return 0.5; // Default middle score if no skills to compare
    }

    // Normalize member skills to array of strings
    const normalizedMemberSkills = memberSkills.map((skill) => {
      if (typeof skill === "object" && skill.name) {
        return skill.name;
      }
      return skill;
    });

    // Track matched skills and their scores
    let totalScore = 0;
    let matchCount = 0;
    let criticalSkillMatches = 0;
    let criticalSkillsTotal = 0;

    // Identify critical skills for the task
    const criticalSkills = taskSkills.filter(
      (skill) =>
        skill.toLowerCase().includes("critical") || this.isCriticalSkill(skill)
    );
    criticalSkillsTotal = criticalSkills.length;

    taskSkills.forEach((taskSkill) => {
      // Check for direct or partial matches
      const matchedSkill = normalizedMemberSkills.find(
        (memberSkill) =>
          memberSkill.toLowerCase().includes(taskSkill.toLowerCase()) ||
          taskSkill.toLowerCase().includes(memberSkill.toLowerCase())
      );

      if (matchedSkill) {
        matchCount++;

        // Check if this is a critical skill
        const isCritical = this.isCriticalSkill(taskSkill);
        if (isCritical) {
          criticalSkillMatches++;
        }

        // Apply proficiency weighting if available
        const proficiency = proficiencies[matchedSkill];
        let skillScore = 0.7; // Default Medium proficiency

        if (proficiency && typeof proficiency.score === "number") {
          skillScore = proficiency.score;

          // Bonus for extensive experience with this skill
          if (proficiency.count && proficiency.count > 3) {
            skillScore = Math.min(1.0, skillScore + 0.2); // Bonus for extensive experience
          }

          // Bonus for recent project experience with this skill
          if (proficiency.projects && proficiency.projects.length > 0) {
            skillScore = Math.min(1.0, skillScore + 0.1); // Bonus for proven experience
          }
        }

        // Weight critical skills higher
        if (isCritical) {
          skillScore *= 1.5; // 50% boost for critical skills
        }

        totalScore += skillScore;
      }
    });

    // Calculate base skill match score
    let finalScore = 0.3; // Minimum score baseline

    if (matchCount > 0) {
      // Weighted average based on matched skills
      finalScore = Math.max(finalScore, totalScore / (taskSkills.length * 1.5));
    }

    // Critical skill penalty - if missing critical skills, reduce score
    if (criticalSkillsTotal > 0 && criticalSkillMatches < criticalSkillsTotal) {
      const criticalCoverage = criticalSkillMatches / criticalSkillsTotal;
      // Apply penalty based on missing critical skills
      finalScore *= criticalCoverage * 0.5 + 0.5; // Reduced penalty for partial matches
    }

    // Cap at 1.0 maximum
    return Math.min(1.0, finalScore);
  }

  /**
   * Determine if a skill is critical for tasks
   * @param {string} skill - Skill to evaluate
   * @returns {boolean} - True if skill is critical
   */
  isCriticalSkill(skill) {
    // Define critical skill categories
    const criticalSkills = [
      "Security",
      "Authentication",
      "Encryption",
      "Architecture",
      "DevOps",
      "CI/CD",
      "Database",
      "Backend",
      "API",
      "Performance",
      "Optimization",
      "Testing",
    ];

    return criticalSkills.some((criticalSkill) =>
      skill.toLowerCase().includes(criticalSkill.toLowerCase())
    );
  }

  /**
   * Infer the required role from a task based on its title and description
   * @param {Object} task - Task to analyze
   * @returns {string|null} - Inferred required role, or null if not determinable
   */
  inferRequiredRoleFromTask(task) {
    const text = `${task.title} ${task.description}`.toLowerCase();

    const roleKeywords = {
      "frontend developer": [
        "frontend",
        "ui",
        "interface",
        "react",
        "angular",
        "vue",
        "javascript",
        "css",
        "html",
      ],
      "backend developer": [
        "backend",
        "server",
        "api",
        "database",
        "node",
        "express",
        "django",
        "flask",
      ],
      "full stack developer": [
        "full stack",
        "fullstack",
        "end-to-end",
        "frontend and backend",
      ],
      "ui/ux designer": [
        "design",
        "ui/ux",
        "wireframe",
        "prototype",
        "user experience",
        "user interface",
      ],
      "devops engineer": [
        "devops",
        "ci/cd",
        "docker",
        "kubernetes",
        "deployment",
        "pipeline",
      ],
      "qa engineer": ["testing", "qa", "quality assurance", "test automation"],
      "project manager": [
        "management",
        "coordination",
        "planning",
        "schedule",
        "risk assessment",
      ],
    };

    for (const [role, keywords] of Object.entries(roleKeywords)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        return role;
      }
    }

    return null;
  }

  /**
   * Calculate history-based score based on past performance and similar tasks
   * @param {Array} taskSkills - Skills required for the task
   * @param {Object} performance - Historical performance data
   * @param {Array} workHistory - Previously completed tasks in this project
   * @returns {number} - History score from 0 to 1
   */
  calculateHistoryScore(taskSkills, performance, workHistory) {
    // If no performance data available, return neutral score
    if (!performance) {
      return 0.5;
    }

    // Start with base score from performance rating
    let score = 0.5;

    if (typeof performance.averageRating === "number") {
      // Scale 1-5 rating to 0.5-1.0 score
      score = 0.5 + performance.averageRating / 10;
    }

    // Bonus for completed projects (experience)
    if (performance.completedProjects > 5) {
      score += 0.1;
    } else if (performance.completedProjects > 2) {
      score += 0.05;
    }

    // Analyze work history for similar task experience
    if (Array.isArray(workHistory) && workHistory.length > 0) {
      // Check if worker has completed similar tasks successfully
      const similarTaskCount = workHistory.filter((historyItem) => {
        return taskSkills.some(
          (skill) => historyItem.skills && historyItem.skills.includes(skill)
        );
      }).length;

      if (similarTaskCount > 0) {
        score += Math.min(0.2, similarTaskCount * 0.05); // Bonus for similar tasks
      }
    }

    return Math.min(1.0, score);
  }

  /**
   * Calculate specialty match score between task skills and member specialties
   * @param {Array} taskSkills - Skills required for the task
   * @param {Array} specialties - Member's specialty skills
   * @returns {number} - Match score from 0 to 1
   */
  calculateSpecialtyMatch(taskSkills, specialties) {
    if (
      !taskSkills ||
      !taskSkills.length ||
      !specialties ||
      !specialties.length
    ) {
      return 0.5;
    }

    // Count matches with specialties (weighted higher)
    const specialtyMatches = taskSkills.filter((taskSkill) =>
      specialties.some(
        (specialty) =>
          specialty.toLowerCase().includes(taskSkill.toLowerCase()) ||
          taskSkill.toLowerCase().includes(specialty.toLowerCase())
      )
    ).length;

    if (specialtyMatches > 0) {
      // Give higher score for specialty matches
      return Math.min(1.0, 0.7 + (specialtyMatches / taskSkills.length) * 0.3);
    }

    return 0.5; // Neutral if no specialty matches
  }

  /**
   * Assign workers to subtasks, considering parent task assignments
   * @param {Array} sortedSubtasks - Sorted array of subtasks
   * @param {Object} taskAssignments - Task to worker assignments
   * @param {Object} teamSkills - Team skill profiles
   * @param {Object} workloadTracker - Workload tracking object
   * @param {Object} teamMembersMap - Map of team member IDs to team member objects
   * @param {Array} teamMembers - Array of team members
   * @returns {Object} - Map of subtask IDs to assigned worker names
   */
  assignWorkersToSubtasks(
    sortedSubtasks,
    taskAssignments,
    teamSkills,
    workloadTracker,
    teamMembersMap,
    teamMembers
  ) {
    const subtaskAssignments = {};

    // Create a reverse lookup from name to ID
    const nameToIdMap = this.createNameToIdMap(teamMembers);

    sortedSubtasks.forEach((subtask) => {
      let assignedWorkerId;

      // Try to assign to the same worker as the parent task first
      const parentTaskId = subtask.parentTaskId;
      const parentTaskWorkerName = taskAssignments[parentTaskId];

      // Convert worker name back to ID for workload checking
      const parentTaskWorkerId = nameToIdMap[parentTaskWorkerName];

      if (
        parentTaskWorkerId &&
        workloadTracker[parentTaskWorkerId] &&
        workloadTracker[parentTaskWorkerId].remainingHours >=
          subtask.estimatedHours
      ) {
        // Parent task worker has capacity, use them
        assignedWorkerId = parentTaskWorkerId;
      } else {
        // Find another suitable worker
        assignedWorkerId = this.findBestWorkerForTask(
          subtask,
          teamSkills,
          workloadTracker
        );
      }

      if (assignedWorkerId) {
        // Get the member's name from their ID
        const assignedName = teamMembersMap[assignedWorkerId]
          ? teamMembersMap[assignedWorkerId].name
          : assignedWorkerId;

        // Assign the worker to the subtask
        subtaskAssignments[subtask.id] = assignedName;

        // Update workload tracker
        workloadTracker[assignedWorkerId].assignedHours +=
          subtask.estimatedHours || 0;
        workloadTracker[assignedWorkerId].remainingHours -=
          subtask.estimatedHours || 0;
        workloadTracker[assignedWorkerId].assignedSubtasks.push(subtask.id);
      } else {
        this.log(
          `Warning: Could not find suitable worker for subtask ${subtask.id}`
        );
      }
    });

    return subtaskAssignments;
  }

  /**
   * Balance workload by reassigning tasks if there's a significant imbalance
   * @param {Object} taskAssignments - Task assignments
   * @param {Object} subtaskAssignments - Subtask assignments
   * @param {Object} workloadTracker - Workload tracking object
   * @param {Array} tasks - Array of all tasks
   * @param {Array} subtasks - Array of all subtasks
   * @param {Object} teamMembersMap - Map of team member IDs to team member objects
   */
  balanceWorkload(
    taskAssignments,
    subtaskAssignments,
    workloadTracker,
    tasks,
    subtasks,
    teamMembersMap
  ) {
    // Get workload stats
    const stats = this.calculateWorkloadStats(workloadTracker);

    // If standard deviation is acceptable, no need to balance
    if (stats.stdDev <= 0.15 * stats.mean) {
      this.log("Workload is well-balanced, no reallocation needed", { stats });
      return;
    }

    this.log("Workload imbalance detected, attempting to rebalance", { stats });

    // Enhanced overloaded worker identification with allocation percentage consideration
    const overloaded = Object.entries(workloadTracker)
      .filter(([, data]) => {
        // Consider allocation percentage for threshold
        const effectiveThreshold =
          stats.mean * 1.2 * (data.allocationPercentage / 100);
        return data.assignedHours > effectiveThreshold;
      })
      .map(([id, data]) => ({
        id,
        overloadAmount:
          data.assignedHours - stats.mean * (data.allocationPercentage / 100),
        data,
      }))
      .sort((a, b) => b.overloadAmount - a.overloadAmount); // Sort by most overloaded first

    const underloaded = Object.entries(workloadTracker)
      .filter(([, data]) => {
        // Consider allocation percentage for threshold
        const effectiveThreshold =
          stats.mean * 0.8 * (data.allocationPercentage / 100);
        return (
          data.assignedHours < effectiveThreshold && data.remainingHours > 0
        );
      })
      .map(([id, data]) => ({
        id,
        capacityAmount: data.remainingHours,
        data,
      }))
      .sort((a, b) => b.capacityAmount - a.capacityAmount); // Sort by most capacity first

    if (overloaded.length === 0 || underloaded.length === 0) {
      this.log("Cannot rebalance: No overloaded or underloaded workers found");
      return;
    }

    // Dynamic reallocation with smart task selection
    for (const overloadedWorker of overloaded) {
      // Set a reallocation target to achieve balance
      const reallocationTarget = overloadedWorker.overloadAmount * 0.8; // Aim to reallocate 80% of overload
      let reallocatedHours = 0;

      // Get all tasks assigned to this worker, sorted by suitability for reallocation
      const assignedTaskIds = overloadedWorker.data.assignedTasks;
      const candidateTasks = assignedTaskIds
        .map((taskId) => tasks.find((t) => t.id === taskId))
        .filter((task) => task && !this.isTaskCritical(task)) // Exclude critical tasks
        .sort((a, b) => {
          // Prioritize tasks with fewer dependencies and smaller size
          const aSubtasks = subtasks.filter(
            (st) => st.parentTaskId === a.id
          ).length;
          const bSubtasks = subtasks.filter(
            (st) => st.parentTaskId === b.id
          ).length;

          // Use subtask count as primary sort criteria
          if (aSubtasks !== bSubtasks) {
            return aSubtasks - bSubtasks; // Fewer subtasks first
          }

          // Then sort by hours (smaller tasks first)
          return a.estimatedHours - b.estimatedHours;
        });

      // Process candidate tasks until we achieve target reallocation
      for (const task of candidateTasks) {
        if (reallocatedHours >= reallocationTarget) {
          break; // Stop if we've achieved the target
        }

        // Find the best underloaded worker for this specific task
        let bestMatch = null;
        let bestScore = 0;

        for (const candidate of underloaded) {
          // Skip if worker doesn't have enough capacity
          if (candidate.data.remainingHours < task.estimatedHours) {
            continue;
          }

          // Create a focused team skill profile for just this candidate
          const candidateProfile = {};
          const member = teamMembersMap[candidate.id];

          if (member) {
            candidateProfile[candidate.id] = {
              id: candidate.id,
              name: member.name,
              role: member.role,
              skills: member.skills || [],
              availability: candidate.data.totalAvailableHours,
              specialties: member.specialties || [],
            };
          }

          // Calculate match score for this specific task
          const taskSkills = this.extractTaskSkills(task);
          const skillMatchScore = this.calculateEnhancedSkillMatch(
            taskSkills,
            member.skills || [],
            candidate.data.skillProficiencies
          );

          // Calculate specialty match
          const specialtyScore = this.calculateSpecialtyMatch(
            taskSkills,
            candidate.data.specialties || []
          );

          // Calculate availability as percentage of remaining capacity
          const availabilityScore =
            candidate.data.remainingHours / candidate.data.totalAvailableHours;

          // Calculate overall match score
          const overallScore =
            skillMatchScore * 0.6 +
            specialtyScore * 0.2 +
            availabilityScore * 0.2;

          if (overallScore > bestScore) {
            bestScore = overallScore;
            bestMatch = candidate;
          }
        }

        // If we found a good match, reassign the task
        if (bestMatch && bestScore > 0.4) {
          // Only reassign if match is reasonable
          const assignedName = teamMembersMap[bestMatch.id]
            ? teamMembersMap[bestMatch.id].name
            : bestMatch.id;

          // Reassign the task
          taskAssignments[task.id] = assignedName;

          // Update workload trackers
          this.updateWorkloadAfterReassignment(
            overloadedWorker.id,
            bestMatch.id,
            task,
            subtasks,
            workloadTracker,
            subtaskAssignments,
            teamMembersMap
          );

          // Track reallocated hours
          reallocatedHours += task.estimatedHours;

          // Update capacity info for underloaded worker
          const idx = underloaded.findIndex(
            (worker) => worker.id === bestMatch.id
          );
          if (idx >= 0) {
            underloaded[idx].capacityAmount -= task.estimatedHours;
          }

          this.log(
            `Reallocated task ${task.title} from ${
              teamMembersMap[overloadedWorker.id]?.name
            } to ${assignedName}`,
            {
              taskId: task.id,
              hours: task.estimatedHours,
              matchScore: bestScore,
            }
          );
        }
      }

      // If we couldn't reallocate enough, try subtasks directly
      if (reallocatedHours < reallocationTarget * 0.5) {
        this.reallocateSubtasksDirectly(
          overloadedWorker.id,
          underloaded.map((w) => w.id),
          subtasks,
          subtaskAssignments,
          workloadTracker,
          teamMembersMap
        );
      }
    }

    // Log final balance results
    const finalStats = this.calculateWorkloadStats(workloadTracker);
    this.log("Workload rebalancing completed", {
      initial: stats,
      final: finalStats,
      improvement: ((stats.stdDev - finalStats.stdDev) / stats.stdDev) * 100,
    });
  }

  /**
   * Check if a task is critical and shouldn't be reassigned
   * @param {Object} task - Task to check
   * @returns {boolean} - True if task is critical
   */
  isTaskCritical(task) {
    // Consider tasks with specific keywords or high priority as critical
    const criticalKeywords = [
      "critical",
      "urgent",
      "essential",
      "core",
      "key",
      "foundation",
    ];
    const textToSearch = `${task.title} ${task.description}`.toLowerCase();

    // Check for critical keywords
    if (criticalKeywords.some((keyword) => textToSearch.includes(keyword))) {
      return true;
    }

    // Check for high/critical priority
    if (task.priority === "Critical" || task.priority === "High") {
      return true;
    }

    return false;
  }

  /**
   * Update workload trackers after task reassignment
   * @param {string} fromWorkerId - Worker ID to reassign from
   * @param {string} toWorkerId - Worker ID to reassign to
   * @param {Object} task - Task being reassigned
   * @param {Array} subtasks - All subtasks
   * @param {Object} workloadTracker - Workload tracking object
   * @param {Object} subtaskAssignments - Subtask assignments
   * @param {Object} teamMembersMap - Team member map
   */
  updateWorkloadAfterReassignment(
    fromWorkerId,
    toWorkerId,
    task,
    subtasks,
    workloadTracker,
    subtaskAssignments,
    teamMembersMap
  ) {
    // Update from worker tracker
    workloadTracker[fromWorkerId].assignedHours -= task.estimatedHours;
    workloadTracker[fromWorkerId].remainingHours += task.estimatedHours;
    workloadTracker[fromWorkerId].assignedTasks = workloadTracker[
      fromWorkerId
    ].assignedTasks.filter((id) => id !== task.id);

    // Add entry to work history
    if (!workloadTracker[fromWorkerId].workHistory) {
      workloadTracker[fromWorkerId].workHistory = [];
    }
    workloadTracker[fromWorkerId].workHistory.push({
      taskId: task.id,
      title: task.title,
      action: "reassigned",
      hours: task.estimatedHours,
      skills: this.extractTaskSkills(task),
      timestamp: new Date().toISOString(),
    });

    // Update to worker tracker
    workloadTracker[toWorkerId].assignedHours += task.estimatedHours;
    workloadTracker[toWorkerId].remainingHours -= task.estimatedHours;
    workloadTracker[toWorkerId].assignedTasks.push(task.id);

    // Add entry to work history
    if (!workloadTracker[toWorkerId].workHistory) {
      workloadTracker[toWorkerId].workHistory = [];
    }
    workloadTracker[toWorkerId].workHistory.push({
      taskId: task.id,
      title: task.title,
      action: "assigned",
      hours: task.estimatedHours,
      skills: this.extractTaskSkills(task),
      timestamp: new Date().toISOString(),
    });

    // Handle related subtasks
    const relatedSubtasks = subtasks.filter(
      (st) => st.parentTaskId === task.id
    );

    // Reassign related subtasks
    relatedSubtasks.forEach((subtask) => {
      // Get current assigned worker ID by looking up the name in the assignments
      const currentAssignedName = subtaskAssignments[subtask.id];
      const currentWorkerId = Object.entries(teamMembersMap).find(
        ([, member]) => member.name === currentAssignedName
      )?.[0];

      // Only reassign if currently assigned to the fromWorker
      if (currentWorkerId === fromWorkerId) {
        // Get the member's name for assignment
        const toWorkerName = teamMembersMap[toWorkerId]?.name || toWorkerId;
        subtaskAssignments[subtask.id] = toWorkerName;

        // Update workload trackers for subtask
        workloadTracker[fromWorkerId].assignedHours -=
          subtask.estimatedHours || 0;
        workloadTracker[fromWorkerId].remainingHours +=
          subtask.estimatedHours || 0;
        workloadTracker[fromWorkerId].assignedSubtasks = workloadTracker[
          fromWorkerId
        ].assignedSubtasks.filter((id) => id !== subtask.id);

        workloadTracker[toWorkerId].assignedHours +=
          subtask.estimatedHours || 0;
        workloadTracker[toWorkerId].remainingHours -=
          subtask.estimatedHours || 0;
        workloadTracker[toWorkerId].assignedSubtasks.push(subtask.id);
      }
    });
  }

  /**
   * Reallocate subtasks directly without moving parent tasks
   * @param {string} overloadedId - ID of overloaded worker
   * @param {Array} underloadedIds - IDs of underloaded workers
   * @param {Array} subtasks - All subtasks
   * @param {Object} subtaskAssignments - Subtask assignments
   * @param {Object} workloadTracker - Workload tracking object
   * @param {Object} teamMembersMap - Team member map
   */
  reallocateSubtasksDirectly(
    overloadedId,
    underloadedIds,
    subtasks,
    subtaskAssignments,
    workloadTracker,
    teamMembersMap
  ) {
    // Find subtasks assigned to overloaded worker
    const overloadedName = teamMembersMap[overloadedId]?.name;
    const assignedSubtasks = subtasks.filter(
      (st) => subtaskAssignments[st.id] === overloadedName
    );

    // Sort by smaller hours first
    assignedSubtasks.sort(
      (a, b) => (a.estimatedHours || 0) - (b.estimatedHours || 0)
    );

    // Try to reassign subtasks to underloaded workers
    for (const subtask of assignedSubtasks) {
      // Skip very small subtasks (not worth reassigning)
      if ((subtask.estimatedHours || 0) < 2) continue;

      // Find best underloaded worker for this subtask
      let bestWorkerId = null;
      let bestScore = 0;

      for (const underloadedId of underloadedIds) {
        // Skip if worker doesn't have enough capacity
        if (
          workloadTracker[underloadedId].remainingHours <
          (subtask.estimatedHours || 0)
        ) {
          continue;
        }

        const member = teamMembersMap[underloadedId];
        if (!member) continue;

        // Calculate skill match
        const subtaskSkills = this.extractTaskSkills(subtask);
        const skillMatchScore = this.calculateEnhancedSkillMatch(
          subtaskSkills,
          member.skills || [],
          workloadTracker[underloadedId].skillProficiencies || {}
        );

        if (skillMatchScore > bestScore) {
          bestScore = skillMatchScore;
          bestWorkerId = underloadedId;
        }
      }

      // Only reassign if good match found
      if (bestWorkerId && bestScore > 0.4) {
        const assignedName = teamMembersMap[bestWorkerId]?.name || bestWorkerId;

        // Reassign subtask
        subtaskAssignments[subtask.id] = assignedName;

        // Update workload trackers
        workloadTracker[overloadedId].assignedHours -=
          subtask.estimatedHours || 0;
        workloadTracker[overloadedId].remainingHours +=
          subtask.estimatedHours || 0;
        workloadTracker[overloadedId].assignedSubtasks = workloadTracker[
          overloadedId
        ].assignedSubtasks.filter((id) => id !== subtask.id);

        workloadTracker[bestWorkerId].assignedHours +=
          subtask.estimatedHours || 0;
        workloadTracker[bestWorkerId].remainingHours -=
          subtask.estimatedHours || 0;
        workloadTracker[bestWorkerId].assignedSubtasks.push(subtask.id);

        this.log(
          `Reallocated subtask ${subtask.title} from ${teamMembersMap[overloadedId]?.name} to ${assignedName}`,
          {
            subtaskId: subtask.id,
            hours: subtask.estimatedHours,
            matchScore: bestScore,
          }
        );
      }
    }
  }

  /**
   * Calculate workload statistics (mean, standard deviation, etc.)
   * @param {Object} workloadTracker - Workload tracking object
   * @returns {Object} - Statistics object
   */
  calculateWorkloadStats(workloadTracker) {
    const hours = Object.values(workloadTracker).map(
      (data) => data.assignedHours
    );

    // Calculate mean
    const mean = hours.reduce((sum, h) => sum + h, 0) / hours.length;

    // Calculate standard deviation
    const squaredDiffs = hours.map((h) => Math.pow(h - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, diff) => sum + diff, 0) / hours.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...hours),
      max: Math.max(...hours),
    };
  }

  /**
   * Generate a summary of workload allocation per worker
   * @param {Object} workloadTracker - Workload tracking object
   * @param {Object} teamMembersMap - Map of team member IDs to team member objects
   * @returns {Object} - Workload summary
   */
  generateWorkloadSummary(workloadTracker, teamMembersMap) {
    const summary = {
      workerStats: [],
      overallocatedWorkers: 0,
      underallocatedWorkers: 0,
    };

    Object.entries(workloadTracker).forEach(([workerId, data]) => {
      const utilizationPercentage = Math.min(
        100,
        Math.round((data.assignedHours / data.totalAvailableHours) * 100)
      );

      const member = teamMembersMap[workerId] || {
        name: workerId,
        role: "Unknown",
      };

      summary.workerStats.push({
        name: member.name,
        role: member.role,
        assignedHours: data.assignedHours,
        availableHours: data.totalAvailableHours,
        remainingHours: data.remainingHours,
        utilizationPercentage,
        assignedTaskCount: data.assignedTasks.length,
        assignedSubtaskCount: data.assignedSubtasks.length,
        isOverallocated: utilizationPercentage > 95,
        isUnderallocated: utilizationPercentage < 50,
      });

      if (utilizationPercentage > 95) {
        summary.overallocatedWorkers++;
      } else if (utilizationPercentage < 50) {
        summary.underallocatedWorkers++;
      }
    });

    return summary;
  }
}
