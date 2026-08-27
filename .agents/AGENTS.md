# Workspace Rules & Guidelines

## 1. Environment Setup
Always activate the `darkspell` conda environment before running tests or executing code in this workspace.

## 2. Test Credentials
Use the test credentials found in the test folder (specifically in [credentials.md](../reposol/backend/tests/credentials.md)) when running UI/browser testing.

## 3. Chrome-Based MCP Testing on Windows
When running Chrome-based MCP testing on Windows, always launch Chrome with a clean, isolated profile using a temporary user data directory:
```powershell
& "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-mcp-profile"
```

## 4. Documentation-First Development Workflow (Tier System)
Before writing or modifying code in `reposol/`, classify the change using the [doc_first_development](skills/doc_first_development/SKILL.md) skill:

**Tier 1 (Full documentation required):** New features, new pages/editors, new API endpoints, architectural changes, new OSCAL lifecycle capabilities.
1. Write/adapt the relevant user story in `documentation/user_stories/`.
2. Scan design decisions in `documentation/design_decisions/` for relevance and conflicts.
3. Read back documentation, present a Pre-Implementation Review, and get user confirmation before coding.

**Tier 2 (Implement directly):** UI polish (spinners, colors, animations), cosmetic bug fixes, dead code removal, refactoring, test additions, style/theme changes, dependency updates.

## 5. Repository Language Policy
The primary language of this repository is English. All code, comments, documentation files, design decisions, and companion files MUST be written exclusively in English.

## 6. Project Context References
Before starting any significant work, familiarize yourself with these key project documents:
- **Project Vision & Goals:** [GOAL.md](../documentation/GOAL.md)
- **Project Architecture & Milestones:** [PROJECT.md](../PROJECT.md)
- **Test Readiness & Verification:** [TEST_READY.md](../TEST_READY.md)
- **Design Decisions Index:** [design_decisions/](../documentation/design_decisions/) — Read ALL files before proposing architectural changes.
- **User Stories Index:** [user_stories/](../documentation/user_stories/) — Steps 0–8 covering the full OSCAL lifecycle.
- **Public README:** [README.md](../README.md) — Quick start, tech stack, and live demo link.
