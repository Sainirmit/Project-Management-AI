/**
 * inputParser.js
 * Formats frontend data into a structure for prompt engineering
 */

/**
 * Validates and formats project data for prompt creation
 * @param {Object} projectData - Raw project data from the frontend
 * @returns {Object} - Formatted and validated project data
 */
export function parseProjectData(projectData) {
  // Validate required fields
  if (!projectData.projectName || !projectData.projectTimeline) {
    throw new Error("Missing required project information");
  }

  // Format team members for easier prompt inclusion
  const formattedTeamMembers = projectData.teamMembers.map((member) => ({
    name: member.name,
    roles: Array.isArray(member.roles) ? member.roles : [member.roles],
    experience: member.experience || "Not specified",
  }));

  return {
    projectName: projectData.projectName,
    projectType: projectData.projectType || "Not specified",
    teamSize: formattedTeamMembers.length,
    teamMembers: formattedTeamMembers,
    projectDescription: projectData.projectDescription || "Not specified",
    projectTimeline: projectData.projectTimeline,
    techStack: Array.isArray(projectData.techStack)
      ? projectData.techStack
      : [projectData.techStack],
    priority: projectData.priority || "Medium",
  };
}
