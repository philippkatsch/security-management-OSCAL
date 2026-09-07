# Workspace Rules & Guidelines

## 1. Environment Setup & Python Execution on Windows
- Always use the `darkspell` conda environment before running tests or executing code in this workspace.
- **Direct Executable Path**: On Windows, avoid using `conda run -n darkspell python <script>` to run Python scripts because it wraps stdout/stderr and throws `UnicodeEncodeError` on non-ASCII characters. Instead, run python directly from the environment path:
  ```powershell
  C:\Users\phili\miniconda3\envs\darkspell\python.exe <script>
  # For backend pytest:
  C:\Users\phili\miniconda3\envs\darkspell\python.exe -m pytest <test_path>
  ```

## 2. Authentication & Test Credentials Policy
- Reposol operates in **unauthenticated mode** during local development and testing.
- No login credentials or auth tokens are required to interact with API endpoints or UI workflows.
- Service defaults:
  - **Backend API**: `http://127.0.0.1:1000` (or `http://localhost:8000`)
  - **Frontend UI**: `http://127.0.0.1:1001`
  - **Default Workspace**: `default`
- Reference: [credentials.md](../reposol/backend/tests/credentials.md).

## 3. Chrome-Based MCP Testing on Windows
- When running Chrome-based MCP testing on Windows, always launch Chrome with a clean, isolated profile using a temporary user data directory:
  ```powershell
  & "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-mcp-profile"
  ```
- **MCP Server Name**: In Antigravity, the Chrome DevTools server is registered as `chrome-devtools-mcp` (e.g., `call_mcp_tool(ServerName='chrome-devtools-mcp', ToolName='navigate_page', ...)`).
- **Service Readiness**: Ensure both Frontend (Port 1001) and Backend (Port 1000) are active before initiating UI/browser tests. If the backend is stopped, start it via:
  ```powershell
  cd reposol/backend
  C:\Users\phili\miniconda3\envs\darkspell\python.exe -m app.main
  ```

## 4. Test Scope & Efficiency (Pragmatic Testing)
- Do not run backend tests (`pytest`) for trivial or minor changes (e.g., UI adjustments, minor styling/text changes, comments, or documentation updates) that do not impact core backend logic or execution behavior.
- For UI changes, execute frontend unit/component tests (`npm test` in `reposol/frontend`) or targeted Playwright specs rather than running the entire backend test suite.

## 5. Cost & External Dependency Policy
- Reposol runs completely self-contained. Avoid invoking paid external APIs during automated testing or code execution.
- If mock proxies or local tools are utilized, ensure they point exclusively to local endpoints (`localhost`).

## 6. Documentation-First Development Workflow (Tier System)
Before writing or modifying code in `reposol/`, classify the change using the [doc_first_development](skills/doc_first_development/SKILL.md) skill:

**Tier 1 (Full documentation required):** New features, new pages/editors, new API endpoints, architectural changes, new OSCAL lifecycle capabilities.
1. Write/adapt the relevant user story in `documentation/user_stories/`.
2. Scan design decisions in `documentation/design_decisions/` for relevance and conflicts.
3. Read back documentation, present a Pre-Implementation Review, and get user confirmation before coding.

**Tier 2 (Implement directly):** UI polish (spinners, colors, animations), cosmetic bug fixes, dead code removal, refactoring, test additions, style/theme changes, dependency updates.

## 7. Repository Language Policy
The primary language of this repository is English. All code, comments, documentation files, design decisions, and companion files MUST be written exclusively in English.

## 8. Project Context References
Before starting any significant work, familiarize yourself with these key project documents:
- **Project Vision & Goals:** [GOAL.md](../documentation/GOAL.md)
- **Project Architecture & Milestones:** [PROJECT.md](../PROJECT.md)
- **Test Readiness & Verification:** [TEST_READY.md](../TEST_READY.md)
- **Design Decisions Index:** [design_decisions/](../documentation/design_decisions/) — Read ALL files before proposing architectural changes.
- **User Stories Index:** [user_stories/](../documentation/user_stories/) — Steps 0–8 covering the full OSCAL lifecycle.
- **Public README:** [README.md](../README.md) — Quick start, tech stack, and live demo link.

