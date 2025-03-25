/**
 * resourceAnalysisAgent.js
 * Analyzes resource allocation and validates sprint feasibility
 */
import { BaseAgent } from "./baseAgent.js";

export class ResourceAnalysisAgent extends BaseAgent {
  constructor() {
    super("ResourceAnalysisAgent");
    this.temperature = 0.3; // Lower temperature for more precise calculations
  }

  /**
   * Analyze resource allocation and validate sprint feasibility
   * @param {Object} sprintPlan - Sprint plan from SprintPlanningAgent
   * @param {Array} teamMembers - Team members information
   * @returns {Promise<Object>} - Resource analysis results
   */
  async process(sprintPlan, teamMembers) {
    try {
      this.log("Starting resource analysis and feasibility validation");
      this.log("Received sprint plan with sprints", {
        totalSprints: sprintPlan.totalSprints,
        sprintCount: sprintPlan.sprints ? sprintPlan.sprints.length : 0,
      });
      this.log("Team size", {
        memberCount: teamMembers ? teamMembers.length : 0,
      });

      // Analyze resource allocation and sprint feasibility
      const resourceAnalysis = await this.analyzeResources(
        sprintPlan,
        teamMembers
      );

      this.log("Resource analysis completed successfully");
      return resourceAnalysis;
    } catch (error) {
      this.reportError(error, "resource analysis process");
    }
  }

  /**
   * Analyze resources and sprint feasibility
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Array} teamMembers - Team members information
   * @returns {Promise<Object>} - Resource analysis results
   */
  async analyzeResources(sprintPlan, teamMembers) {
    try {
      // Calculate total available man-hours and capacity per sprint
      const teamCapacity = this.calculateTeamCapacity(teamMembers);

      // Analyze sprint plan feasibility
      const sprintAnalysis = this.analyzeSprints(sprintPlan, teamCapacity);

      // Validate team skills against project requirements
      const skillGapAnalysis = await this.analyzeSkillRequirements(
        sprintPlan,
        teamMembers
      );

      // Identify potential resource constraints and bottlenecks
      const constraintsAndBottlenecks = await this.identifyConstraints(
        sprintPlan,
        teamMembers,
        sprintAnalysis,
        skillGapAnalysis
      );

      // Compile the final resource analysis
      return {
        teamCapacity,
        sprintAnalysis,
        skillGapAnalysis,
        constraintsAndBottlenecks,
        isOverallocated: sprintAnalysis.some(
          (sprint) => sprint.isOverallocated
        ),
        recommendedAdjustments: await this.generateRecommendations(
          sprintPlan,
          sprintAnalysis,
          teamMembers,
          skillGapAnalysis
        ),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.reportError(error, "analyzing resources");
    }
  }

  /**
   * Calculate the capacity of the team
   * @param {Array} teamMembers - Team member information
   * @returns {Object} - Team capacity information
   */
  calculateTeamCapacity(teamMembers) {
    if (
      !teamMembers ||
      !Array.isArray(teamMembers) ||
      teamMembers.length === 0
    ) {
      return {
        totalMembers: 0,
        totalCapacityPerSprint: 0,
        memberCapacities: [],
      };
    }

    // Assume 6 productive hours per day, 10 days per sprint (2 weeks)
    const hoursPerDay = 6;
    const daysPerSprint = 10;

    const memberCapacities = teamMembers.map((member) => {
      // Calculate capacity based on experience level
      let efficiencyFactor = 0.8; // Default efficiency

      if (typeof member.experience === "string") {
        const yearsMatch = member.experience.match(/(\d+)\s*(?:years?|yrs?)/i);
        if (yearsMatch) {
          const years = parseInt(yearsMatch[1]);
          // Adjust efficiency factor based on years of experience
          if (years < 2) efficiencyFactor = 0.6;
          else if (years < 4) efficiencyFactor = 0.8;
          else if (years < 8) efficiencyFactor = 0.9;
          else efficiencyFactor = 1.0;
        }
      }

      const capacityPerSprint = Math.floor(
        hoursPerDay * daysPerSprint * efficiencyFactor
      );

      return {
        name: member.name,
        roles: member.roles || [],
        experienceLevel: member.experience || "Unknown",
        efficiencyFactor,
        capacityPerSprint,
        skills: member.skills || [],
      };
    });

    const totalCapacityPerSprint = memberCapacities.reduce(
      (total, member) => total + member.capacityPerSprint,
      0
    );

    return {
      totalMembers: teamMembers.length,
      totalCapacityPerSprint,
      memberCapacities,
      hoursPerDay,
      daysPerSprint,
    };
  }

  /**
   * Analyze each sprint for resource feasibility
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Object} teamCapacity - Team capacity information
   * @returns {Array} - Analysis of each sprint
   */
  analyzeSprints(sprintPlan, teamCapacity) {
    if (
      !sprintPlan ||
      !sprintPlan.sprints ||
      !Array.isArray(sprintPlan.sprints)
    ) {
      return [];
    }

    const { totalCapacityPerSprint } = teamCapacity;

    return sprintPlan.sprints.map((sprint) => {
      // Estimate required hours based on deliverables
      const estimatedHours = this.estimateSprintEffort(sprint);

      const utilizationPercentage =
        totalCapacityPerSprint > 0
          ? (estimatedHours / totalCapacityPerSprint) * 100
          : 0;

      return {
        sprintId: sprint.id,
        sprintName: sprint.name,
        estimatedHours,
        availableCapacity: totalCapacityPerSprint,
        utilizationPercentage: Math.round(utilizationPercentage),
        isOverallocated: estimatedHours > totalCapacityPerSprint * 0.8, // 80% is "full" capacity
        remainingCapacity: Math.max(0, totalCapacityPerSprint - estimatedHours),
        keyDeliverables: sprint.keyDeliverables || [],
      };
    });
  }

  /**
   * Estimate the effort required for a sprint based on deliverables
   * @param {Object} sprint - Sprint information
   * @returns {number} - Estimated hours required
   */
  estimateSprintEffort(sprint) {
    // Basic estimation logic based on number and complexity of deliverables
    if (!sprint.keyDeliverables || !Array.isArray(sprint.keyDeliverables)) {
      return sprint.estimatedVelocity || 40; // Default to 40 hours if no data
    }

    // Base effort per deliverable
    const baseEffortPerDeliverable = 8; // 8 hours per deliverable on average

    // Count deliverables and estimate complexity
    let totalHours = 0;

    for (const deliverable of sprint.keyDeliverables) {
      let complexity = 1.0; // Default complexity multiplier

      // Increase complexity based on keywords in deliverable description
      const complexityKeywords = [
        "complex",
        "difficult",
        "challenging",
        "integration",
        "security",
        "performance",
        "scale",
        "optimize",
        "refactor",
        "architecture",
      ];

      for (const keyword of complexityKeywords) {
        if (deliverable.toLowerCase().includes(keyword)) {
          complexity += 0.2; // Increase complexity for each matching keyword
        }
      }

      // Cap complexity at 2.5x
      complexity = Math.min(2.5, complexity);

      // Add hours for this deliverable
      totalHours += baseEffortPerDeliverable * complexity;
    }

    // Add base sprint overhead (meetings, planning, review, etc.)
    const sprintOverhead = 16; // 16 hours of overhead per sprint

    return Math.round(totalHours + sprintOverhead);
  }

  /**
   * Analyze skill requirements and identify gaps
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Array} teamMembers - Team members information
   * @returns {Promise<Object>} - Skill gap analysis
   */
  async analyzeSkillRequirements(sprintPlan, teamMembers) {
    try {
      // Extract all required skills from sprint deliverables
      const requiredSkills = this.extractRequiredSkills(sprintPlan);

      // Extract all team skills
      const teamSkills = this.extractTeamSkills(teamMembers);

      // Find skill gaps (skills required but not available in the team)
      const missingSkills = this.findMissingSkills(requiredSkills, teamSkills);

      // Calculate skill coverage percentages
      const skillCoverage = this.calculateSkillCoverage(
        requiredSkills,
        teamSkills
      );

      // Identify critical skill gaps (high importance skills that are missing)
      const criticalSkillGaps = this.identifyCriticalSkillGaps(
        missingSkills,
        requiredSkills
      );

      return {
        requiredSkills,
        teamSkills,
        missingSkills,
        skillCoverage,
        criticalSkillGaps,
        hasSignificantGaps: criticalSkillGaps.length > 0,
        overallCoverageScore: skillCoverage.overallCoverage,
      };
    } catch (error) {
      this.log("Error analyzing skill requirements: " + error.message);
      return {
        requiredSkills: [],
        teamSkills: [],
        missingSkills: [],
        skillCoverage: { overallCoverage: 0 },
        criticalSkillGaps: [],
        hasSignificantGaps: false,
        overallCoverageScore: 0,
      };
    }
  }

  /**
   * Extract required skills from sprint deliverables
   * @param {Object} sprintPlan - Sprint plan
   * @returns {Array} - Array of required skills with importance
   */
  extractRequiredSkills(sprintPlan) {
    if (
      !sprintPlan ||
      !sprintPlan.sprints ||
      !Array.isArray(sprintPlan.sprints)
    ) {
      return [];
    }

    const skillsMap = {};

    // Technology-specific skills mapping
    const techToSkills = {
      React: ["JavaScript", "React", "Frontend", "UI Development"],
      "React Native": ["JavaScript", "React Native", "Mobile Development"],
      "Node.js": ["JavaScript", "Node.js", "Backend", "Server Development"],
      Express: ["JavaScript", "Express", "API Development", "Backend"],
      TypeScript: ["TypeScript", "Static Typing"],
      MongoDB: ["MongoDB", "NoSQL", "Database", "Data Modeling"],
      PostgreSQL: ["PostgreSQL", "SQL", "Database", "Data Modeling"],
      AWS: ["AWS", "Cloud Infrastructure", "DevOps"],
      Docker: ["Docker", "Containerization", "DevOps"],
      Kubernetes: ["Kubernetes", "Container Orchestration", "DevOps"],
      Firebase: ["Firebase", "Backend as a Service", "Real-time Database"],
      Redux: ["Redux", "State Management", "Frontend Architecture"],
      GraphQL: ["GraphQL", "API", "Data Query"],
      "REST API": ["REST", "API Development", "HTTP"],
      "CI/CD": ["CI/CD", "DevOps", "Automation"],
      Testing: ["Testing", "QA", "Quality Assurance"],
      // Add more mappings as needed
    };

    // Extract from tech stack
    if (sprintPlan.techStack && Array.isArray(sprintPlan.techStack)) {
      sprintPlan.techStack.forEach((tech) => {
        // Add the technology itself as a skill
        skillsMap[tech] = { importance: "High", count: 1 };

        // Add related skills
        const relatedSkills = techToSkills[tech] || [];
        relatedSkills.forEach((skill) => {
          if (skillsMap[skill]) {
            skillsMap[skill].count++;
          } else {
            skillsMap[skill] = { importance: "Medium", count: 1 };
          }
        });
      });
    }

    // Extract from deliverables
    sprintPlan.sprints.forEach((sprint) => {
      if (sprint.keyDeliverables && Array.isArray(sprint.keyDeliverables)) {
        sprint.keyDeliverables.forEach((deliverable) => {
          const deliverableText = deliverable.toLowerCase();

          // Check for specific skill indicators in deliverables
          const skillIndicators = {
            frontend: [
              "Frontend",
              "UI",
              "User Interface",
              "React",
              "Angular",
              "Vue",
            ],
            backend: ["Backend", "Server", "API", "Database", "Node.js"],
            database: ["Database", "SQL", "NoSQL", "Data Modeling", "Schema"],
            mobile: [
              "Mobile",
              "iOS",
              "Android",
              "React Native",
              "Swift",
              "Kotlin",
            ],
            devops: [
              "DevOps",
              "CI/CD",
              "Deployment",
              "Infrastructure",
              "Cloud",
            ],
            testing: [
              "Testing",
              "QA",
              "Quality Assurance",
              "Unit Tests",
              "Integration Tests",
            ],
            security: [
              "Security",
              "Authentication",
              "Authorization",
              "Encryption",
            ],
            "ui design": ["UI Design", "User Interface Design", "Wireframing"],
            "ux design": ["UX Design", "User Experience", "Usability"],
          };

          Object.entries(skillIndicators).forEach(([category, keywords]) => {
            if (
              keywords.some((keyword) =>
                deliverableText.includes(keyword.toLowerCase())
              )
            ) {
              keywords.forEach((skill) => {
                if (skillsMap[skill]) {
                  skillsMap[skill].count++;
                  if (skillsMap[skill].importance !== "High") {
                    skillsMap[skill].importance = "Medium";
                  }
                } else {
                  skillsMap[skill] = { importance: "Medium", count: 1 };
                }
              });
            }
          });
        });
      }
    });

    // Convert map to array
    return Object.entries(skillsMap).map(([skill, data]) => ({
      name: skill,
      importance: data.importance,
      frequency: data.count,
    }));
  }

  /**
   * Extract all skills from team members
   * @param {Array} teamMembers - Team members information
   * @returns {Array} - Array of skills with proficiency levels
   */
  extractTeamSkills(teamMembers) {
    if (!teamMembers || !Array.isArray(teamMembers)) {
      return [];
    }

    const skillsMap = {};

    teamMembers.forEach((member) => {
      // Get skills directly from member
      const memberSkills = member.skills || [];

      if (Array.isArray(memberSkills)) {
        memberSkills.forEach((skill) => {
          const skillName = typeof skill === "string" ? skill : skill.name;
          const proficiency =
            typeof skill === "string" ? "Medium" : skill.level || "Medium";

          if (skillsMap[skillName]) {
            skillsMap[skillName].count++;
            // Upgrade the proficiency if this member has higher proficiency
            if (
              this.getProficiencyValue(proficiency) >
              this.getProficiencyValue(skillsMap[skillName].proficiency)
            ) {
              skillsMap[skillName].proficiency = proficiency;
            }
          } else {
            skillsMap[skillName] = {
              proficiency,
              count: 1,
              memberIds: [member.id],
            };
          }

          // Add this member to the list of members with this skill
          if (
            skillsMap[skillName].memberIds &&
            !skillsMap[skillName].memberIds.includes(member.id)
          ) {
            skillsMap[skillName].memberIds.push(member.id);
          }
        });
      }

      // Infer skills from role
      const inferredSkills = this.inferSkillsFromRole(member.role);

      inferredSkills.forEach((skill) => {
        if (skillsMap[skill]) {
          skillsMap[skill].count++;
          skillsMap[skill].isInferred = true;
        } else {
          skillsMap[skill] = {
            proficiency: "Low",
            count: 1,
            isInferred: true,
            memberIds: [member.id],
          };
        }

        // Add this member to the list of members with this skill
        if (
          skillsMap[skill].memberIds &&
          !skillsMap[skill].memberIds.includes(member.id)
        ) {
          skillsMap[skill].memberIds.push(member.id);
        }
      });
    });

    // Convert map to array
    return Object.entries(skillsMap).map(([skill, data]) => ({
      name: skill,
      proficiency: data.proficiency,
      count: data.count,
      isInferred: data.isInferred || false,
      memberIds: data.memberIds || [],
    }));
  }

  /**
   * Helper to get numeric value for proficiency level
   * @param {string} proficiency - Proficiency level
   * @returns {number} - Numeric value
   */
  getProficiencyValue(proficiency) {
    switch (proficiency.toLowerCase()) {
      case "expert":
      case "high":
        return 3;
      case "medium":
      case "intermediate":
        return 2;
      case "low":
      case "beginner":
        return 1;
      default:
        return 0;
    }
  }

  /**
   * Infer skills from role title
   * @param {string} role - Role title
   * @returns {Array} - Array of inferred skills
   */
  inferSkillsFromRole(role) {
    if (!role) return [];

    role = role.toLowerCase();

    // Map common roles to skills
    const roleSkillMap = {
      "frontend developer": ["JavaScript", "HTML", "CSS", "Frontend"],
      frontend: ["JavaScript", "HTML", "CSS", "Frontend"],
      "backend developer": ["Backend", "API Development", "Server Development"],
      backend: ["Backend", "API Development", "Server Development"],
      "full stack developer": ["Frontend", "Backend", "Full Stack Development"],
      "full stack": ["Frontend", "Backend", "Full Stack Development"],
      "ui designer": ["UI Design", "Wireframing", "Visual Design"],
      "ux designer": ["UX Design", "User Research", "Usability Testing"],
      "ui/ux designer": [
        "UI Design",
        "UX Design",
        "Wireframing",
        "User Research",
      ],
      "ui/ux": ["UI Design", "UX Design", "Wireframing", "User Research"],
      "devops engineer": ["DevOps", "CI/CD", "Infrastructure as Code"],
      devops: ["DevOps", "CI/CD", "Infrastructure as Code"],
      "qa engineer": ["Testing", "QA", "Quality Assurance"],
      qa: ["Testing", "QA", "Quality Assurance"],
      "project manager": ["Project Management", "Planning", "Coordination"],
      "project management": ["Project Management", "Planning", "Coordination"],
      "data scientist": ["Data Science", "Machine Learning", "Data Analysis"],
      "data analyst": ["Data Analysis", "Statistics", "Reporting"],
      "mobile developer": ["Mobile Development", "App Development"],
      "ios developer": ["iOS", "Swift", "Mobile Development"],
      "android developer": ["Android", "Kotlin", "Java", "Mobile Development"],
    };

    // Find the best match
    for (const [roleKey, skills] of Object.entries(roleSkillMap)) {
      if (role.includes(roleKey)) {
        return skills;
      }
    }

    return [];
  }

  /**
   * Find skills that are required but missing in the team
   * @param {Array} requiredSkills - Required skills
   * @param {Array} teamSkills - Available team skills
   * @returns {Array} - Missing skills
   */
  findMissingSkills(requiredSkills, teamSkills) {
    if (!requiredSkills || !teamSkills) {
      return [];
    }

    const teamSkillNames = teamSkills.map((skill) => skill.name.toLowerCase());

    return requiredSkills.filter((required) => {
      // Check direct match
      if (teamSkillNames.includes(required.name.toLowerCase())) {
        return false;
      }

      // Check for partial matches (e.g., "JavaScript" would match "JavaScript React")
      return !teamSkillNames.some(
        (teamSkill) =>
          teamSkill.includes(required.name.toLowerCase()) ||
          required.name.toLowerCase().includes(teamSkill)
      );
    });
  }

  /**
   * Calculate skill coverage
   * @param {Array} requiredSkills - Required skills
   * @param {Array} teamSkills - Available team skills
   * @returns {Object} - Skill coverage analysis
   */
  calculateSkillCoverage(requiredSkills, teamSkills) {
    if (!requiredSkills || requiredSkills.length === 0) {
      return { overallCoverage: 100, coverageByImportance: {} };
    }

    const teamSkillNames = teamSkills.map((skill) => skill.name.toLowerCase());

    // Count covered skills by importance
    const coverageStats = {
      high: { required: 0, covered: 0 },
      medium: { required: 0, covered: 0 },
      low: { required: 0, covered: 0 },
    };

    requiredSkills.forEach((required) => {
      const importance = required.importance.toLowerCase();
      const importanceKey = importance in coverageStats ? importance : "medium";

      coverageStats[importanceKey].required++;

      // Check if this skill is covered by the team
      const isCovered = teamSkillNames.some(
        (teamSkill) =>
          teamSkill.includes(required.name.toLowerCase()) ||
          required.name.toLowerCase().includes(teamSkill)
      );

      if (isCovered) {
        coverageStats[importanceKey].covered++;
      }
    });

    // Calculate percentage coverage by importance
    const coverageByImportance = {
      high:
        coverageStats.high.required > 0
          ? (coverageStats.high.covered / coverageStats.high.required) * 100
          : 100,
      medium:
        coverageStats.medium.required > 0
          ? (coverageStats.medium.covered / coverageStats.medium.required) * 100
          : 100,
      low:
        coverageStats.low.required > 0
          ? (coverageStats.low.covered / coverageStats.low.required) * 100
          : 100,
    };

    // Calculate weighted overall coverage
    const totalRequired = requiredSkills.length;
    const totalCovered =
      coverageStats.high.covered +
      coverageStats.medium.covered +
      coverageStats.low.covered;

    const weights = {
      high: 0.6,
      medium: 0.3,
      low: 0.1,
    };

    const weightedSum =
      coverageByImportance.high * weights.high +
      coverageByImportance.medium * weights.medium +
      coverageByImportance.low * weights.low;

    const weightTotal =
      (coverageStats.high.required > 0 ? weights.high : 0) +
      (coverageStats.medium.required > 0 ? weights.medium : 0) +
      (coverageStats.low.required > 0 ? weights.low : 0);

    const overallCoverage = weightTotal > 0 ? weightedSum / weightTotal : 100;

    return {
      overallCoverage: Math.round(overallCoverage),
      coverageByImportance,
      stats: coverageStats,
      totalRequired,
      totalCovered,
    };
  }

  /**
   * Identify critical skill gaps that should be addressed
   * @param {Array} missingSkills - Missing skills
   * @param {Array} requiredSkills - Required skills with importance
   * @returns {Array} - Critical skill gaps
   */
  identifyCriticalSkillGaps(missingSkills, requiredSkills) {
    if (!missingSkills || missingSkills.length === 0) {
      return [];
    }

    // Get full details of missing skills including importance
    const missingWithDetails = missingSkills.map((missing) => {
      const details =
        requiredSkills.find((req) => req.name === missing.name) || {};
      return {
        ...missing,
        importance: details.importance || missing.importance || "Medium",
        frequency: details.frequency || missing.frequency || 1,
      };
    });

    // Filter to critical gaps only (high importance or frequently needed)
    return missingWithDetails
      .filter((skill) => skill.importance === "High" || skill.frequency > 2)
      .map((skill) => ({
        skill: skill.name,
        importance: skill.importance,
        frequency: skill.frequency,
        mitigation: this.suggestSkillGapMitigation(skill.name),
      }));
  }

  /**
   * Suggest mitigation strategies for skill gaps
   * @param {string} skillName - Name of the missing skill
   * @returns {string} - Suggested mitigation strategy
   */
  suggestSkillGapMitigation(skillName) {
    const strategies = [
      `Consider hiring a contractor with ${skillName} expertise for the project duration.`,
      `Provide training to existing team members in ${skillName}.`,
      `Consider simplifying requirements that depend heavily on ${skillName}.`,
      `Look for alternative technologies that align better with the team's existing skill set.`,
      `Allocate additional time for learning and implementation of ${skillName}.`,
    ];

    // Choose appropriate strategy based on skill
    if (
      skillName.toLowerCase().includes("devops") ||
      skillName.toLowerCase().includes("infrastructure") ||
      skillName.toLowerCase().includes("cloud")
    ) {
      return strategies[0]; // Contractors are often used for DevOps
    }

    if (
      skillName.toLowerCase().includes("design") ||
      skillName.toLowerCase().includes("ux") ||
      skillName.toLowerCase().includes("ui")
    ) {
      return strategies[0]; // Contractors are often used for design
    }

    // Default to training for most software skills
    return strategies[1];
  }

  /**
   * Identify potential resource constraints and bottlenecks
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Array} teamMembers - Team member information
   * @param {Array} sprintAnalysis - Results of sprint analysis
   * @param {Object} skillGapAnalysis - Results of skill gap analysis
   * @returns {Promise<Object>} - Constraints and bottlenecks
   */
  async identifyConstraints(
    sprintPlan,
    teamMembers,
    sprintAnalysis,
    skillGapAnalysis
  ) {
    try {
      const prompt = this.createConstraintsPrompt(
        sprintPlan,
        teamMembers,
        sprintAnalysis,
        skillGapAnalysis
      );

      const response = await this.queryLLM(prompt, {
        temperature: this.temperature,
        maxTokens: 2000,
      });

      // Parse the LLM response into a structured constraints object
      return this.parseConstraintsResponse(response);
    } catch (error) {
      this.log("Error identifying constraints: " + error.message);
      return {
        skillGaps: skillGapAnalysis?.criticalSkillGaps || [],
        timeConstraints: [],
        resourceBottlenecks: [],
        riskAreas: [],
      };
    }
  }

  /**
   * Create a prompt for identifying constraints and bottlenecks
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Array} teamMembers - Team members information
   * @param {Array} sprintAnalysis - Results of sprint analysis
   * @param {Object} skillGapAnalysis - Results of skill gap analysis
   * @returns {string} - Formatted prompt
   */
  createConstraintsPrompt(
    sprintPlan,
    teamMembers,
    sprintAnalysis,
    skillGapAnalysis
  ) {
    // Format overallocated sprints
    const overallocatedSprints = sprintAnalysis
      .filter((sprint) => sprint.isOverallocated)
      .map(
        (sprint) =>
          `${sprint.sprintName}: ${sprint.utilizationPercentage}% utilization (${sprint.estimatedHours} estimated hours vs ${sprint.availableCapacity} available)`
      )
      .join("\n");

    // Format team skills
    const teamSkills = teamMembers
      .map((member) => {
        const skills = member.skills
          ? Array.isArray(member.skills)
            ? member.skills.join(", ")
            : member.skills
          : "No specific skills listed";
        return `${member.name}: ${skills}`;
      })
      .join("\n");

    // Format skill gap information
    const skillGapInfo =
      skillGapAnalysis?.criticalSkillGaps?.length > 0
        ? `Critical Skill Gaps:\n${skillGapAnalysis.criticalSkillGaps
            .map((gap) => `- ${gap.skill} (${gap.importance} importance)`)
            .join("\n")}`
        : "No critical skill gaps identified.";

    const skillCoverageInfo = skillGapAnalysis?.overallCoverageScore
      ? `Overall skill coverage: ${skillGapAnalysis.overallCoverageScore}%`
      : "";

    return `
As a resource analysis expert, identify constraints and bottlenecks for this project:

SPRINT PLAN OVERVIEW:
Total Sprints: ${sprintPlan.totalSprints}
Sprint Duration: ${sprintPlan.sprintDuration}

TEAM COMPOSITION:
${teamMembers
  .map(
    (m) =>
      `${m.name} (${
        m.roles
          ? Array.isArray(m.roles)
            ? m.roles.join(", ")
            : m.roles
          : "No role specified"
      })`
  )
  .join("\n")}

TEAM SKILLS:
${teamSkills}

SKILL ANALYSIS:
${skillCoverageInfo}
${skillGapInfo}

SPRINT ANALYSIS:
${sprintAnalysis
  .map(
    (s) =>
      `${s.sprintName}: ${s.utilizationPercentage}% utilization (${s.estimatedHours} hours estimated)`
  )
  .join("\n")}

OVERALLOCATED SPRINTS:
${overallocatedSprints || "None"}

Based on this information, please identify:

1. Skill gaps: Areas where the team might lack necessary skills for deliverables
2. Time constraints: Sprints or deliverables that may face time pressure
3. Resource bottlenecks: Team members who might become overloaded
4. Risk areas: Specific deliverables or phases at higher risk of delays

Please provide your response in JSON format:
{
  "skillGaps": [
    {"area": "skill area", "impact": "impact description", "mitigation": "suggestion"}
  ],
  "timeConstraints": [
    {"sprint": "sprint name", "constraint": "constraint description", "recommendation": "recommendation"}
  ],
  "resourceBottlenecks": [
    {"resource": "resource name", "bottleneck": "bottleneck description", "solution": "possible solution"}
  ],
  "riskAreas": [
    {"area": "risk area", "risk": "risk description", "mitigation": "mitigation approach"}
  ]
}
`;
  }

  /**
   * Parse the constraints response from the LLM
   * @param {string} response - LLM response
   * @returns {Object} - Structured constraints information
   */
  parseConstraintsResponse(response) {
    try {
      // Try to extract and parse JSON from the response
      const jsonMatch =
        response.match(/```json\s*([\s\S]*?)\s*```/) ||
        response.match(/```\s*([\s\S]*?)\s*```/) ||
        response.match(/({[\s\S]*})/);

      const jsonText = jsonMatch ? jsonMatch[1] : response;
      const parsedResponse = JSON.parse(jsonText);

      return {
        skillGaps: parsedResponse.skillGaps || [],
        timeConstraints: parsedResponse.timeConstraints || [],
        resourceBottlenecks: parsedResponse.resourceBottlenecks || [],
        riskAreas: parsedResponse.riskAreas || [],
      };
    } catch (error) {
      this.log("Error parsing constraints response: " + error.message);

      // Return a structured object with placeholder data
      return {
        skillGaps: [],
        timeConstraints: [],
        resourceBottlenecks: [],
        riskAreas: [],
        rawResponse: response,
      };
    }
  }

  /**
   * Generate recommendations for resource allocation
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Array} sprintAnalysis - Results of sprint analysis
   * @param {Array} teamMembers - Team member information
   * @param {Object} skillGapAnalysis - Results of skill gap analysis
   * @returns {Promise<Array>} - Recommended adjustments
   */
  async generateRecommendations(
    sprintPlan,
    sprintAnalysis,
    teamMembers,
    skillGapAnalysis
  ) {
    try {
      // Check if we need recommendations (any overallocated sprints?)
      const needsRecommendations = sprintAnalysis.some(
        (sprint) => sprint.isOverallocated
      );

      if (!needsRecommendations) {
        return [
          {
            type: "confirmation",
            description:
              "All sprints appear to have adequate resources. No adjustments needed.",
          },
        ];
      }

      // Create a prompt for recommendations
      const prompt = this.createRecommendationsPrompt(
        sprintPlan,
        sprintAnalysis,
        teamMembers,
        skillGapAnalysis
      );

      const response = await this.queryLLM(prompt, {
        temperature: 0.4,
        maxTokens: 2000,
      });

      // Parse the LLM response
      return this.parseRecommendationsResponse(response);
    } catch (error) {
      this.log("Error generating recommendations: " + error.message);
      return [
        {
          type: "error",
          description: "Failed to generate recommendations due to an error.",
        },
      ];
    }
  }

  /**
   * Create a prompt for generating recommendations
   * @param {Object} sprintPlan - Sprint plan data
   * @param {Array} sprintAnalysis - Results of sprint analysis
   * @param {Array} teamMembers - Team member information
   * @param {Object} skillGapAnalysis - Results of skill gap analysis
   * @returns {string} - Formatted prompt
   */
  createRecommendationsPrompt(
    sprintPlan,
    sprintAnalysis,
    teamMembers,
    skillGapAnalysis
  ) {
    // Format overallocated sprints
    const overallocatedSprints = sprintAnalysis
      .filter((sprint) => sprint.isOverallocated)
      .map((sprint) => {
        const sprintInfo = sprintPlan.sprints.find(
          (s) => s.id === sprint.sprintId
        );
        return `
Sprint: ${sprint.sprintName}
Utilization: ${sprint.utilizationPercentage}% 
Estimated Hours: ${sprint.estimatedHours}
Available Capacity: ${sprint.availableCapacity}
Deliverables: ${sprint.keyDeliverables.join(", ")}
Goal: ${sprintInfo ? sprintInfo.goal : "Unknown"}
        `;
      })
      .join("\n");

    return `
As a project management expert, recommend adjustments for resource allocation in this project:

SPRINT ANALYSIS:
${sprintAnalysis
  .map(
    (s) =>
      `${s.sprintName}: ${s.utilizationPercentage}% utilization (${s.estimatedHours} hours estimated vs ${s.availableCapacity} available)`
  )
  .join("\n")}

OVERALLOCATED SPRINTS:
${overallocatedSprints}

TEAM COMPOSITION:
${teamMembers
  .map(
    (m) =>
      `${m.name} (${
        m.roles
          ? Array.isArray(m.roles)
            ? m.roles.join(", ")
            : m.roles
          : "No role specified"
      })`
  )
  .join("\n")}

Based on this information, please recommend adjustments to improve resource allocation. Consider:
1. Redistributing deliverables between sprints
2. Adjusting sprint durations or scope
3. Identifying deliverables that could be descoped or simplified
4. Alternative team compositions or external resources

Please provide your response in JSON format:
{
  "recommendations": [
    {
      "type": "redistribution"|"scope_adjustment"|"team_adjustment"|"external_resources"|"other",
      "sprintAffected": "sprint name",
      "description": "detailed description of the recommendation",
      "impact": "potential impact of this change",
      "priority": "high"|"medium"|"low"
    }
  ]
}
`;
  }

  /**
   * Parse the recommendations response from the LLM
   * @param {string} response - LLM response
   * @returns {Array} - Structured recommendations
   */
  parseRecommendationsResponse(response) {
    try {
      // Try to extract and parse JSON from the response
      const jsonMatch =
        response.match(/```json\s*([\s\S]*?)\s*```/) ||
        response.match(/```\s*([\s\S]*?)\s*```/) ||
        response.match(/({[\s\S]*})/);

      const jsonText = jsonMatch ? jsonMatch[1] : response;
      const parsedResponse = JSON.parse(jsonText);

      if (
        parsedResponse.recommendations &&
        Array.isArray(parsedResponse.recommendations)
      ) {
        return parsedResponse.recommendations;
      }

      throw new Error("Invalid response format");
    } catch (error) {
      this.log("Error parsing recommendations response: " + error.message);

      // Create a basic recommendation from the raw text
      return [
        {
          type: "raw_text",
          description:
            "Failed to parse structured recommendations. Raw suggestion follows:",
          rawText: response,
        },
      ];
    }
  }
}
