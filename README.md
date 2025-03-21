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

# Run all test scenarios
npm run test:all
```

### Using in Your Own Code

```javascript
import { generateAIProjectPlan } from "./src/ai/projectPlanGenerator.js";

const projectData = {
  projectName: "Your Project",
  projectType: "Web Application",
  projectDescription: "Description of your project...",
  projectTimeline: "2 months",
  priority: "Medium",
  techStack: ["React", "Node.js", "MongoDB"],
  teamMembers: [
    {
      name: "Team Member 1",
      roles: ["Frontend"],
      experience: "2 years",
    },
    // Add more team members
  ],
};

async function runAgent() {
  const result = await generateAIProjectPlan(projectData);
  if (result.success) {
    console.log("Project plan:", result.plan);
  } else {
    console.error("Error:", result.error);
  }
}

runAgent();
```

## Project Structure

- `src/ai/inputParser.js` - Validates and formats project data
- `src/ai/promptEngineer.js` - Creates structured prompts for the LLM
- `src/ai/llmInterface.js` - Communicates with Ollama/Mistral
- `src/ai/responseProcessor.js` - Processes LLM responses into structured format
- `src/ai/projectPlanGenerator.js` - Main controller orchestrating the workflow
- `src/test-manager.js` - Unified test script with multiple scenarios

## Future Enhancements

- Enhanced parsing of LLM responses for more structured data
- Support for more advanced LLMs (Claude, GPT-4, etc.)
- Integration with project management tools
- Web UI for inputting project data
- Periodic project status updates and adjustments

## License

ISC License
