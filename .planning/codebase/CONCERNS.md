# Codebase Concerns

**Analysis Date:** 2026-10-10

## Executive Summary

This repository is a lightweight watch-party starter, not a production Hyperbeam-like shared-browser platform. The current implementation is intentionally small and intentionally user-hosted, but it also carries several constraints that matter if the product is scaled beyond a local room prototype. The concerns below separate verified facts from recommendations.

## Tech Debt

### 1) In-memory session state is the default architecture
- Verified fact: `server/index.js` keeps room state in a process-local `Map` (`rooms`), and each room stores `state` and `messages` in memory.
- Verified fact: `README.md` explicitly says, "Room state is held in server memory and disappears when the server restarts."
- Impact: crashes, redeploys, and rolling restarts wipe out room session state; there is no durable model, recovery path, or multi-instance coordination. This is a major blocker for a product that needs persistence and continuity.
- Recommendation: add a persistent room model (database or object store) and move room/session metadata out of process memory before the app is treated like a real service.

### 2) The client is a single-file state machine with a lot of WebRTC complexity
- Verified fact: almost all app logic lives in `src/App.tsx` and centralizes room state, peer negotiation, chat, media sync, and call setup in one component.
- Verified fact: the file includes a large set of WebRTC-specific refs (`peerConnections`, `makingOffer`, `ignoreOffer`, `politePeers`, `localStreamRef`, etc.) plus multiple socket event handlers.
- Impact: the code is harder to reason about, easier to regress, and vulnerable to signaling edge cases during reconnects, renegotiation, or peer disconnects. It is also difficult to extend with moderator controls, persistent participants, or richer room features without refactoring.
- Recommendation: split room orchestration, chat, media sync, and WebRTC signaling into dedicated modules/services, even if the app remains a small MVP for now.

### 3) There is no automated test coverage for the application logic
- Verified fact: `package.json` contains build and dev scripts only; there is no `test` script.
- Verified fact: app source files under `src/` and `server/` do not include an app-level `*.test.*` or `*.spec.*` suite, aside from dependencies under `node_modules/`.
- Impact: call handshake behavior, chat edge cases, room lifecycle, and media synchronization remain unguarded by regression tests. This makes a Hyperbeam-style product extremely risky to extend safely.
- Recommendation: add at least unit tests for room validation and media-state logic, plus integration tests for signaling and reconnect flows before broad feature work.

## Known Bugs / Fragile Areas

### 4) Room IDs are lightweight and easy to guess or collide
- Verified fact: `src/App.tsx` creates room IDs with `Math.random().toString(36).slice(2, 8)`, which is not cryptographically strong.
- Verified fact: `server/index.js` accepts any room ID matching `/^[a-zA-Z0-9-]{1,48}$/` without access checks or invite tokens.
- Impact: a room is effectively discoverable by brute force or by id guessing. This is not acceptable for a product that needs private rooms or moderation.
- Recommendation: use secure random IDs with longer entropy and add authorization checks for room access or invite-based entry.

### 5) WebRTC peer setup is fragile in real-world network conditions
- Verified fact: `src/App.tsx` creates `RTCPeerConnection` instances with only a public STUN server (`stun:stun.l.google.com:19302`).
- Verified fact: `README.md` states that restrictive networks may require a TURN relay and that network reachability costs may apply.
- Verified fact: `handleSignal` has negotiation logic for offers/answers/candidates and uses `ignoreOffer` and `politePeers` to prevent collisions; this is a sign the signaling flow is complex and error-prone.
- Impact: call quality and successful connections depend heavily on direct connectivity and can fail behind NATs, symmetric firewalls, or restrictive corporate networks. This is a major fragility for a Hyperbeam-like product that must support many real-world clients.
- Recommendation: add explicit TURN support, connection health checks, and retry/backoff logic before relying on peer-to-peer calls for product usage.

### 6) Call behavior is vulnerable to unsupported browsers and permission edge cases
- Verified fact: `src/App.tsx` calls `navigator.mediaDevices.getUserMedia({ video: true, audio: true })` in `startCall()` without feature-detection or fallback.
- Verified fact: if access is denied, the UI shows a user-facing error but there is no alternative path or degraded mode for users without camera/microphone hardware.
- Impact: the product can fail on unsupported browsers, locked-down devices, or enterprise environments. This is a feature limitation and a reliability risk, not just a UX issue.
- Recommendation: detect `navigator.mediaDevices`, surface a consistent unsupported-browser message, and offer non-video fallback flows where appropriate.

### 7) Video state synchronization is intentionally simplistic and can drift
- Verified fact: `src/App.tsx` tracks a shared `playbackUrl` and publishes `MediaState` events with `url`, `currentTime`, and `paused`.
- Verified fact: `applyVideoState()` only updates when `video.src === state.url` and the same source is loaded; it also avoids sending state while a remote update is being applied.
- Impact: the synchronization model is intentionally best-effort and will drift for streams with divergent buffering, different browser implementations, or source changes that do not match the same URL precisely. It is not a robust media sync system for a race-free watch party.
- Recommendation: use a stronger clocking model, source identity checks, and room-level playback authority design before scaling beyond a simple shared stream demo.

## Performance Bottlenecks

### 8) The architecture scales as a mesh, not as a shared room service
- Verified fact: each participant opens a peer connection in `src/App.tsx` via `createPeerConnection(peerId)` and stores remote streams in a map keyed by peer ID.
- Verified fact: `README.md` explicitly states that the peer-to-peer mesh is suitable for small groups and "uses more bandwidth on each participant as the room grows."
- Impact: the system has an O(n²) fan-out pattern in calls, which is the classic scaling limit for mesh WebRTC. A large or busy room will saturate browser bandwidth and CPU before reaching product-grade scale.
- Recommendation: if the product is to become Hyperbeam-like, move to a relay/SFU model for media distribution, not a peer-only mesh.

### 9) Room state and chat fan-out are process-local and unoptimized
- Verified fact: `server/index.js` emits chat messages and state changes directly to room sockets; the server does not paginate, cache, or stream in a more scalable way.
- Verified fact: the room `Map` is kept in memory and never persisted or sharded.
- Impact: once there are many rooms or participants, the process becomes a single bottleneck and the room join/fan-out pattern will not handle broader traffic without additional infrastructure.
- Recommendation: add Redis, a pub/sub layer, or a hosted websocket/relay service before scaling to multiple server instances.

## Security Considerations

### 10) Room access is not protected by authentication or invite controls
- Verified fact: `server/index.js` only validates that `roomId` is the expected shape and then joins the socket to the room.
- Verified fact: there is no user auth check, room secret, invite token, moderator gate, or permission system in the server or client.
- Impact: anyone who knows or guesses the room ID can enter, and anyone in the room can receive stream and chat data. This is acceptable for a local demo but not for a real broadcast product.
- Recommendation: add room-level authorization, signed invite links or host-generated codes, and moderation controls before exposing the app beyond trusted networks.

### 11) No explicit origin or CORS policy is configured for the Socket.IO server
- Verified fact: `server/index.js` creates `new Server(httpServer)` with no explicit `cors` options or origin restrictions in the file.
- Impact: the default behavior is acceptable for a single-host local demo, but it becomes a security and deployment concern when the server is exposed externally.
- Recommendation: define explicit allowed origins and reject unexpected clients before production deployment.

### 12) Shared media URLs are passed directly to the browser without filtering beyond protocol checks
- Verified fact: `src/App.tsx` accepts `http:` or `https:` URLs and sends them to the video element; `server/index.js` validates the same protocols before relaying room media state.
- Impact: the app is not a remote-browser product; it simply plays a browser-loadable URL. This creates trust and safety concerns if users can paste arbitrary external links or if the source host is malicious or abusive.
- Recommendation: add source allowlisting, safe URL handling, and policy controls if the project is expanded beyond a local watch-room MVP.

## Feature Limitations vs Hyperbeam-Like Product Goals

### 13) The app does not provide a shared browser or remote interaction layer
- Verified fact: `README.md` explicitly says, "This starter does not embed YouTube or provide a shared remote browser."
- Verified fact: `src/App.tsx` does not render a remote page, remote DOM, or remote control surface; it only loads a media file URL in a local HTML5 video element.
- Impact: there is no browser-sharing primitive, no remote site navigation, and no synchronized web app layer. This is a fundamental gap between this project and a Hyperbeam-like product.
- Recommendation: if the goal is Hyperbeam parity, the architecture needs a remote browser runtime, presentation layer, and secure content isolation rather than a simple collaborative video player.

### 14) There is no deployment model for scaling or protecting real traffic
- Verified fact: `README.md` says the app requires an externally reachable host for people outside local network and mentions network reachability, router configuration, and potential TURN costs.
- Verified fact: `server/index.js` listens on port 3001 and serves bundled assets from `dist`, but there is no production deployment configuration, reverse proxy, TLS, or operational guardrails in the repo.
- Impact: the app is not deployment-ready for a public service. It is a self-hostable starter, not a managed service architecture.
- Recommendation: add HTTPS, an ingress/reverse proxy, health checks, rate limiting, and a deployment target (or managed infrastructure) before treating this as a product platform.

## Recommendations for a Hyperbeam-Like Direction

- Add a real room/auth/session model with persistence and server-side authorization.
- Replace the peer-to-peer mesh with an SFU/relay architecture for large-group media and screen-sharing.
- Introduce explicit TURN relay support, connectivity health checks, and fallback handling for restrictive networks.
- Separate client concerns into modules for room state, call signaling, chat, and playback synchronization.
- Add regression tests around room joins, disconnects, media updates, and call negotiation.
- Build a remote-browser or remote-streaming abstraction if the target is truly Hyperbeam-like, rather than a shared-video viewer.

## Bottom Line

The codebase is a compelling tiny MVP and a good self-hosted starting point, but it is not yet a production-ready Hyperbeam-style system. The largest risks are room security, in-memory state loss, WebRTC mesh scaling limits, and lack of a durable architectural foundation. Those are the main blockers to turning the current prototype into a broadly usable collaborative browser/watch product.

---

*Concerns audit: 2026-10-10*
