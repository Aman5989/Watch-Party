<!-- refreshed: 2026-10-10 -->
# Architecture

**Analysis Date:** 2026-10-10

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                 Browser Client (React + TypeScript)          │
│  `index.html`  `src/main.tsx`  `src/App.tsx`  `src/style.css` │
├───────────────────────────────────┬─────────────────────────────┤
│ Real-time app state + UI logic    │ Media/peer orchestration    │
│ - room join / leave               │ - WebRTC peer setup         │
│ - chat + name sync                │ - local camera/mic capture  │
│ - shared video state              │ - remote stream rendering   │
└──────────────┬────────────────────┴──────────────┬──────────────┘
               │                                   │
               │ Socket.IO / WebSocket events      │
               ▼                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    `server/index.js`                         │
│  Express HTTP server + Socket.IO room registry              │
│  - room membership & viewer counts                           │
│  - chat history with last-100 memory buffer                  │
│  - shared media state validation and broadcast               │
│  - peer signaling relay (RTC offer/answer/candidate)         │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                  Browser-to-browser WebRTC                   │
│  Direct P2P streams between room participants               │
│  Uses public STUN server for ICE discovery                   │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App bootstrap | Mounts the React root and loads styles | `src/main.tsx` |
| Client state controller | Owns room ID, chat state, shared media state, peer state, and socket event wiring | `src/App.tsx` |
| UI shell | Renders room layout, video player, call controls, and chat panel | `src/App.tsx` |
| Styles | Defines the single-page visual system and responsive layout | `src/style.css` |
| HTML entry | Provides the root mount node and Vite script injection | `index.html` |
| Realtime server | Hosts the Express app, Socket.IO server, room state map, and static file fallback | `server/index.js` |
| Dev proxy | Proxies `/socket.io` to the local Node server during Vite dev mode | `vite.config.ts` |
| Production bundle | Built static assets served by the Node process when `dist/` exists | `dist/` |

## Pattern Overview

**Overall:** Single-page client with an in-memory realtime room server.

**Key Characteristics:**
- The app is intentionally small and centralized: most product behavior lives in `src/App.tsx` rather than a layered service tree.
- Room semantics are enforced by the server in `server/index.js`; the browser is a thin client that emits actions and reflects server state.
- Shared state is not persisted: room media state, chat history, and peer membership are held in process memory only.
- Browser media is handled locally and then exposed to peers through WebRTC, while the server only relays signaling and room metadata.

## Layers

**Presentation/UI layer:**
- Purpose: Renders the watch-room interface, player, chat, call controls, and room metadata.
- Location: `src/App.tsx`, `src/style.css`
- Contains: React component tree, event handlers, style tokens, layout rules
- Depends on: React, browser APIs, `socket.io-client`, WebRTC APIs
- Used by: Browser runtime; no server-side rendering

**Client orchestration layer:**
- Purpose: Synchronizes local user actions with server-side room state and manages peer connections.
- Location: `src/App.tsx`
- Contains: socket listener setup, media state sync logic, WebRTC negotiation, name/chat updates
- Depends on: browser `window`, `localStorage`, `navigator.mediaDevices`, `RTCPeerConnection`
- Used by: UI events in the React component

**Realtime transport layer:**
- Purpose: Manage room membership, chat history, shared video state, and signaling between participants.
- Location: `server/index.js`
- Contains: `io.on("connection")`, room `Map`, validation helpers, static file serving
- Depends on: Node.js, Express, Socket.IO
- Used by: browser clients through Socket.IO events

**Static serving layer:**
- Purpose: Serve the built frontend bundle when the app is run in production mode.
- Location: `dist/`, `server/index.js`
- Contains: bundled HTML and asset files built by Vite
- Depends on: `vite build` output, Express static middleware
- Used by: browser HTTP requests after app startup

## Data Flow

### Primary request path: joining a room and watching together

1. The browser loads `index.html`, then `src/main.tsx` mounts `<App />` (`index.html`, `src/main.tsx`).
2. `src/App.tsx` creates a room ID from the query string or generates a new one and connects with `io()`.
3. On connect, the client emits `room:join` and `profile:name`; the server validates the room and joins the Socket.IO room (`server/index.js`).
4. The server replies with `room:state`, `room:peers`, and `chat:history`, populating the current room, peers, and messages (`server/index.js`).
5. A user submits a video URL; the client emits `media:state` and updates the local `<video>` element. The server broadcasts the state to the room (`src/App.tsx`, `server/index.js`).
6. Each participant receives `media:state` and applies the shared playback position to their video element. When a user plays, pauses, or seeks, the same event pattern continues (`src/App.tsx`).
7. The room count updates live through `room:viewers` and `room:peers` events (`server/index.js`).

### Secondary flow: peer-to-peer audio/video call

1. A participant clicks “Join call”; the browser requests microphone and camera permission and stores the resulting `MediaStream` in `localStreamRef` (`src/App.tsx`).
2. The app iterates existing peers and calls `createPeerConnection(peer.id)`, creating a new `RTCPeerConnection` with a public STUN server (`src/App.tsx`).
3. Each connection adds local tracks and emits `rtc:signal` messages for offers, answers, and ICE candidates (`src/App.tsx`).
4. The server validates the target socket and relays the signal to the intended peer only (`server/index.js`).
5. The receiving peer handles offer/answer negotiation and adds remote candidate data with `connection.setRemoteDescription()` and `connection.addIceCandidate()` (`src/App.tsx`).
6. The connection `ontrack` callback stores the remote `MediaStream` in `remoteStreams`, which the UI renders as `<VideoTile />` components (`src/App.tsx`).

**State management:**
- Client state is primarily React local state plus a few refs for imperative WebRTC and synchronization bookkeeping (`src/App.tsx`).
- Server state is a single `rooms` map keyed by room ID; each room stores `state` and `messages` in memory (`server/index.js`).
- No relational database, persistence layer, or background worker model is present.

## Key Abstractions

**Room:**
- Purpose: A logical watch-party container keyed by a short room ID.
- Examples: `room:join`, `room:state`, `room:viewers`, `room:peers` in `server/index.js`
- Pattern: In-memory key/value state keyed by a room code string

**MediaState:**
- Purpose: Represents the shared video URL, playback time, and play/pause state.
- Examples: `type MediaState` in `src/App.tsx`, `server/index.js:isValidMediaState()`
- Pattern: Small DTO broadcast over Socket.IO; validated before acceptance

**PeerConnection:**
- Purpose: Represents a direct browser-to-browser media link for call participants.
- Examples: `peerConnections` map in `src/App.tsx`
- Pattern: Browser-managed `RTCPeerConnection` per remote peer with key/value map tracking

## Entry Points

**Browser entry point:**
- Location: `index.html`
- Triggers: An HTTP request to the app entry page or the Vite dev server
- Responsibilities: Loads the root element, injects the module entry, and sets page metadata

**Client bootstrap:**
- Location: `src/main.tsx`
- Triggers: Automatic on page load
- Responsibilities: Render the React app and mount it to the DOM

**Server boot:**
- Location: `server/index.js`
- Triggers: `npm run dev:server` or `npm start`
- Responsibilities: Start the Express server, bind Socket.IO, and optionally serve the built frontend

## Architectural Constraints

- **Threading:** The project is single-process Node.js for room state; concurrency is event-driven and Socket.IO-managed rather than worker-thread based.
- **Global state:** The room registry is a module-level `Map` in `server/index.js`; the client keeps a few module-level refs used for WebRTC negotiation (`src/App.tsx`).
- **Circular imports:** Not present; the app is intentionally flat and avoids a layered package structure.
- **Runtime assumption:** Browser camera/microphone permissions are required for video calls; the app cannot function without permission grants or valid network connectivity.
- **Network assumption:** Room participants must be able to reach each other directly or through a TURN relay; the default setup uses a public STUN server only.

## Anti-Patterns

### Monolithic UI controller

**What happens:** Nearly all application logic is concentrated in a single component in `src/App.tsx`.
**Why it's wrong:** It makes the client harder to reason about as features grow beyond room controls, chat, and peer setup.
**Do this instead:** Split room logic into feature modules such as `useRoomSocket`, `usePeerCalls`, or focused components for chat/video/player state.

### In-memory-only persistence

**What happens:** Room history and shared state are lost on server restart because `rooms` is a process-local `Map` in `server/index.js`.
**Why it's wrong:** It prevents durable room state and makes recovery impossible after restarts.
**Do this instead:** Move room data to a database or external storage layer if the app needs persistence or multi-instance deployment.

### Browser trust in client logic only

**What happens:** The server validates URLs and signal payloads but other client-side business rules are not enforced server-side.
**Why it's wrong:** A malicious client could emit invalid or abusive data unless the server centralizes more guards.
**Do this instead:** Add stricter server-side authorization and payload validation for chat, room membership, and signaling events.

## Error Handling

**Strategy:** Fail gracefully at the UI boundary and reject invalid network payloads at the server boundary.

**Patterns:**
- `src/App.tsx` catches camera access errors and sets a user-facing status message instead of crashing (`startCall`).
- `server/index.js` rejects malformed room IDs, invalid media URLs, and oversized signaling payloads before state changes occur (`isValidMediaState`, `isValidDescription`).
- Socket.IO events are fire-and-forget for user interaction; the UI does not hard-stop on a failed peer negotiation unless it sets `callError`.

## Cross-Cutting Concerns

**Logging:** Logging is minimal; the server uses `console.log` for startup only (`server/index.js`).
**Validation:** URL and payload validation occurs in `server/index.js`; some client input validation occurs in `src/App.tsx` before sending events.
**Authentication:** Not implemented; room access is effectively access via a shared room code and URL. There is no user identity or authorization layer beyond display names.

---

*Architecture analysis: 2026-10-10*
