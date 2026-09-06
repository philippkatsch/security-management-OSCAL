# Security Management OSCAL (Reposol)

<div align="center">
  <p>A full-stack web application for editing, managing, and validating <strong>NIST OSCAL</strong> (Open Security Controls Assessment Language) documents across all lifecycle stages.</p>

  <p>
    <a href="https://security-management-oscal.fly.dev/" target="_blank">
      <img src="https://img.shields.io/badge/%F0%9F%8C%90_Live_Demo-Ready_to_Use-6366f1?style=for-the-badge&logoColor=white" alt="Live Demo Ready to Use" />
    </a>
  </p>

  <p><strong>🚀 <a href="https://security-management-oscal.fly.dev/">Open Live Web Application</a></strong></p>
  <p><em>Ready to use directly in your browser right now — No installation required!</em></p>
</div>

--- 

## ✨ Current Status

The following OSCAL lifecycle stages are **fully implemented** (backend API, frontend UI, user stories, and design decisions):

- **✅ Step 1 — Catalog Builder**: Create, view, and modify OSCAL Catalogs with full control/group/parameter management.
- **✅ Step 2 — Profile Tailoring**: Build and customize OSCAL Profiles with baseline selection, parameter overrides, and merge directives.
- **✅ Step 3 — Component Inventory**: Manage Component Definitions with 11 OSCAL component types, control implementations, and service protocols.
- **✅ Step 4 — SSP Builder**: Create System Security Plans with baseline import, information types, boundary diagrams, and by-component narratives.
- **✅ Step 5 — Assessment Plan**: Plan security assessments with objectives, methods, scheduling, and terms & conditions.
- **✅ Step 6 — Assessment Results**: Document audit findings with observations, CVSS risk scoring, and attestation sign-offs.
- **✅ Step 7 — POA&M Tracker**: Track remediation with auto-generated POA&M items, risk lifecycle management, and progress dashboards.
- **✅ Step 8 — Control Mapping**: Map controls between frameworks with relationship types, confidence scoring, and gap analysis.

**🔧 Cross-Cutting Features:**
- OSCAL Lifecycle Dashboard, document lifecycle state machine, cross-document traceability
- Multi-format import/export (JSON, XML, YAML), NIST schema validation
- Visual/JSON dual-mode editor with Monaco, anonymous workspace isolation
- Deployed on Fly.io with persistent storage

**🚧 In Progress:**
- End-to-End (Playwright) test coverage for Steps 3–8



## 📸 User Interface

Here is a visual overview of Reposol:

### 📊 Dashboard
The dashboard displays the OSCAL Lifecycle Pipeline and recent activity. By collapsing the left navigation sidebar (using the arrow toggle next to the logo), the workspace maximizes to fill the screen.

![Dashboard](./documentation/images/dashboard.png)

### 📚 Catalogs Overview
Browse, search, and manage all imported and custom OSCAL Catalogs.

![Catalogs Overview](./documentation/images/catalogs_list.png)

### 📂 Catalog & Profile Editor ("Internal View")
When opening a Catalog or Profile, the interface displays the document tree in a sidebar and selected controls in the main workspace, giving you a full overview of parameters, prose, and metadata.

| View Mode | Edit Mode |
| :--- | :--- |
| ![Catalog View](./documentation/images/catalog_control_view.png) | ![Catalog Edit](./documentation/images/catalog_control_edit.png) |
| ![Profile View](./documentation/images/profile_control_view.png) | ![Profile Edit](./documentation/images/profile_control_edit.png) |

### 📥 Import Wizard
Easily upload and validate OSCAL documents in JSON, YAML, or XML formats.

![Import Wizard](./documentation/images/import_wizard.png)

---

## 🛠️ Tech Stack

- **Frontend**: React 18 + Vite (TypeScript, React Query, Jotai, Immer)
- **Backend**: Python 3.10+ / FastAPI (OSCAL Resolution Engine)
- **Storage**: Local JSON files (Zero configuration database!)

---

## 🏎️ Quick Start

This project requires **Python 3.10+** and **Node.js 18+**.

### 1. Start the Backend

Open a terminal and set up your Python environment:

```powershell
cd reposol/backend

# Create and activate a conda environment
conda create -n oscal python=3.11 -y
conda activate oscal

# Install dependencies and run
pip install -r requirements.txt
python -m app.main
```
The API and interactive docs will be available at **http://localhost:1000/docs**.

### 2. Start the Frontend

Open a **new terminal**:

```powershell
cd reposol/frontend

# Install dependencies and run
npm install
npm run dev
```
Open your browser to **http://localhost:1001** to view the app.

---

## 📚 Documentation

Please refer to the [documentation](./documentation/) folder for detailed insights into the project's foundation, including:
- **[Project Goals](./documentation/GOAL.md)**
- **[User Stories](./documentation/user_stories/)**
- **[Design Decisions](./documentation/design_decisions/)**

The interactive API documentation is available at **http://localhost:1000/docs** when the backend is running.

---

## 📄 License

This project is open-source software licensed under the **Apache License 2.0**.


