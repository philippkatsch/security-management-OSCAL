# Workspace Rules & Guidelines

## 1. Environment Setup
Always activate the `darkspell` conda environment before running tests or executing code in this workspace.

## 2. Test Credentials
Use the test credentials found in the test folder (specifically in [credentials.md](file:///c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/backend/tests/credentials.md)) when running UI/browser testing.

## 3. Chrome-Based MCP Testing on Windows
When running Chrome-based MCP testing on Windows, always launch Chrome with a clean, isolated profile using a temporary user data directory:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-mcp-profile"
```

## 4. Documentation-First Development Workflow
Before writing or modifying any code in the `reposol/` directory, you MUST activate and follow the workflow defined in the [doc_first_development](file:///c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/.agents/skills/doc_first_development/SKILL.md) skill:
1. Write/adapt the relevant user story in `documentation/user_stories/stepX...md` or `step0_global_requirements.md` first.
2. Read ALL design decisions in `documentation/design_decisions/` and check for relevance, conflicts, or the need for a new DD.
3. Read back both the user story and any affected DDs using `view_file` to verify correctness.
4. Present a Pre-Implementation Review (User Story + Design Decisions + Approach) and confirm with the user before implementing.

## 5. Repository Language Policy
The primary language of this repository is English. All code, comments, documentation files, design decisions, and companion files MUST be written exclusively in English.
