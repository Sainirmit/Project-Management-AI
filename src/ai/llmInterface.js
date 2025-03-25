/**
 * llmInterface.js
 * Interfaces with the LLM (Ollama/Mistral initially)
 */
import fetch from "node-fetch";
import { setTimeout } from "timers/promises";
import { ErrorRecoveryManager } from "./errorRecoveryManager.js";

// Initialize error recovery manager for LLM calls
const errorRecovery = new ErrorRecoveryManager({
  retry: {
    maxRetries: 5, // More retries for LLM calls
    initialDelay: 1000,
    backoffFactor: 2,
    maxDelay: 30000, // Max 30s delay
  },
});

/**
 * Sends prompt to LLM and returns the generated project plan
 * @param {string} prompt - The engineered prompt
 * @returns {Promise<string>} - The LLM response
 */
export async function generateProjectPlan(prompt) {
  return errorRecovery.retryManager.executeWithRetry(
    async () => {
      console.log("Sending request to Ollama...");

      try {
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
          timeout: 120000, // 2-minute timeout
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw createLLMError(
            `HTTP error! status: ${response.status}`,
            response.status,
            errorText
          );
        }

        const data = await response.json();
        console.log("Received response from Ollama");
        return data.response;
      } catch (error) {
        // Make network errors more informative
        if (error.code === "ECONNREFUSED") {
          throw createLLMError(
            "Could not connect to Ollama service. Make sure Ollama is running.",
            500,
            error.message
          );
        }
        if (error.type === "request-timeout") {
          throw createLLMError(
            "Request to Ollama timed out. The model might be overloaded.",
            408,
            error.message
          );
        }

        // Rethrow with enhanced info
        throw enhanceLLMError(error);
      }
    },
    "generateProjectPlan",
    { maxRetries: 3 }
  );
}

/**
 * Enhanced LLM interface for multi-agent system
 * @param {string} prompt - Prompt to send to the LLM
 * @param {Object} options - Additional options for the LLM call
 * @returns {Promise<string>} - The LLM response
 */
export async function generateFromLLM(prompt, options = {}) {
  return errorRecovery.retryManager.executeWithRetry(
    async () => {
      const modelName = options.model || "mistral";
      console.log(`Sending request to Ollama (${modelName})...`);

      const requestBody = {
        model: modelName,
        prompt: prompt,
        stream: options.stream || false,
        options: {
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9,
          max_tokens: options.maxTokens || 4000,
        },
      };

      // Add any additional options
      if (options.stop_sequences) {
        requestBody.options.stop = options.stop_sequences;
      }

      if (options.presence_penalty) {
        requestBody.options.presence_penalty = options.presence_penalty;
      }

      if (options.frequency_penalty) {
        requestBody.options.frequency_penalty = options.frequency_penalty;
      }

      try {
        // Add timeout control
        const controller = new AbortController();
        const timeoutId = setTimeout(options.timeout || 120000, () =>
          controller.abort("Request timed out")
        ).unref();

        const response = await fetch("http://127.0.0.1:11434/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          throw createLLMError(
            `HTTP error from Ollama! status: ${response.status}`,
            response.status,
            errorText
          );
        }

        const data = await response.json();

        // Check for empty or invalid responses
        if (!data.response || data.response.trim() === "") {
          throw createLLMError(
            "Empty response received from LLM",
            500,
            "The model returned an empty response"
          );
        }

        console.log(`Received response from Ollama (${modelName})`);

        // Return only the response text
        return data.response;
      } catch (error) {
        // Handle aborted requests
        if (error.name === "AbortError") {
          throw createLLMError(
            "Request to Ollama timed out",
            408,
            "The LLM request exceeded the allocated time limit"
          );
        }

        // Handle network errors
        if (error.code === "ECONNREFUSED") {
          throw createLLMError(
            "Could not connect to Ollama service",
            500,
            "Make sure Ollama is running and accessible"
          );
        }

        // Handle model loading errors
        if (error.message && error.message.includes("model not found")) {
          throw createLLMError(
            `Model "${modelName}" not found in Ollama`,
            404,
            `The requested model "${modelName}" is not available. Try pulling it first.`
          );
        }

        // Rethrow enhanced error
        throw enhanceLLMError(error);
      }
    },
    "generateFromLLM",
    {
      maxRetries: options.maxRetries || 3,
      context: `LLM request (${options.model || "mistral"})`,
    }
  );
}

/**
 * Create a standardized LLM error object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} detail - Detailed error information
 * @returns {Error} - Enhanced error object
 */
function createLLMError(message, status, detail) {
  const error = new Error(message);
  error.code = "LLM_ERROR";
  error.status = status;
  error.detail = detail;
  error.isLLMError = true;
  error.timestamp = new Date().toISOString();

  // Log the error
  errorRecovery.errorReporter.recordEvent("error", `LLM Error: ${message}`, {
    status,
    detail: detail?.substring(0, 200), // Limit detail length for logging
  });

  return error;
}

/**
 * Enhance an existing error with LLM-specific information
 * @param {Error} error - Original error
 * @returns {Error} - Enhanced error
 */
function enhanceLLMError(error) {
  if (error.isLLMError) return error; // Already enhanced

  error.code = error.code || "LLM_ERROR";
  error.isLLMError = true;
  error.timestamp = new Date().toISOString();

  // Log the error
  errorRecovery.errorReporter.recordEvent(
    "error",
    `LLM Error: ${error.message}`,
    {
      code: error.code,
      stack: error.stack,
    }
  );

  return error;
}
