# Technology Stack

**Analysis Date:** 2026-10-10

## Languages

**Primary:**
- TypeScript 5.9.2 - Used for the React client in `src/App.tsx`, `src/main.tsx`, and the browser-side state management and WebRTC logic in `src/App.tsx`.
- JavaScript (Node.js runtime) - Used for the realtime server in `server/index.js` and the process scripts in `package.json`.

**Secondary:**
- HTML - `index.html` loads the app and mounts into the `#root` element.
- CSS - `src/style.css` contains the app styling, room layout, and connection state visuals.

## Runtime

**Environment:**
- Node.js 20+ recommended - Documented in `README.md` and required for Express + Socket.IO runtime in `server/index.js`.
- Browser runtime - Client app runs in the modern browser environment through `src/main.tsx` and `src/App.tsx`.

**Package Manager:**
- npm - The repo uses `npm run dev`, `npm run build`, and `npm start` defined in `package.json`.
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- React 19.1.0 - Client-side UI framework used by `src/App.tsx` and rendered from `src/main.tsx`.
- Express 5.1.0 - HTTP server and static file host used in `server/index.js`.
- Socket.IO 4.8.1 - Real-time room state, chat, and signaling transport used by both the server and client.

**Testing:**
- Not detected - no test runner or spec files are present under the project root; there are no `jest.config.*`, `vitest.config.*`, or `*.test.*` / `*.spec.*` files in the repo snapshot.

**Build/Dev:**
- Vite 6.3.5 - Frontend dev server and production bundler defined in `vite.config.ts`.
- TypeScript 5.9.2 - Strict type checking enforced by `tsconfig.json`.
- concurrently 9.2.0 - Runs the client and server together in the `dev` script from `package.json`.

## Key Dependencies

**Critical:**
- `react` / `react-dom` 19.1.0 - Render the watch-room interface and local UI state.
- `express` 5.1.0 - Serves the app, static assets, and the Socket.IO endpoint from `server/index.js`.
- `socket.io` / `socket.io-client` 4.8.1 - Handles room membership, chat sync, shared media state, and WebRTC signaling.

**Browser/integration primitives:**
- `RTCPeerConnection` - Used in `src/App.tsx` for peer-to-peer audio/video calls and direct media mesh negotiation.
- `MediaStream` / `navigator.mediaDevices.getUserMedia` - Used for microphone and camera capture in `src/App.tsx`.

## Configuration

**Environment:**
- Local env configuration is not checked into the repo; the app reads runtime values such as `PORT` from process env as seen in `server/index.js`.
- `server/index.js` binds the server to `0.0.0.0` and defaults to port `3001` when `PORT` is unset.

**Build:**
- `package.json` defines `dev`, `build`, and `start` scripts for the Vite frontend and Node server.
- `vite.config.ts` configures a Socket.IO proxy at `/socket.io` pointing to `http://localhost:3001` and enables the React plugin.
- `tsconfig.json` sets strict mode and DOM/ES2022 targeting for the frontend code.

## Platform Requirements

**Development:**
- Node.js 20+ and npm are required according to `README.md`.
- A browser with camera and microphone permission support is required for the WebRTC audio/video call feature.

**Production:**
- The app is designed to run as a Node.js process on any reachable machine; `README.md` states the host and network reachability are the operator’s responsibility.
- Express serves the built frontend from `dist/` when present, and can be launched via `npm start` after `npm run build`.

---

*Stack analysis: 2026-10-10*
