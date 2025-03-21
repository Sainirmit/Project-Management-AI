/**
 * Unified Test Manager for the AI Project Management Agent
 * Allows testing different scenarios with a single unified interface
 */

import { generateAIProjectPlan } from "./ai/projectPlanGenerator.js";
import fs from "fs";

// Test scenarios
const TEST_SCENARIOS = {
  basic: {
    name: "Basic Project Plan",
    data: {
      projectName: "E-commerce Mobile App",
      projectType: "Mobile Application",
      projectDescription:
        "A full-featured e-commerce mobile app with user authentication, product browsing, shopping cart, checkout, and order tracking.",
      projectTimeline: "3 months",
      priority: "High",
      techStack: ["React Native", "Firebase", "Node.js", "Express", "MongoDB"],
      teamMembers: [
        {
          name: "Alex",
          roles: ["Frontend", "Mobile"],
          experience: "3 years",
        },
        {
          name: "Taylor",
          roles: ["Backend", "Database"],
          experience: "4 years",
        },
        {
          name: "Jordan",
          roles: ["UI/UX", "Frontend"],
          experience: "2 years",
        },
      ],
    },
  },
  custom: {
    name: "Custom Social Media Dashboard",
    data: {
      projectName: "Social Media Dashboard",
      projectType: "Web Application",
      projectDescription:
        "A dashboard for businesses to manage and analyze their social media presence across multiple platforms. Features include post scheduling, analytics, sentiment analysis, and competitor tracking.",
      projectTimeline: "2 months",
      priority: "Medium",
      techStack: ["React", "NextJS", "TypeScript", "Firebase", "Node.js"],
      teamMembers: [
        {
          name: "Emma",
          roles: ["Frontend", "UI/UX"],
          experience: "4 years",
        },
        {
          name: "Michael",
          roles: ["Backend", "DevOps"],
          experience: "5 years",
        },
        {
          name: "Sophie",
          roles: ["Data Analysis", "Machine Learning"],
          experience: "3 years",
        },
      ],
    },
  },
  backlog: {
    name: "Detailed Backlog Creation",
    data: {
      projectName: "Task Management Application",
      projectType: "Web Application",
      projectDescription:
        "A comprehensive task management application allowing users to create, organize, and track tasks. Features include task categorization, due dates, priority levels, recurring tasks, notifications, and team collaboration.",
      projectTimeline: "2.5 months",
      priority: "High",
      techStack: [
        "React",
        "Redux",
        "Node.js",
        "Express",
        "MongoDB",
        "Socket.io",
      ],
      teamMembers: [
        {
          name: "David",
          roles: ["Frontend Lead", "UI/UX"],
          experience: "5 years",
        },
        {
          name: "Sarah",
          roles: ["Backend Developer", "Database"],
          experience: "4 years",
        },
        {
          name: "James",
          roles: ["Full Stack", "DevOps"],
          experience: "3 years",
        },
        {
          name: "Lisa",
          roles: ["QA Engineer", "Documentation"],
          experience: "3 years",
        },
      ],
    },
  },
};

/**
 * Runs a test with the specified test data
 * @param {Object} testData - Project data for testing
 * @param {boolean} showBacklog - Whether to show backlog details
 */
async function runTest(testData, showBacklog = false) {
  console.log(`\nRunning test: ${testData.name}`);
  console.log(`Project: ${testData.data.projectName}`);
  console.log(
    `Description: ${testData.data.projectDescription.substring(0, 100)}...`
  );

  try {
    console.log("\nGenerating project plan...");
    const result = await generateAIProjectPlan(testData.data);

    if (result.success) {
      console.log("\n✅ Project plan generated successfully!");

      // Display project overview
      console.log("\n--- PROJECT OVERVIEW ---");
      console.log(result.plan.overview);

      // Display backlog details if requested
      if (showBacklog && result.plan.backlog) {
        console.log("\n--- PRODUCT BACKLOG (PREVIEW) ---");

        // Show structured tasks if available
        if (
          typeof result.plan.backlog === "object" &&
          result.plan.backlog.tasks
        ) {
          console.log("Structured Tasks:");
          const tasksToShow = result.plan.backlog.tasks.slice(0, 3);
          tasksToShow.forEach((task) => {
            console.log(`\nTask: ${task.id} - ${task.title}`);
            console.log(`  Assigned To: ${task.assignedTo}`);
            console.log(`  Priority: ${task.priority}`);
            console.log(`  Estimated Hours: ${task.estimatedHours}`);
            console.log(`  Sprint: ${task.sprint}`);
          });

          if (result.plan.backlog.tasks.length > 3) {
            console.log(
              `\n... and ${result.plan.backlog.tasks.length - 3} more tasks`
            );
          }
        } else {
          // Show raw backlog text
          const backlogText =
            typeof result.plan.backlog === "string"
              ? result.plan.backlog
              : result.plan.backlog.rawText;

          const backlogLines = backlogText.split("\n");
          const previewLines = backlogLines.slice(0, 5);
          console.log(previewLines.join("\n"));

          if (backlogLines.length > 5) {
            console.log(`\n... and ${backlogLines.length - 5} more lines`);
          }
        }
      }

      // Display milestones
      console.log("\n--- KEY MILESTONES ---");
      console.log(result.plan.milestones);

      // Save the complete plan to a file
      const outputFile = `${testData.data.projectName
        .toLowerCase()
        .replace(/\s+/g, "-")}-plan.json`;
      fs.writeFileSync(outputFile, JSON.stringify(result.plan, null, 2));
      console.log(`\nFull project plan saved to '${outputFile}'`);
    } else {
      console.log("\n❌ Error generating project plan:", result.error);
    }
  } catch (error) {
    console.error("An unexpected error occurred:", error);
  }
}

/**
 * Main function to run tests
 */
async function main() {
  // Check if specific test scenario is requested via command line argument
  const args = process.argv.slice(2);
  const testType = args[0] || "basic";
  const showBacklog = args.includes("--backlog") || testType === "backlog";

  console.log("AI Project Management Agent - Test Manager");
  console.log("=========================================");

  if (TEST_SCENARIOS[testType]) {
    await runTest(TEST_SCENARIOS[testType], showBacklog);
  } else if (testType === "all") {
    // Run all test scenarios sequentially
    for (const [key, scenario] of Object.entries(TEST_SCENARIOS)) {
      console.log("\n" + "=".repeat(50));
      await runTest(scenario, key === "backlog" || showBacklog);
    }
  } else {
    console.log(`❌ Unknown test type: ${testType}`);
    console.log("Available test types: basic, custom, backlog, all");
  }
}

// Run the main function
main();
