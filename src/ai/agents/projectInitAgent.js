/**
 * projectInitAgent.js
 * Handles project initialization and validation of input data
 */
import { BaseAgent } from "./baseAgent.js";

export class ProjectInitAgent extends BaseAgent {
  constructor() {
    super("ProjectInitAgent");
  }

  /**
   * Process and validate initial project data
   * @param {Object} initialData - Raw project data from client
   * @returns {Promise<Object>} - Validated and structured project data
   */
  async process(initialData) {
    try {
      this.log("Processing initial project data");

      // Validate required fields
      this.validateRequiredFields(initialData);

      // Format and structure the project data
      const formattedData = this.formatProjectData(initialData);

      // Validate team size vs project complexity
      this.validateTeamSizeVsComplexity(formattedData);

      this.log("Project initialization completed successfully");
      return formattedData;
    } catch (error) {
      this.reportError(error, "processing initial project data");
    }
  }

  /**
   * Validate required fields in the project data
   * @param {Object} data - Project data to validate
   * @throws {Error} If required fields are missing or invalid
   */
  validateRequiredFields(data) {
    const requiredFields = ["projectName", "projectTimeline"];

    const missingFields = requiredFields.filter((field) => !data[field]);

    if (missingFields.length > 0) {
      throw new Error(
        `Missing required project information: ${missingFields.join(", ")}`
      );
    }

    // Validate team members if provided
    if (
      data.teamMembers &&
      (!Array.isArray(data.teamMembers) || data.teamMembers.length === 0)
    ) {
      throw new Error("Team members must be a non-empty array");
    }

    // Enhanced validation for project timeline format
    this.validateProjectTimeline(data.projectTimeline);
  }

  /**
   * Validate project timeline format and reasonableness
   * @param {string} timeline - Project timeline string
   * @throws {Error} If timeline format is invalid or duration is unreasonable
   */
  validateProjectTimeline(timeline) {
    if (!timeline) return;

    // Strictly enforce timeline format
    const timelinePattern = /^(\d+)\s*(day|week|month|year)s?$/i;
    const match = timeline.match(timelinePattern);

    if (!match) {
      throw new Error(
        `Invalid project timeline format: "${timeline}". Expected format: "X days/weeks/months/years"`
      );
    }

    // Extract duration and unit for reasonableness check
    const duration = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    // Convert duration to days for reasonableness check
    let durationInDays;
    switch (unit) {
      case "day":
        durationInDays = duration;
        break;
      case "week":
        durationInDays = duration * 7;
        break;
      case "month":
        durationInDays = duration * 30;
        break;
      case "year":
        durationInDays = duration * 365;
        break;
    }

    // Check for unreasonable durations
    if (durationInDays < 7) {
      throw new Error(
        `Project duration too short: ${timeline}. Minimum recommended duration is 1 week.`
      );
    }

    if (durationInDays > 730) {
      throw new Error(
        `Project duration too long: ${timeline}. Maximum recommended duration is 2 years. Consider breaking into smaller projects.`
      );
    }

    // Return normalized timeline information for use elsewhere
    return {
      value: duration,
      unit: unit,
      durationInDays: durationInDays,
    };
  }

  /**
   * Format and structure the project data
   * @param {Object} data - Raw project data
   * @returns {Object} - Formatted project data
   */
  formatProjectData(data) {
    // Format team members for easier processing
    const formattedTeamMembers = Array.isArray(data.teamMembers)
      ? data.teamMembers.map((member) => ({
          id: member.id || this.generateMemberId(member.name),
          name: member.name,
          roles: Array.isArray(member.roles) ? member.roles : [member.roles],
          experience: member.experience || "Not specified",
          skills: member.skills || [],
          availability: this.calculateAvailability(member),
        }))
      : [];

    return {
      projectId: data.projectId || this.generateProjectId(data.projectName),
      projectName: data.projectName,
      projectType: data.projectType || "Not specified",
      teamSize: formattedTeamMembers.length,
      teamMembers: formattedTeamMembers,
      projectDescription: data.projectDescription || "Not specified",
      projectTimeline: data.projectTimeline,
      techStack: Array.isArray(data.techStack)
        ? data.techStack
        : [data.techStack].filter(Boolean),
      priority: data.priority || "Medium",
      constraints: data.constraints || [],
      // Additional metadata
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: data.userId || "system",
        lastModified: new Date().toISOString(),
      },
    };
  }

  /**
   * Generate a unique ID for a project
   * @param {string} projectName - Name of the project
   * @returns {string} - Generated project ID
   */
  generateProjectId(projectName) {
    const normalized = projectName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const timestamp = Date.now().toString(36);
    return `proj-${normalized.substring(0, 8)}-${timestamp}`;
  }

  /**
   * Generate a unique ID for a team member
   * @param {string} memberName - Name of the team member
   * @returns {string} - Generated member ID
   */
  generateMemberId(memberName) {
    const normalized = memberName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const randomStr = Math.random().toString(36).substring(2, 6);
    return `user-${normalized.substring(0, 5)}-${randomStr}`;
  }

  /**
   * Calculate team member availability based on data or simulate if not provided
   * @param {Object} member - Team member data
   * @returns {Object} - Availability data
   */
  calculateAvailability(member) {
    // If availability is explicitly provided with full details, use it directly
    if (
      member.availability &&
      typeof member.availability === "object" &&
      (member.availability.schedule || member.availability.timeOff)
    ) {
      return member.availability;
    }

    // If only hours per week is specified as a number
    const baseHoursPerWeek =
      typeof member.availability === "number" ? member.availability : 40;

    // Calculate project start and end dates from project timeline (if available)
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of today

    // Default to 3 months if not specified
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 90);

    // Generate default working schedule
    const defaultSchedule = this.generateDefaultSchedule(baseHoursPerWeek);

    // Process time off if provided
    const timeOff = member.timeOff || [];

    // Process allocation percentage changes over time if provided
    const allocationChanges = member.allocationChanges || [];

    // Process project history if available
    const projectHistory = member.projectHistory || [];

    return {
      baseHoursPerWeek,
      schedule: defaultSchedule,
      timeOff: this.normalizeTimeOff(timeOff),
      allocationChanges: this.normalizeAllocationChanges(allocationChanges),
      projectHistory: this.normalizeProjectHistory(projectHistory),
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      skills: this.extractSkillsFromHistory(projectHistory, member.skills),
    };
  }

  /**
   * Generate a default weekly schedule based on hours per week
   * @param {number} hoursPerWeek - Hours per week
   * @returns {Object} - Default schedule
   */
  generateDefaultSchedule(hoursPerWeek) {
    // Default to a standard 5-day work week
    const daysPerWeek = 5;
    const hoursPerDay = hoursPerWeek / daysPerWeek;

    return {
      Monday: { available: true, hours: hoursPerDay },
      Tuesday: { available: true, hours: hoursPerDay },
      Wednesday: { available: true, hours: hoursPerDay },
      Thursday: { available: true, hours: hoursPerDay },
      Friday: { available: true, hours: hoursPerDay },
      Saturday: { available: false, hours: 0 },
      Sunday: { available: false, hours: 0 },
    };
  }

  /**
   * Normalize time off entries to a standard format
   * @param {Array} timeOff - Time off entries
   * @returns {Array} - Normalized time off entries
   */
  normalizeTimeOff(timeOff) {
    if (!Array.isArray(timeOff)) return [];

    return timeOff
      .map((entry) => {
        // Ensure dates are in proper format
        const start = entry.start ? new Date(entry.start) : null;
        const end = entry.end ? new Date(entry.end) : null;

        return {
          start: start && !isNaN(start) ? start.toISOString() : null,
          end: end && !isNaN(end) ? end.toISOString() : null,
          type: entry.type || "vacation", // vacation, sick, personal, etc.
          description: entry.description || "",
          fullDay: entry.fullDay !== false, // default to full day
        };
      })
      .filter((entry) => entry.start && entry.end); // Only keep valid entries
  }

  /**
   * Normalize allocation changes to a standard format
   * @param {Array} changes - Allocation changes
   * @returns {Array} - Normalized allocation changes
   */
  normalizeAllocationChanges(changes) {
    if (!Array.isArray(changes)) return [];

    return changes
      .map((change) => {
        // Ensure dates are in proper format
        const effectiveDate = change.effectiveDate
          ? new Date(change.effectiveDate)
          : null;

        return {
          effectiveDate:
            effectiveDate && !isNaN(effectiveDate)
              ? effectiveDate.toISOString()
              : null,
          allocationPercentage:
            typeof change.allocationPercentage === "number"
              ? Math.min(100, Math.max(0, change.allocationPercentage))
              : 100, // 0-100%
          reason: change.reason || "Unknown",
        };
      })
      .filter((change) => change.effectiveDate); // Only keep valid entries
  }

  /**
   * Normalize project history to a standard format
   * @param {Array} history - Project history entries
   * @returns {Array} - Normalized project history
   */
  normalizeProjectHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
      .map((project) => {
        // Ensure dates are in proper format
        const startDate = project.startDate
          ? new Date(project.startDate)
          : null;
        const endDate = project.endDate ? new Date(project.endDate) : null;

        return {
          projectName: project.projectName || "Unknown Project",
          role: project.role || "Team Member",
          startDate:
            startDate && !isNaN(startDate) ? startDate.toISOString() : null,
          endDate: endDate && !isNaN(endDate) ? endDate.toISOString() : null,
          skills: Array.isArray(project.skills) ? project.skills : [],
          description: project.description || "",
          performanceRating: project.performanceRating || null,
        };
      })
      .filter((project) => project.startDate); // Only keep valid entries
  }

  /**
   * Extract skills from project history to enhance skill proficiency data
   * @param {Array} projectHistory - Project history entries
   * @param {Array} existingSkills - Existing skills array
   * @returns {Array} - Enhanced skills with proficiency data
   */
  extractSkillsFromHistory(projectHistory, existingSkills) {
    // If no project history, return existing skills unchanged
    if (!Array.isArray(projectHistory) || projectHistory.length === 0) {
      return existingSkills || [];
    }

    // Create a skill map with count of projects using each skill
    const skillMap = {};

    // Start with existing skills
    if (Array.isArray(existingSkills)) {
      existingSkills.forEach((skill) => {
        const skillName = typeof skill === "string" ? skill : skill.name;
        const proficiency = typeof skill === "string" ? null : skill.level;

        skillMap[skillName] = {
          name: skillName,
          level: proficiency || "Medium",
          count: 0,
          projects: [],
        };
      });
    }

    // Add skills from project history
    projectHistory.forEach((project) => {
      if (!Array.isArray(project.skills)) return;

      project.skills.forEach((skill) => {
        const skillName = typeof skill === "string" ? skill : skill.name;

        if (!skillMap[skillName]) {
          skillMap[skillName] = {
            name: skillName,
            level: "Medium", // Default level
            count: 0,
            projects: [],
          };
        }

        skillMap[skillName].count++;
        skillMap[skillName].projects.push(project.projectName);

        // Increase level based on usage frequency
        if (skillMap[skillName].count > 3) {
          skillMap[skillName].level = "Expert";
        } else if (skillMap[skillName].count > 1) {
          skillMap[skillName].level = "High";
        }
      });
    });

    // Convert map back to array
    return Object.values(skillMap);
  }

  /**
   * Validate team size against project complexity
   * @param {Object} projectData - Formatted project data
   * @throws {Error} If team size is inadequate for project complexity
   */
  validateTeamSizeVsComplexity(projectData) {
    // Skip if no team members provided
    if (!projectData.teamMembers || projectData.teamMembers.length === 0) {
      return;
    }

    // Calculate project complexity score
    const complexityScore = this.calculateProjectComplexity(projectData);

    // Calculate minimum recommended team size based on complexity
    const minRecommendedTeamSize = this.getRecommendedTeamSize(complexityScore);

    // Store complexity metadata for use by other agents
    projectData.metadata.complexityScore = complexityScore;
    projectData.metadata.recommendedTeamSize = minRecommendedTeamSize;

    // Check if team size is adequate
    if (projectData.teamMembers.length < minRecommendedTeamSize) {
      // Generate a warning instead of an error to allow proceeding with inadequate team
      this.log(
        `Warning: Team size (${projectData.teamMembers.length}) may be inadequate for project complexity. Recommended minimum: ${minRecommendedTeamSize} members.`,
        { complexityScore, currentTeamSize: projectData.teamMembers.length }
      );

      // Add risk information to project data
      if (!projectData.risks) projectData.risks = [];
      projectData.risks.push({
        category: "Resource",
        title: "Inadequate Team Size",
        description: `Current team size (${projectData.teamMembers.length}) is below the recommended minimum (${minRecommendedTeamSize}) for a project of this complexity.`,
        mitigation:
          "Consider adding more team members or reducing project scope.",
        impact: "High",
        probability: "High",
      });
    }
  }

  /**
   * Calculate project complexity based on various factors
   * @param {Object} projectData - Project data
   * @returns {number} - Complexity score (1-10)
   */
  calculateProjectComplexity(projectData) {
    let score = 0;

    // Factor 1: Timeline length
    const timelineMatch = projectData.projectTimeline.match(
      /(\d+)\s*(day|week|month|year)s?/i
    );
    if (timelineMatch) {
      const value = parseInt(timelineMatch[1]);
      const unit = timelineMatch[2].toLowerCase();

      // Convert to months for scoring
      let durationInMonths = 0;
      switch (unit) {
        case "day":
          durationInMonths = value / 30;
          break;
        case "week":
          durationInMonths = value / 4.3;
          break;
        case "month":
          durationInMonths = value;
          break;
        case "year":
          durationInMonths = value * 12;
          break;
      }

      // Score based on duration (longer projects are more complex)
      if (durationInMonths <= 1) score += 1;
      else if (durationInMonths <= 3) score += 2;
      else if (durationInMonths <= 6) score += 3;
      else if (durationInMonths <= 12) score += 4;
      else score += 5;
    }

    // Factor 2: Tech stack complexity
    if (projectData.techStack) {
      // More technologies generally means more complexity
      score += Math.min(3, projectData.techStack.length / 2);

      // Check for complex technologies
      const complexTechs = [
        "AI",
        "Machine Learning",
        "Blockchain",
        "Microservices",
        "Kubernetes",
        "Distributed Systems",
        "Real-time",
      ];
      const hasComplexTech = projectData.techStack.some((tech) =>
        complexTechs.some((complex) =>
          tech.toLowerCase().includes(complex.toLowerCase())
        )
      );

      if (hasComplexTech) score += 1;
    }

    // Factor 3: Project description complexity
    if (projectData.projectDescription) {
      const description = projectData.projectDescription.toLowerCase();
      const complexityKeywords = [
        "complex",
        "integration",
        "multiple",
        "secure",
        "scalable",
        "high performance",
        "distributed",
      ];

      // Count complexity keywords in description
      const keywordCount = complexityKeywords.filter((keyword) =>
        description.includes(keyword)
      ).length;

      score += Math.min(2, keywordCount / 2);
    }

    // Normalize score to 1-10 range
    return Math.max(1, Math.min(10, score));
  }

  /**
   * Get recommended minimum team size based on project complexity
   * @param {number} complexityScore - Project complexity score (1-10)
   * @returns {number} - Recommended minimum team size
   */
  getRecommendedTeamSize(complexityScore) {
    // Simple mapping from complexity score to minimum team size
    if (complexityScore <= 2) return 1; // Very simple projects
    if (complexityScore <= 4) return 2; // Simple projects
    if (complexityScore <= 6) return 3; // Moderate complexity
    if (complexityScore <= 8) return 5; // Complex projects
    return 7; // Very complex projects
  }
}
