/**
 * errorRecoveryManager.js
 * Provides error recovery, retry mechanisms, and state persistence capabilities
 */
import fs from "fs";
import path from "path";

/**
 * Manages retry logic for agent operations
 */
export class RetryManager {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.backoffFactor = options.backoffFactor || 1.5;
    this.initialDelay = options.initialDelay || 1000; // 1 second
    this.maxDelay = options.maxDelay || 30000; // 30 seconds
    this.retryableErrors = options.retryableErrors || [
      "ECONNRESET",
      "ETIMEDOUT",
      "ECONNREFUSED",
      "NETWORK_ERROR",
      "RATE_LIMIT",
      "SERVER_ERROR",
      "TIMEOUT",
      "AbortError",
    ];
  }

  /**
   * Execute an operation with retry logic
   * @param {Function} operation - The async operation to execute
   * @param {string} context - Context for error reporting
   * @param {Object} options - Override options for this specific retry
   * @returns {Promise<any>} - Result of the operation
   */
  async executeWithRetry(operation, context, options = {}) {
    const maxRetries = options.maxRetries || this.maxRetries;
    const retryableErrors = options.retryableErrors || this.retryableErrors;
    let lastError = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;

        // Check if error is retryable
        const isRetryable = this.isErrorRetryable(error, retryableErrors);
        if (!isRetryable || attempt > maxRetries) {
          break;
        }

        // Calculate backoff delay
        const delay = this.calculateBackoff(attempt);

        // Log retry information
        console.log(
          `Retry attempt ${attempt}/${maxRetries} for ${context} after ${delay}ms delay`
        );
        console.log(`Error details: ${error.message}`);

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // If we've exhausted all retries, throw the last error
    if (lastError) {
      // Enhance error with retry information
      lastError.retriesAttempted = attempt - 1;
      lastError.retryContext = context;
      throw lastError;
    }
  }

  /**
   * Check if an error is retryable
   * @param {Error} error - The error to check
   * @param {Array<string>} retryableErrors - List of retryable error codes/types
   * @returns {boolean} - Whether the error is retryable
   */
  isErrorRetryable(error, retryableErrors) {
    // Network errors and server errors are typically retryable
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    // HTTP status codes in the 5xx range or 429 (rate limiting) are retryable
    if (error.status && (error.status >= 500 || error.status === 429)) {
      return true;
    }

    // Some errors like "model overloaded" from LLM providers are retryable
    if (
      error.message &&
      (error.message.includes("overloaded") ||
        error.message.includes("rate limit") ||
        error.message.includes("timeout") ||
        error.message.includes("capacity"))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Calculate exponential backoff delay
   * @param {number} attempt - Attempt number (1-based)
   * @returns {number} - Delay in milliseconds
   */
  calculateBackoff(attempt) {
    const delay = this.initialDelay * Math.pow(this.backoffFactor, attempt - 1);
    return Math.min(delay, this.maxDelay);
  }
}

/**
 * Manages state persistence for recovery
 */
export class StateManager {
  constructor(options = {}) {
    this.statePath = options.statePath || path.join(process.cwd(), "recovery");
    this.autoSaveThreshold = options.autoSaveThreshold || 3; // Save every 3 steps
    this.stepCount = 0;

    // Ensure state directory exists
    if (!fs.existsSync(this.statePath)) {
      fs.mkdirSync(this.statePath, { recursive: true });
    }
  }

  /**
   * Save the current state
   * @param {string} id - Unique identifier for the state (e.g., project ID)
   * @param {Object} state - The state to save
   * @param {string} stageName - The current stage name
   * @returns {Promise<void>}
   */
  async saveState(id, state, stageName) {
    try {
      // Create a filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, "-");
      const filename = `${id}_${stageName}_${timestamp}.json`;
      const filePath = path.join(this.statePath, filename);

      // Add metadata
      const stateWithMetadata = {
        metadata: {
          id,
          stageName,
          timestamp,
          version: "1.0",
        },
        state,
      };

      // Write to file
      await fs.promises.writeFile(
        filePath,
        JSON.stringify(stateWithMetadata, null, 2)
      );

      // Create a latest pointer file
      const latestPointer = {
        id,
        latestFile: filename,
        stageName,
        timestamp,
      };

      await fs.promises.writeFile(
        path.join(this.statePath, `${id}_latest.json`),
        JSON.stringify(latestPointer, null, 2)
      );

      return filePath;
    } catch (error) {
      console.error("Error saving state:", error);
      throw new Error(`Failed to save state: ${error.message}`);
    }
  }

  /**
   * Load the latest state for a project
   * @param {string} id - Unique identifier for the state
   * @returns {Promise<Object|null>} - The loaded state or null if not found
   */
  async loadLatestState(id) {
    try {
      const latestPointerPath = path.join(this.statePath, `${id}_latest.json`);

      if (!fs.existsSync(latestPointerPath)) {
        return null;
      }

      const latestPointer = JSON.parse(
        await fs.promises.readFile(latestPointerPath, "utf8")
      );

      const statePath = path.join(this.statePath, latestPointer.latestFile);

      if (!fs.existsSync(statePath)) {
        return null;
      }

      const savedData = JSON.parse(
        await fs.promises.readFile(statePath, "utf8")
      );

      return savedData.state;
    } catch (error) {
      console.error("Error loading state:", error);
      return null;
    }
  }

  /**
   * Check if state autosave should be triggered
   * @returns {boolean} - Whether to autosave
   */
  shouldAutoSave() {
    this.stepCount++;
    return this.stepCount % this.autoSaveThreshold === 0;
  }

  /**
   * List all saved states for a project
   * @param {string} id - Project ID
   * @returns {Promise<Array>} - Array of saved state metadata
   */
  async listSavedStates(id) {
    try {
      const files = await fs.promises.readdir(this.statePath);
      const stateFiles = files.filter(
        (file) => file.startsWith(`${id}_`) && file !== `${id}_latest.json`
      );

      const states = [];
      for (const file of stateFiles) {
        const data = JSON.parse(
          await fs.promises.readFile(path.join(this.statePath, file), "utf8")
        );
        states.push({
          filename: file,
          ...data.metadata,
        });
      }

      return states.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );
    } catch (error) {
      console.error("Error listing saved states:", error);
      return [];
    }
  }
}

/**
 * Enhanced error reporting and logging
 */
export class ErrorReporter {
  constructor(options = {}) {
    this.logPath = options.logPath || path.join(process.cwd(), "logs");
    this.detailedConsoleErrors = options.detailedConsoleErrors !== false;
    this.errorLogThreshold = options.errorLogThreshold || "info";

    // Ensure log directory exists
    if (!fs.existsSync(this.logPath)) {
      fs.mkdirSync(this.logPath, { recursive: true });
    }
  }

  /**
   * Log an error with detailed information
   * @param {Error} error - The error to log
   * @param {string} context - Error context
   * @param {Object} metadata - Additional metadata
   * @returns {string} - Error ID for reference
   */
  logError(error, context, metadata = {}) {
    const errorId = `err_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 5)}`;

    const errorDetails = {
      errorId,
      timestamp: new Date().toISOString(),
      context,
      message: error.message,
      stack: error.stack,
      code: error.code,
      statusCode: error.statusCode || error.status,
      originalError: error.originalError
        ? {
            message: error.originalError.message,
            stack: error.originalError.stack,
          }
        : null,
      metadata,
    };

    // Write to log file
    const logFileName = `error_${new Date()
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "")}.log`;
    const logMessage =
      `[${errorDetails.timestamp}] [${errorId}] [${context}] Error: ${error.message}\n` +
      `Stack: ${error.stack}\n` +
      `Metadata: ${JSON.stringify(metadata)}\n\n`;

    fs.appendFileSync(path.join(this.logPath, logFileName), logMessage);

    // Console output
    if (this.detailedConsoleErrors) {
      console.error(`[ERROR ${errorId}] ${context}: ${error.message}`);
      if (metadata && Object.keys(metadata).length > 0) {
        console.error("Error metadata:", metadata);
      }
    }

    return errorId;
  }

  /**
   * Format an error for API responses
   * @param {Error} error - The error that occurred
   * @param {string} context - Context in which the error occurred
   * @returns {Object} - Formatted error response
   */
  formatErrorResponse(error, context) {
    const errorId = this.logError(error, context);

    // Default error message for users
    const userMessage =
      error.userMessage || "An error occurred while processing your request";

    return {
      success: false,
      error: {
        id: errorId,
        message: userMessage,
        context,
        code: error.code || "INTERNAL_ERROR",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      },
    };
  }

  /**
   * Record application events for debugging and auditing
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional log data
   */
  recordEvent(level, message, data = {}) {
    const levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
    };

    if (levels[level] > levels[this.errorLogThreshold]) {
      return; // Skip logging if below threshold
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
    };

    // Write to event log
    const logFileName = `app_${level}_${new Date()
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "")}.log`;
    const logMessage =
      `[${timestamp}] [${level.toUpperCase()}] ${message}\n` +
      (Object.keys(data).length > 0 ? `Data: ${JSON.stringify(data)}\n` : "") +
      "\n";

    fs.appendFileSync(path.join(this.logPath, logFileName), logMessage);

    // Output to console
    const consoleMethod =
      level === "error" ? "error" : level === "warn" ? "warn" : "log";
    console[consoleMethod](`[${level.toUpperCase()}] ${message}`);
  }
}

/**
 * Combined error recovery manager that integrates retry, state, and error reporting
 */
export class ErrorRecoveryManager {
  constructor(options = {}) {
    this.retryManager = new RetryManager(options.retry);
    this.stateManager = new StateManager(options.state);
    this.errorReporter = new ErrorReporter(options.errorReporting);
  }

  /**
   * Execute an agent process step with full error recovery capabilities
   * @param {Function} operation - The operation to execute
   * @param {Object} options - Options for error recovery
   * @returns {Promise<any>} - Operation result
   */
  async executeAgentStep(operation, options) {
    const {
      agentName,
      stepName,
      projectId,
      state,
      context = "agent operation",
      retryOptions = {},
    } = options;

    try {
      // Attempt to run the operation with retry logic
      const result = await this.retryManager.executeWithRetry(
        operation,
        `${agentName}:${stepName}`,
        retryOptions
      );

      // Save state if needed and state is provided
      if (projectId && state && this.stateManager.shouldAutoSave()) {
        await this.stateManager.saveState(projectId, state, stepName);
        this.errorReporter.recordEvent("info", `Saved state at ${stepName}`, {
          projectId,
        });
      }

      return result;
    } catch (error) {
      // Record the error
      this.errorReporter.logError(error, `${agentName}:${stepName}`, {
        projectId,
        retriesAttempted: error.retriesAttempted || 0,
        context,
      });

      // Try to save state before failing
      if (projectId && state) {
        try {
          await this.stateManager.saveState(
            projectId,
            state,
            `${stepName}_failed`
          );
          this.errorReporter.recordEvent(
            "info",
            `Saved failure state at ${stepName}`,
            { projectId }
          );
        } catch (saveError) {
          this.errorReporter.recordEvent(
            "error",
            "Failed to save state after error",
            { projectId, saveError }
          );
        }
      }

      throw error;
    }
  }

  /**
   * Resume project processing from a saved state
   * @param {string} projectId - Project ID to resume
   * @returns {Promise<Object|null>} - The loaded state or null if not found
   */
  async resumeFromState(projectId) {
    return await this.stateManager.loadLatestState(projectId);
  }

  /**
   * Check if a resumable state exists for a project
   * @param {string} projectId - Project ID to check
   * @returns {Promise<boolean>} - Whether a resumable state exists
   */
  async hasResumableState(projectId) {
    const state = await this.stateManager.loadLatestState(projectId);
    return state !== null;
  }

  /**
   * Get information about all saved states for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} - Array of saved state metadata
   */
  async getSavedStateInfo(projectId) {
    return await this.stateManager.listSavedStates(projectId);
  }
}
