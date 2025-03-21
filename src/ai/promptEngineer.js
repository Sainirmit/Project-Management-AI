/**
 * promptEngineer.js
 * Creates optimized prompts for the LLM based on parsed project data
 */

/**
 * Creates a well-structured project plan prompt
 * @param {Object} parsedData - Validated and formatted project data
 * @returns {string} - Optimized prompt for the LLM
 */
export function createProjectPlanPrompt(parsedData) {
  // Create a structured, detailed prompt
  return `
You are ProjectManagerGPT, an expert AI project manager with 15+ years of experience managing software development projects.

# PROJECT DETAILS
- Project Name: ${parsedData.projectName}
- Project Type: ${parsedData.projectType}
- Project Timeline: ${parsedData.projectTimeline}
- Project Priority: ${parsedData.priority}
- Tech Stack: ${parsedData.techStack.join(", ")}

# TEAM COMPOSITION
Total Team Size: ${parsedData.teamSize}
${parsedData.teamMembers
  .map(
    (member) => `
- ${member.name}
  - Roles: ${member.roles.join(", ")}
  - Experience: ${member.experience}
`
  )
  .join("")}

# PROJECT DESCRIPTION
${parsedData.projectDescription}

# TASK
Create a comprehensive project plan for the team with the following:

1. Break down the project into logical phases
2. Create weekly sprints with specific goals
3. Create a detailed product backlog with tasks and user stories
4. Assign tasks to team members based on their roles and experience
5. Create detailed descriptions for each task, including implementation guidance
6. Assign priorities (High, Medium, Low) to each task
7. Estimate time for each task
8. Assign tasks to specific sprints
9. Identify potential risks and mitigation strategies
10. Set up clear milestones and deliverables
11. Include testing and review processes

Your response should be detailed, practical, and structured in a way that can be directly implemented. Format the output as follows:

## Project Overview
[Brief summary and approach]

## Project Phases
[List each phase with goals and timeline]

## Sprint Plan
[Detailed weekly sprint breakdown]

## Product Backlog
[Detailed list of tasks with the following for each task:
- Task ID and Title
- Description
- Implementation Guidance
- Assigned To
- Priority (High, Medium, Low)
- Estimated Hours
- Sprint Assignment
- Dependencies (if any)]

## Task Assignments
[Tasks assigned to specific team members with estimated completion times]

## Milestones & Deliverables
[Key milestones with dates]

## Risk Management
[Potential risks and mitigation plans]

Remember to consider the technical stack and assign tasks that align with each team member's expertise. Ensure that the backlog items are specific, measurable, and actionable.
`;
}
