# AI Project Management Agent

An AI agent for project management that generates comprehensive project plans, task assignments, and timelines using LLM technology.

## Overview

This agent takes project information (project details, team members, timeline, tech stack, etc.) and generates a detailed project plan including:

- Project phases
- Sprint plans
- Task assignments with priorities
- Detailed product backlog
- Milestones and deliverables
- Risk management plans

## Requirements

- Node.js (v16+)
- Ollama with the Mistral model installed

## Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Make sure Ollama is running with the Mistral model:
   ```
   ollama pull mistral
   ```

## Usage

### Testing with Sample Data

Run the test manager to try different project scenarios:

```bash
# Run with default test data (basic e-commerce app)
npm test

# Run with custom project data (social media dashboard)
npm run test:custom

# Run with backlog-focused test data (task management app)
npm run test:backlog

# Run with healthcare portal project data
npm run test:multiagent

# Run all test scenarios
npm run test:all
```

### Using in Your Own Code

```javascript
import { generateAgentBasedProjectPlan } from "./src/ai/agentBasedProjectPlanGenerator.js";

const projectData = {
  projectName: "Your Project",
  projectType: "Web Application",
  projectDescription: "Description of your project...",
  projectTimeline: "2 months",
  priority: "Medium",
  techStack: ["React", "Node.js", "MongoDB"],
  teamMembers: [
    {
      id: "tm1",
      name: "Team Member 1",
      role: "Frontend Developer",
      skills: ["React", "JavaScript", "CSS"],
      availability: 40, // hours per week
      hourlyRate: 50,
    },
    // Add more team members
  ],
};

async function runProject() {
  const result = await generateAgentBasedProjectPlan(projectData);
  if (result.success) {
    console.log("Project plan:", result.plan);
    console.log("Verification results:", result.verification);
  } else {
    console.error("Error:", result.error);
    console.error("Failed at stage:", result.stageFailed);
  }
}

runProject();
```

## Project Structure

### Multi-Agent System

- `src/ai/agentBasedProjectPlanGenerator.js` - Entry point for the multi-agent system
- `src/ai/llmInterface.js` - Communicates with Ollama/Mistral
- `src/ai/agents/agentCoordinator.js` - Coordinates the workflow between specialized agents
- `src/ai/agents/baseAgent.js` - Base class for all specialized agents
- `src/ai/agents/projectInitAgent.js` - Validates and prepares initial project data
- `src/ai/agents/promptEngineeringAgent.js` - Creates optimized prompts for the LLM
- `src/ai/agents/projectOverviewAgent.js` - Generates high-level project overview
- `src/ai/agents/sprintPlanningAgent.js` - Plans sprints and assigns work
- `src/ai/agents/resourceAnalysisAgent.js` - Analyzes resource allocation and feasibility
- `src/ai/agents/taskGeneratorAgent.js` - Creates detailed tasks for each sprint
- `src/ai/agents/subtaskGeneratorAgent.js` - Breaks down tasks into smaller subtasks
- `src/ai/agents/priorityAssignmentAgent.js` - Assigns priorities to tasks and subtasks
- `src/ai/agents/workerAssignmentAgent.js` - Assigns team members to tasks and subtasks
- `src/ai/agents/dataCompilationAgent.js` - Compiles all data into structured format
- `src/ai/agents/verificationAgent.js` - Verifies plan completeness and consistency

- `src/test-manager.js` - Unified test script with multiple scenarios

## Multi-Agent Workflow Benefits

The multi-agent workflow offers significant advantages for project planning:

1. **Specialized Expertise**: Each agent focuses on a specific aspect of project planning
2. **Better Resource Allocation**: Detailed analysis of team member skills and availability
3. **Improved Task Breakdown**: Tasks are broken down into manageable subtasks
4. **Intelligent Priority Assignment**: Based on dependencies and critical path analysis
5. **Balanced Workload**: Ensures fair distribution of work among team members
6. **Comprehensive Verification**: Ensures plan completeness and consistency
7. **Modular System**: Easily extend or modify specific aspects of the planning process

## Agent Workflow Steps

1. **Project Initialization**: Validate and structure input data
2. **Prompt Engineering**: Create optimized prompts for the LLM
3. **Project Overview Generation**: Generate high-level project overview
4. **Sprint Planning**: Create sprint plan with goals and timeline
5. **Resource Analysis**: Analyze resource allocation and sprint feasibility
6. **Task Generation**: Create detailed tasks for each sprint
7. **Subtask Generation**: Break down tasks into smaller subtasks
8. **Priority Assignment**: Assign priorities based on critical path analysis
9. **Worker Assignment**: Assign team members based on skills and availability
10. **Data Compilation**: Compile all data into a structured format
11. **Verification**: Verify plan completeness and consistency

## Future Enhancements

- Support for more advanced LLMs (Claude, GPT-4, etc.)
- Integration with project management tools like JIRA, Asana, or Trello
- Web UI for inputting project data and visualizing results
- Periodic project status updates and adjustments
- Gantt chart and timeline generation
- Budget estimation and financial planning
- Risk mitigation strategies
- Automated documentation generation

## License

ISC License
