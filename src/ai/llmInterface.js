/**
 * llmInterface.js
 * Interfaces with the LLM (Ollama/Mistral initially)
 */
import fetch from "node-fetch";

/**
 * Sends prompt to LLM and returns the generated project plan
 * @param {string} prompt - The engineered prompt
 * @returns {Promise<string>} - The LLM response
 */
export async function generateProjectPlan(prompt) {
  try {
    console.log("Sending request to Ollama...");

    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral",
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: 4000,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received response from Ollama");
    return data.response;
  } catch (error) {
    console.error("Error calling Ollama:", error);
    throw error;
  }
}
