/**
 * Project Management AI Agent - Entry Point
 *
 * This file serves as the main entry point for the Project Management AI Agent.
 * It provides access to the main functionality and runs the test manager.
 */

// Export the main functionality for external use
export { generateAIProjectPlan } from "./src/ai/projectPlanGenerator.js";

// Import and run the consolidated test manager
import "./src/test-manager.js";

// Note: In a production environment, this would be replaced with proper API endpoints
// or integration with the frontend application.

console.log("AI Project Management Agent");
console.log("==========================");
console.log("Running the test manager...");
