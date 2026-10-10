# Coding Conventions

**Analysis Date:** 2026-10-10

## Naming Patterns

**Files:**
- The project keeps a flat source layout with a small number of top-level files: `src/App.tsx`, `src/main.tsx`, `src/style.css`, `server/index.js`, `vite.config.ts`, and `tsconfig.json`.
- File names stay simple and shallow; there is no deep feature directory structure or module namespace pattern.
- Example: `src/App.tsx` contains the main React screen and a helper component named `VideoTile`, while `src/main.tsx` handles mount-time bootstrapping with `createRoot(...)`.

**Functions:**
- Function names follow `camelCase` and are action-oriented: `createRoomId`, `getInitialRoomId`, `getInitialName`, `handleSignal`, `startCall`, `toggleTracks`, and `saveName` in `src/App.tsx`.
- Event handlers consistently use `handle` or `on` prefixes, such as `handleSetVideo`, `onVideoEvent`, and `onVideoProgress` in `src/App.tsx`.
- Server-side validation helpers use descriptive predicate names: `isValidDescription` and `isValidMediaState` in `server/index.js`.

**Variables:**
- Local state and refs use `camelCase` with explicit names: `mediaUrl`, `remoteStreams`, `peerConnections`, `localStreamRef`, and `chatMessages` in `src/App.tsx`.
- Type aliases use PascalCase and are declared at the top of the file, for example `MediaState`, `RoomState`, `Peer`, and `ChatMessage` in `src/App.tsx`.

**Types:**
- TypeScript types are declared inline in the component file rather than in separate `types/` or `interfaces/` files.
- Example: `src/App.tsx` defines the room model and signal shape directly next to the logic that consumes them.

## Code Style

**Formatting:**
- The codebase uses semicolons, double quotes for string literals, trailing commas, and 2-space indentation consistently across `src/App.tsx`, `src/main.tsx`, and `server/index.js`.
- Example import style from `src/main.tsx`:

```ts
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
```

**Linting:**
- No ESLint or Prettier configuration files are present in the repository root. `package.json` includes no `lint` script, and no `.eslintrc*`, `eslint.config.*`, or `.prettierrc*` files were detected.
- This means formatting/lint enforcement is not currently configured; the style is enforced by convention rather than tooling.

## Import Organization

**Order:**
1. External packages (`react`, `socket.io-client`, `express`, `socket.io`)
2. Node built-ins (`node:http`, `node:fs`, `node:path`)
3. Relative imports (`./App`, `./style.css`, and local paths)

**Path aliases:**
- Not detected. Imports are direct package names or relative paths. `src/App.tsx` imports from `react` and `socket.io-client`, and uses relative paths for local modules in the same directory; there is no `@/` or `~` path alias in `tsconfig.json`.

## Error Handling

**Patterns:**
- Runtime errors are handled with explicit `try/catch` blocks and user-visible messages via `setMessage(...)` or `setCallError(...)` in `src/App.tsx`.
- Example from `src/App.tsx`:

```ts
try {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localStreamRef.current = stream;
  setLocalStream(stream);
  setCallActive(true);
} catch (error) {
  setCallError(
    error instanceof Error && error.name === "NotAllowedError"
      ? "Allow camera and microphone access in your browser to join the call."
      : "Could not access your camera or microphone. Check your device settings.",
  );
}
```

- Server-side code performs defensive validation before processing socket payloads. Example in `server/index.js`:

```js
if (typeof roomId !== "string" || !roomIdPattern.test(roomId)) return;
if (!roomId || !isValidMediaState(state)) return;
```

- Input validation is mostly done inline, without custom error classes or centralized middleware.

## Logging

**Framework:**
- The app uses `console.log` only in the server startup path (`server/index.js`):

```js
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Watch party server listening on http://localhost:${port}`);
});
```

**Patterns:**
- Frontend logging is intentionally sparse. `src/App.tsx` uses UI state (`message`, `callError`) for user feedback instead of a logger.
- No structured logging library (Pino, Winston, Sentry, etc.) is configured.

## Comments

**When to Comment:**
- Comments are minimal. The code favors descriptive names over explanatory comments.
- There are no large JSDoc blocks or API documentation comments in the app source.

**JSDoc/TSDoc:**
- Not detected. The repo does not include JSDoc comments for public functions or TypeScript interfaces.

## Function Design

**Size:**
- The codebase favors medium-sized functions that handle a specific event or socket action, not tiny helper-only utilities.
- Example functions in `src/App.tsx` such as `applyVideoState`, `receiveMediaState`, and `handleSignal` encapsulate related logic without splitting every step into separate files.

**Parameters:**
- Functions generally take a small number of arguments and rely on closure state (`roomId`, `socketRef.current`, etc.) rather than large config objects.

**Return Values:**
- The code returns `void` for many event handlers and UI actions; only simple data transforms like `createRoomId()` and `getInitialRoomId()` return values.

## Module Design

**Exports:**
- `src/App.tsx` is the default export for the application root component.
- `src/main.tsx` is the bootstrap entry that mounts the app into the DOM.
- `server/index.js` uses module-level logic and does not expose reusable modules from a package boundary.

**Barrel Files:**
- Not detected. There is no `index.ts` export layer or shared barrel pattern across the codebase.

**Component pattern:**
- The app is organized around one top-level React component in `src/App.tsx` with helper subcomponents defined in the same file (`VideoTile`).
- State is centralized in `App`, and child UI updates derive from that state via props and socket events.

---

*Convention analysis: 2026-10-10*
