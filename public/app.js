// Constants
const API_URL = "http://localhost:8080/api";

// DOM references
const planListElement = document.getElementById("planList");
const planDetailsElement = document.getElementById("planDetails");
const generateBasicBtn = document.getElementById("generateBasic");
const generateCustomBtn = document.getElementById("generateCustom");
const generateBacklogBtn = document.getElementById("generateBacklog");
const generateMultiagentBtn = document.getElementById("generateMultiagent");

// Test scenarios from test-manager.js
const TEST_SCENARIOS = {
  basic: {
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
  custom: {
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
  backlog: {
    projectName: "Task Management Application",
    projectType: "Web Application",
    projectDescription:
      "A comprehensive task management application allowing users to create, organize, and track tasks. Features include task categorization, due dates, priority levels, recurring tasks, notifications, and team collaboration.",
    projectTimeline: "2.5 months",
    priority: "High",
    techStack: ["React", "Redux", "Node.js", "Express", "MongoDB", "Socket.io"],
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
  multiagent: {
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
        skills: ["Node.js", "Express", "OAuth", "HIPAA Compliance", "Security"],
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
};

// Load plans when the page loads
document.addEventListener("DOMContentLoaded", () => {
  loadPlans();

  // Add event listeners for generate buttons
  generateBasicBtn.addEventListener("click", () => generatePlan("basic"));
  generateCustomBtn.addEventListener("click", () => generatePlan("custom"));
  generateBacklogBtn.addEventListener("click", () => generatePlan("backlog"));
  generateMultiagentBtn.addEventListener("click", () =>
    generatePlan("multiagent")
  );
});

// Load available plans
async function loadPlans() {
  try {
    const response = await fetch(`${API_URL}/plans`);
    const plans = await response.json();

    renderPlanList(plans);
  } catch (error) {
    console.error("Error loading plans:", error);
    planListElement.innerHTML = `
      <div class="alert alert-danger">
        Failed to load plans. Please ensure the server is running.
      </div>
    `;
  }
}

// Render plan list
function renderPlanList(plans) {
  if (plans.length === 0) {
    planListElement.innerHTML = `
      <div class="alert alert-info">
        No plans found. Generate a new plan to get started.
      </div>
    `;
    return;
  }

  planListElement.innerHTML = "";

  plans.forEach((plan) => {
    const item = document.createElement("a");
    item.href = "#";
    item.className = "list-group-item list-group-item-action";
    item.innerHTML = `
      <div class="d-flex w-100 justify-content-between">
        <h5 class="mb-1">${plan.name}</h5>
      </div>
      <small>${plan.file}</small>
    `;

    item.addEventListener("click", (e) => {
      e.preventDefault();
      loadPlanDetails(plan.file);

      // Set active class
      document.querySelectorAll(".list-group-item").forEach((el) => {
        el.classList.remove("active");
      });
      item.classList.add("active");
    });

    planListElement.appendChild(item);
  });
}

// Load plan details
async function loadPlanDetails(filename) {
  showLoading();

  try {
    const response = await fetch(`${API_URL}/plans/${filename}`);
    const plan = await response.json();

    renderPlanDetails(plan);
  } catch (error) {
    console.error("Error loading plan details:", error);
    planDetailsElement.innerHTML = `
      <div class="alert alert-danger">
        Failed to load plan details. Please try again.
      </div>
    `;
  } finally {
    hideLoading();
  }
}

// Generate a new plan
async function generatePlan(type) {
  showLoading();

  const projectData = TEST_SCENARIOS[type];

  try {
    const response = await fetch(`${API_URL}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(projectData),
    });

    const result = await response.json();

    if (result.success) {
      // Reload plan list and show the new plan
      await loadPlans();
      await loadPlanDetails(result.filename);
    } else {
      planDetailsElement.innerHTML = `
        <div class="alert alert-danger">
          <h4>Error Generating Plan</h4>
          <p>${result.error}</p>
          <p>Failed at stage: ${result.stageFailed || "unknown"}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error("Error generating plan:", error);
    planDetailsElement.innerHTML = `
      <div class="alert alert-danger">
        Failed to generate plan. Please ensure Ollama is running with the Mistral model.
      </div>
    `;
  } finally {
    hideLoading();
  }
}

// Render plan details
function renderPlanDetails(plan) {
  let html = `
    <h3 class="plan-title">${plan.projectName}</h3>
    <div class="mb-3">
      <span class="badge bg-primary">${plan.projectType}</span>
      <span class="badge bg-secondary">${plan.projectTimeline}</span>
      <span class="badge bg-info">Priority: ${plan.priority}</span>
    </div>
  `;

  // Project description
  if (plan.projectDescription) {
    html += `
      <div class="section-header">Project Description</div>
      <p>${plan.projectDescription}</p>
    `;
  }

  // Project overview
  if (plan.projectOverview && plan.projectOverview.summary) {
    html += `
      <div class="section-header">Project Overview</div>
      <p>${plan.projectOverview.summary}</p>
    `;
  }

  // Tech stack
  if (plan.techStack && plan.techStack.length > 0) {
    html += `
      <div class="section-header">Tech Stack</div>
      <div class="mb-3">
        ${plan.techStack
          .map((tech) => `<span class="badge bg-secondary">${tech}</span>`)
          .join(" ")}
      </div>
    `;
  }

  // Team members
  if (plan.teamMembers && plan.teamMembers.length > 0) {
    html += `
      <div class="section-header">Team Members</div>
      <div class="row mb-3">
    `;

    plan.teamMembers.forEach((member) => {
      html += `
        <div class="col-md-6 mb-2">
          <div class="card">
            <div class="card-body">
              <h5 class="card-title">${member.name}</h5>
              <h6 class="card-subtitle mb-2 text-muted">${member.role}</h6>
              <p class="card-text">
                <small>Skills: ${member.skills.join(", ")}</small><br>
                <small>Experience: ${member.experience}</small><br>
                <small>Availability: ${member.availability} hrs/week</small>
              </p>
            </div>
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // Sprints
  if (plan.sprints && plan.sprints.length > 0) {
    html += `<div class="section-header">Sprint Plan</div>`;

    plan.sprints.forEach((sprint) => {
      html += `
        <div class="card sprint-card">
          <div class="card-header">
            <h5>${sprint.name || "Sprint " + sprint.number}</h5>
          </div>
          <div class="card-body">
            <p>${sprint.description || sprint.goal || "No description"}</p>
            <p><strong>Duration:</strong> ${sprint.duration}</p>
            <p><strong>Goals:</strong> ${
              sprint.goals || sprint.goal || "No goals specified"
            }</p>
          </div>
        </div>
      `;
    });
  }

  // Tasks
  if (plan.tasks && plan.tasks.length > 0) {
    html += `
      <div class="section-header">Tasks</div>
      <div class="task-list">
    `;

    plan.tasks.forEach((task) => {
      html += `
        <div class="task-item">
          <h5>${task.title}</h5>
          <p>${task.description}</p>
          <div class="mb-2">
            <span class="badge bg-${getPriorityColor(task.priority)}">${
        task.priority
      }</span>
            <span class="badge bg-secondary">${
              task.estimatedHours || task.hours || "N/A"
            } hours</span>
            ${
              task.assignedTo
                ? `<span class="badge bg-info">Assigned to: ${task.assignedTo}</span>`
                : ""
            }
          </div>
        </div>
      `;
    });

    html += `</div>`;
  }

  // Milestones
  if (plan.milestones && plan.milestones.length > 0) {
    html += `
      <div class="section-header">Milestones</div>
    `;

    plan.milestones.forEach((milestone) => {
      html += `
        <div class="milestone-item">
          <h5>${milestone.name}</h5>
          <p>${milestone.description || "No description"}</p>
          <p><strong>Date:</strong> ${milestone.date}</p>
        </div>
      `;
    });
  }

  // Risks
  if (plan.risks && plan.risks.length > 0) {
    html += `
      <div class="section-header">Risks</div>
    `;

    plan.risks.forEach((risk) => {
      html += `
        <div class="risk-item">
          <h5>${risk.name || risk.title}</h5>
          <p>${risk.description}</p>
          <p><strong>Impact:</strong> ${risk.impact}</p>
          <p><strong>Mitigation:</strong> ${risk.mitigation}</p>
        </div>
      `;
    });
  }

  planDetailsElement.innerHTML = html;
}

// Show loading overlay
function showLoading() {
  if (!document.querySelector(".loading-overlay")) {
    const loadingOverlay = document.createElement("div");
    loadingOverlay.className = "loading-overlay";
    loadingOverlay.innerHTML = `
      <div class="spinner-border text-primary" style="width: 3rem; height: 3rem;" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
    `;
    document.body.appendChild(loadingOverlay);
  }
}

// Hide loading overlay
function hideLoading() {
  const overlay = document.querySelector(".loading-overlay");
  if (overlay) {
    overlay.remove();
  }
}

// Helper function to get priority color
function getPriorityColor(priority) {
  switch (priority.toLowerCase()) {
    case "high":
    case "critical":
      return "danger";
    case "medium":
      return "warning";
    case "low":
      return "success";
    default:
      return "secondary";
  }
}
