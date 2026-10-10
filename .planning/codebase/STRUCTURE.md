# Codebase Structure

**Analysis Date:** 2026-10-10

## Directory Layout

```text
.
├── .github/                  # Local GSD tooling and Copilot configuration
├── .planning/                # Planning artifacts and codebase maps
├── .vscode/                  # Editor settings and extension recommendations
├── dist/                     # Built Vite bundle served by Express in production
├── server/                   # Node.js + Express + Socket.IO realtime server
├── src/                      # React client source
├── .coderabbit.yaml          # Optional review config
├── .gitignore                # Git ignore rules
├── AGENTS.md                 # Workspace guidance for local agents
├── LICENSE                   # MIT license
├── README.md                 # Project overview and running instructions
├── index.html                # Root HTML shell for the Vite app
├── package.json              # Scripts and dependencies
├── package-lock.json         # Locked dependency versions
├── tsconfig.json             # TypeScript compiler configuration
├── vite.config.ts            # Vite dev server and proxy config
└── node_modules/             # Installed dependencies (not source-managed)
```

## Directory Purposes

**`server/`:**
- Purpose: Houses the Node.js backend for realtime room state, chat, and signaling.
- Contains: `index.js` with Express app setup, Socket.IO event registration, and static asset serving.
- Key files: `server/index.js`

**`src/`:**
- Purpose: Contains the browser-side React application and all UI logic.
- Contains: `App.tsx`, `main.tsx`, and `style.css` for the client implementation.
- Key files: `src/App.tsx`, `src/main.tsx`, `src/style.css`

**`dist/`:**
- Purpose: Generated production bundle from `vite build`.
- Contains: Minified HTML/CSS/JS assets served by `server/index.js` when present.
- Key files: `dist/index.html`, `dist/assets/*`

**`.github/`:**
- Purpose: Local GSD workflow tooling and agent metadata used for development assistance.
- Contains: agent definitions, scripts, and profile metadata.
- Key files: `.github/copilot-instructions.md`, `.github/agents/*.agent.md`

**`.planning/`:**
- Purpose: Stores codebase maps and planning-state artifacts.
- Contains: generated analysis docs such as this structure/architecture map.
- Key files: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`

## Key File Locations

**Entry Points:**
- `index.html`: Browser entry document for Vite; defines the `#root` mount node.
- `src/main.tsx`: React root mount and StrictMode bootstrap.
- `server/index.js`: Node app startup; Express + Socket.IO server definition.

**Configuration:**
- `package.json`: App scripts, dependencies, and package metadata.
- `vite.config.ts`: Vite plugin setup and Socket.IO dev proxy.
- `tsconfig.json`: TypeScript compiler configuration.

**Core Logic:**
- `src/App.tsx`: Main app controller; room events, React state, WebRTC call handling, chat, and video state synchronization.
- `server/index.js`: Room registry, message buffer, validation, and peer signaling relay.

**Testing:**
- Not detected: this repo does not currently include a dedicated test directory or test runner configuration.

## Naming Conventions

**Files:**
- The repo uses a very flat file layout with a small number of top-level files and a single standard naming pattern for source files: `App.tsx`, `main.tsx`, `style.css`, and `index.js`.
- Lower-case names are used for application entry points and the server file, while the primary React source component uses PascalCase.

**Directories:**
- Top-level directories are terse and purpose-based (`src`, `server`, `dist`, `.github`).
- No nested feature folders or domain substructure are present yet; the project is organized by runtime concern rather than by feature area.

## Where to Add New Code

**New Feature:**
- Primary code: `src/App.tsx`
- Supporting style: `src/style.css`
- Server-side behavior: `server/index.js`

**New UI component or page:**
- Implementation: Add a new file under `src/` and import it from `src/App.tsx`.
- Prefer keeping the feature local to the same folder unless the feature becomes large enough to warrant a new subdirectory.

**New backend capability:**
- Implementation: Extend `server/index.js` with additional Socket.IO event handlers and validation helpers.
- Keep room state transformations near the existing `rooms` map logic to preserve the current monolithic server pattern.

**Utilities or helpers:**
- Shared helpers are not yet formalized; this repo currently relies on small local functions inside `src/App.tsx` and `server/index.js`.
- If utilities are introduced, the likely home is a new file under `src/` or a small dedicated helper module near the feature being added.

## Special Directories

**`dist/`:**
- Purpose: Generated build output for deployment.
- Generated: Yes
- Committed: Usually no in a real deploy setup, but this repo currently includes a checked-in example bundle.

**`node_modules/`:**
- Purpose: Installed package dependencies managed by npm.
- Generated: Yes
- Committed: No

**`.github/`:**
- Purpose: Tooling and workflow metadata for local GSD/agent integration.
- Generated: Partially
- Committed: Yes

---

*Structure analysis: 2026-10-10*
