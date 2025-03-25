/**
 * Unified Test Manager for the AI Project Management Agent
 * Allows testing different scenarios with a single unified interface
 */

import { generateAgentBasedProjectPlan } from "./ai/agentBasedProjectPlanGenerator.js";
import { OutputManager } from "./ai/utils/outputManager.js";
import fs from "fs";

// Initialize the output manager
const outputManager = new OutputManager();

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
          id: "tm1",
          name: "Alex",
          role: "Frontend Developer",
          skills: ["React Native", "JavaScript", "Mobile Development"],
          experience: "3 years",
          availability: 40,
        },
        {
          id: "tm2",
          name: "Taylor",
          role: "Backend Developer",
          skills: ["Node.js", "Express", "MongoDB", "Firebase"],
          experience: "4 years",
          availability: 40,
        },
        {
          id: "tm3",
          name: "Jordan",
          role: "UI/UX Designer",
          skills: ["UI Design", "UX Research", "Frontend", "CSS"],
          experience: "2 years",
          availability: 35,
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
          id: "tm4",
          name: "Emma",
          role: "Frontend Developer",
          skills: ["React", "TypeScript", "UI/UX", "CSS"],
          experience: "4 years",
          availability: 40,
        },
        {
          id: "tm5",
          name: "Michael",
          role: "Backend Developer",
          skills: ["Node.js", "Firebase", "DevOps", "AWS"],
          experience: "5 years",
          availability: 40,
        },
        {
          id: "tm6",
          name: "Sophie",
          role: "Data Analyst",
          skills: ["Data Analysis", "Machine Learning", "Python", "Statistics"],
          experience: "3 years",
          availability: 30,
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
          id: "tm7",
          name: "David",
          role: "Frontend Lead",
          skills: ["React", "Redux", "JavaScript", "UI/UX", "CSS"],
          experience: "5 years",
          availability: 40,
        },
        {
          id: "tm8",
          name: "Sarah",
          role: "Backend Developer",
          skills: ["Node.js", "Express", "MongoDB", "REST API", "GraphQL"],
          experience: "4 years",
          availability: 40,
        },
        {
          id: "tm9",
          name: "James",
          role: "Full Stack Developer",
          skills: ["React", "Node.js", "DevOps", "Docker", "CI/CD"],
          experience: "3 years",
          availability: 40,
        },
        {
          id: "tm10",
          name: "Lisa",
          role: "QA Engineer",
          skills: ["Testing", "QA Automation", "Documentation", "Selenium"],
          experience: "3 years",
          availability: 35,
        },
      ],
    },
  },
  multiagent: {
    name: "Multi-Agent Based Project Plan",
    data: {
      projectName: "Healthcare Patient Portal",
      projectType: "Web Application",
      projectDescription:
        "A secure healthcare patient portal allowing patients to schedule appointments, view medical records, communicate with providers, and manage prescriptions. The system must be HIPAA compliant and integrate with existing hospital systems.",
      projectTimeline: "4 months",
      priority: "Critical",
      techStack: [
        "React",
        "TypeScript",
        "Node.js",
        "Express",
        "PostgreSQL",
        "AWS",
        "OAuth2",
      ],
      teamMembers: [
        {
          id: "tm11",
          name: "Robert",
          role: "Frontend Lead",
          skills: ["React", "TypeScript", "Accessibility", "UI Design"],
          experience: "6 years",
          availability: 40,
        },
        {
          id: "tm12",
          name: "Elena",
          role: "Backend Lead",
          skills: [
            "Node.js",
            "Express",
            "OAuth",
            "HIPAA Compliance",
            "Security",
          ],
          experience: "7 years",
          availability: 40,
        },
        {
          id: "tm13",
          name: "Marcus",
          role: "DevOps Engineer",
          skills: ["PostgreSQL", "AWS", "Docker", "CI/CD", "Kubernetes"],
          experience: "5 years",
          availability: 30,
        },
        {
          id: "tm14",
          name: "Priya",
          role: "QA Lead",
          skills: [
            "Testing Automation",
            "QA Processes",
            "Technical Writing",
            "Selenium",
          ],
          experience: "4 years",
          availability: 35,
        },
        {
          id: "tm15",
          name: "Jason",
          role: "Full Stack Developer",
          skills: ["React", "Node.js", "API Integration", "HL7 Standards"],
          experience: "3 years",
          availability: 40,
        },
      ],
      constraints: [
        "Must be HIPAA compliant",
        "Must integrate with existing hospital EHR system",
        "Must pass security audit before launch",
        "Must be accessible (WCAG 2.1 AA compliant)",
      ],
    },
  },
};

/**
 * Runs a project plan test with the specified test data
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
    console.log("\nGenerating project plan using multi-agent system...");
    const result = await generateAgentBasedProjectPlan(testData.data);

    if (result.success) {
      console.log("\n✅ Project plan generated successfully!");

      // Display verification results if available
      if (result.verification) {
        console.log("\n--- VERIFICATION RESULTS ---");
        console.log(`Passed: ${result.verification.passed}`);
        console.log(`Total Checks: ${result.verification.totalChecks}`);

        if (
          result.verification.criticalIssues &&
          result.verification.criticalIssues.length > 0
        ) {
          console.log("\nCritical Issues:");
          result.verification.criticalIssues.forEach((issue) => {
            console.log(`- ${issue.description}`);
          });
        }
      }

      // Display project overview
      if (result.plan.projectOverview) {
        console.log("\n--- PROJECT OVERVIEW ---");
        console.log(
          result.plan.projectOverview.summary || "No summary available"
        );
      }

      // Display backlog details if requested
      if (showBacklog && result.plan.tasks) {
        console.log("\n--- PRODUCT BACKLOG (PREVIEW) ---");
        const tasksToShow = result.plan.tasks.slice(0, 3);
        tasksToShow.forEach((task) => {
          console.log(`\nTask: ${task.id} - ${task.title}`);
          console.log(`  Description: ${task.description.substring(0, 50)}...`);
          console.log(`  Priority: ${task.priority}`);
          console.log(`  Estimated Hours: ${task.estimatedHours}`);
          console.log(`  Assigned To: ${task.assignedTo || "Unassigned"}`);
        });

        if (result.plan.tasks.length > 3) {
          console.log(`\n... and ${result.plan.tasks.length - 3} more tasks`);
        }
      }

      // Display milestones if available
      if (result.plan.milestones && result.plan.milestones.length > 0) {
        console.log("\n--- KEY MILESTONES ---");
        result.plan.milestones.forEach((milestone) => {
          console.log(`- ${milestone.name} (${milestone.date})`);
        });
      }

      // Save to the combined output file
      outputManager.saveProjectPlan(
        result.plan,
        testData.name,
        testData.data.projectName
      );
      console.log(`\nProject plan saved to combined output file`);

      // Optional: Clean up old output files
      if (process.argv.includes("--cleanup")) {
        outputManager.cleanupOldOutputFiles();
      }
    } else {
      console.log("\n❌ Error generating project plan:", result.error);
      if (result.stageFailed) {
        console.log(`Failed at stage: ${result.stageFailed}`);
      }
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

  if (testType === "cleanup") {
    // Just clean up old files
    outputManager.cleanupOldOutputFiles();
    console.log("Cleaned up old output files");
    return;
  }

  if (TEST_SCENARIOS[testType]) {
    // Run the test with the specified scenario
    await runTest(TEST_SCENARIOS[testType], showBacklog);
  } else if (testType === "all") {
    // Run all test scenarios sequentially
    for (const [key, scenario] of Object.entries(TEST_SCENARIOS)) {
      console.log("\n" + "=".repeat(50));
      await runTest(scenario, key === "backlog" || showBacklog);
    }
  } else {
    console.log(`❌ Unknown test type: ${testType}`);
    console.log(
      "Available test types: basic, custom, backlog, multiagent, all, cleanup"
    );
    console.log("Options: --backlog, --cleanup");
  }
}

// Run the main function
main();
