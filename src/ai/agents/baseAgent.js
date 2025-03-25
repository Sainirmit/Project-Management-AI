/**
 * baseAgent.js
 * Base class for all AI agents with common functionality
 */
import { generateFromLLM } from "../llmInterface.js";
import { ErrorRecoveryManager } from "../errorRecoveryManager.js";

/**
 * Base Agent class that all specialized agents will inherit from
 */
export class BaseAgent {
  constructor(agentName) {
    this.agentName = agentName || "BaseAgent";
    this.temperature = 0.7; // Default temperature for LLM requests

    // Initialize error recovery capabilities
    this.errorRecovery = new ErrorRecoveryManager({
      retry: {
        maxRetries: 3,
        initialDelay: 1000,
        backoffFactor: 1.5,
      },
      errorReporting: {
        detailedConsoleErrors: true,
      },
    });

    // Default retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryableErrors: [
        "ECONNRESET",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "NETWORK_ERROR",
        "RATE_LIMIT",
        "SERVER_ERROR",
        "TIMEOUT",
      ],
    };
  }

  /**
   * Process method to be implemented by each specialized agent
   * @param {*} input - Input data for the agent
   * @returns {Promise<*>} - Processed output data
   */
  async process(input) {
    throw new Error(`Process method not implemented in ${this.agentName}`);
  }

  /**
   * Send a prompt to the LLM and get a response with retry capability
   * @param {string} prompt - Prompt to send to the LLM
   * @param {Object} options - Options for the LLM request
   * @returns {Promise<string>} - LLM response
   */
  async queryLLM(prompt, options = {}) {
    return this.errorRecovery.executeAgentStep(
      async () => {
        const llmOptions = {
          temperature: options.temperature || this.temperature,
          maxTokens: options.maxTokens || 4000,
          topP: options.topP || 0.9,
          ...options,
        };

        return await generateFromLLM(prompt, llmOptions);
      },
      {
        agentName: this.agentName,
        stepName: "queryLLM",
        context: options.context || "LLM query",
        retryOptions: {
          maxRetries: options.maxRetries || this.retryConfig.maxRetries,
          retryableErrors: [...this.retryConfig.retryableErrors, "LLM_ERROR"],
        },
      }
    );
  }

  /**
   * Execute a processing step with error recovery
   * @param {Function} operation - The function to execute
   * @param {string} stepName - Name of the step
   * @param {Object} options - Additional options
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRecovery(operation, stepName, options = {}) {
    const projectId = options.projectId || "unknown_project";

    return this.errorRecovery.executeAgentStep(operation, {
      agentName: this.agentName,
      stepName,
      projectId,
      state: options.state,
      context: options.context || stepName,
      retryOptions: options.retryOptions || this.retryConfig,
    });
  }

  /**
   * Log agent activity for monitoring and debugging
   * @param {string} message - Message to log
   * @param {*} data - Optional data to log
   */
  log(message, data = null) {
    const logEntry = {
      agent: this.agentName,
      timestamp: new Date().toISOString(),
      message,
    };

    if (data) {
      logEntry.data = data;
    }

    console.log(`[${this.agentName}] ${message}`);

    // Also log to structured event log if we have an error reporter
    if (this.errorRecovery && this.errorRecovery.errorReporter) {
      this.errorRecovery.errorReporter.recordEvent("info", message, {
        agent: this.agentName,
        ...data,
      });
    }
  }

  /**
   * Report an error that occurred during agent processing with enhanced details
   * @param {Error} error - Error that occurred
   * @param {string} context - Context in which the error occurred
   * @param {Object} metadata - Additional metadata about the error
   */
  reportError(error, context, metadata = {}) {
    const errorObj = new Error(`Error in ${this.agentName}: ${error.message}`);
    errorObj.originalError = error;
    errorObj.context = context;
    errorObj.stage = this.agentName;
    errorObj.metadata = metadata;

    // Use enhanced error reporting if available
    if (this.errorRecovery && this.errorRecovery.errorReporter) {
      const errorId = this.errorRecovery.errorReporter.logError(
        errorObj,
        context,
        {
          agent: this.agentName,
          ...metadata,
        }
      );
      errorObj.errorId = errorId;
    } else {
      console.error(`[${this.agentName}] Error during ${context}:`, error);
    }

    throw errorObj;
  }

  /**
   * Check if a project has a resumable state
   * @param {string} projectId - Project ID
   * @returns {Promise<boolean>} - Whether project has resumable state
   */
  async hasResumableState(projectId) {
    if (this.errorRecovery && this.errorRecovery.stateManager) {
      return await this.errorRecovery.hasResumableState(projectId);
    }
    return false;
  }

  /**
   * Save current state for possible resume later
   * @param {string} projectId - Project ID
   * @param {Object} state - State to save
   * @param {string} stageName - Current stage name
   * @returns {Promise<string>} - Path to saved state file
   */
  async saveState(projectId, state, stageName) {
    if (this.errorRecovery && this.errorRecovery.stateManager) {
      return await this.errorRecovery.stateManager.saveState(
        projectId,
        state,
        stageName || this.agentName
      );
    }
    return null;
  }
}
