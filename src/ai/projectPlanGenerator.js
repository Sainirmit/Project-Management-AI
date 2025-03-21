/**
 * projectPlanGenerator.js
 * Main controller for the AI Project Management Agent
 */
import { parseProjectData } from "./inputParser.js";
import { createProjectPlanPrompt } from "./promptEngineer.js";
import { generateProjectPlan } from "./llmInterface.js";
import { processLLMResponse } from "./responseProcessor.js";

/**
 * Main function to generate a project plan
 * @param {Object} rawProjectData - Raw project data from the frontend
 * @returns {Promise<Object>} - Processing result with plan or error
 */
export async function generateAIProjectPlan(rawProjectData) {
  try {
    console.log("Starting project plan generation...");

    // Step 1: Parse and validate input data
    console.log("Parsing input data...");
    const parsedData = parseProjectData(rawProjectData);

    // Step 2: Create optimized prompt
    console.log("Creating prompt...");
    const prompt = createProjectPlanPrompt(parsedData);

    // Step 3: Send to LLM and get response
    console.log("Sending to LLM...");
    const llmResponse = await generateProjectPlan(prompt);

    // Step 4: Process and structure the response
    console.log("Processing response...");
    const structuredPlan = processLLMResponse(llmResponse);

    console.log("Project plan generation complete!");

    return {
      success: true,
      plan: structuredPlan,
      prompt: prompt, // Include for debugging
    };
  } catch (error) {
    console.error("Error generating project plan:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}
