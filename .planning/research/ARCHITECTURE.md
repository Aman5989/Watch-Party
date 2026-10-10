# Architecture Patterns

**Domain:** Self-hosted, single-room shared Chromium desktop inside a React/Express/Socket.IO watch party  
**Researched:** 2026-10-10  
**Confidence:** MEDIUM for the component and control-plane recommendation; LOW for unbenchmarked media performance and deployment-specific sandbox details.

## Recommended Architecture

Keep the existing Node/Express/Socket.IO application as the room control plane. Add one server-owned `BrowserSessionManager` that starts a headful Chromium process on a private virtual X display, starts one display-capture process, and accepts input only through server-validated Socket.IO events. The browser is a shared room resource, not a browser process per participant.

```text
 React room clients (few trusted invitees)
 ┌────────────────────────────────────────────────────────────┐
 │ Browser panel: latest JPEG frame + control/status UI       │
 │ Socket.IO: join/state/frame delivery + host/controller input│
 └──────────────────────────────┬─────────────────────────────┘
                                │ same-origin Socket.IO
                                ▼
 ┌──────────────────── Express + Socket.IO ──────────────────┐
 │ Room/Capability Authority                                  │
 │  - room membership, host capability, current controller    │
 │  - validates input and browser lifecycle requests          │
 │  - sends state and binary frame events only to room members│
 └──────────────────────────────┬─────────────────────────────┘
                                │ authorized commands / frames
                                ▼
 ┌──────────────────── BrowserSessionManager ─────────────────┐
 │ one-room lock; start/stop state machine; cleanup; limits    │
 │                                                              │
 │  Xvfb (private DISPLAY) ── headful Chromium                 │
 │           │                                  ▲              │
 │           ├─ FFmpeg x11grab → JPEG frames ────┘              │
 │           └─ xdotool/XTest input from authorized controller │
 └──────────────────────────────────────────────────────────────┘

 Existing direct-video sync, chat, and browser-to-browser call remain
 separate features; this is an additional server-originated stream.
 ```

 Use the display capture as a first, deliberately small-group transport: one FFmpeg capture/encode process, capped resolution and frame rate, binary JPEG frames sent only to members of the active room, and lossy/latest-frame delivery rather than a growing queue. The server should drop stale frames for slow clients. Keep input on small Socket.IO events and never interpret browser-generated frame events as trusted input. Validate this prototype's image quality, bandwidth, CPU use, and impact on chat/calls with the target few-client setup before fixing defaults.

This choice favors a simple, self-hosted first implementation over adding a media server. If measured image quality or egress cost is unacceptable, keep `BrowserSessionManager` and the input authorization contract, but replace only the frame transport with a server-originated WebRTC pipeline. Do not route Chromium capture through the current peer mesh: that mesh connects participant browsers to one another and does not capture the server's X display.

### Approaches Compared

| Approach | What it provides | Tradeoffs for this app | Recommendation |
|----------|-----------------|------------------------|----------------|
| **Headful Chromium + Xvfb + FFmpeg JPEG capture + Socket.IO frames/input** | Captures the entire virtual desktop, including Chromium's address bar, tabs, and menus. Reuses the current Node server and Socket.IO room boundary; input permission is checked before injecting X events. | JPEG is less bandwidth-efficient than inter-frame video; per-client fanout costs network egress; FFmpeg framing, slow-client dropping, and display geometry need a small prototype. | **Use for the first small-group vertical slice**, with conservative resolution/FPS and an explicit performance check. |
| **Xvfb + VNC server + noVNC/websockify** | Mature remote-desktop/RFB viewing and input path; noVNC speaks VNC over WebSockets and websockify can bridge WebSocket to a VNC TCP server. Naturally exposes the full display. | Each noVNC client normally has an input path. A client-side `viewOnly` UI setting is not server authorization. Safely enforcing one controller requires a server-side read-only VNC arrangement or a stateful input-filtering gateway, plus careful binding/authentication. | Good alternative if implementing a properly gated RFB proxy or a VNC server with verified per-client permissions; don't expose an ungated VNC/noVNC endpoint. |
| **FFmpeg capture + WebRTC/media server (e.g. a self-hosted relay)** | Better fit for interactive video delivery, codec compression, and network adaptation than JPEG screenshots. | Adds a media process/service, signaling and deployment configuration, and operational troubleshooting. Existing peer-to-peer WebRTC code is not a server screen-capture source; TURN may also be needed in restrictive networks. | Defer until the JPEG prototype demonstrates that transport is the bottleneck. Research and benchmark the specific media server before choosing it. |
| **Headless Chromium screenshots/CDP only** | Easy to automate and useful for page-level tests or a page-only preview. | Page screenshots do not capture browser chrome; CDP page input targets page content, not the complete browser desktop. It misses the requested full window experience. | Reject as the user-facing implementation. A process library can still be used to manage a headful browser on Xvfb if it preserves an isolated temporary profile. |

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `BrowserPanel` (React) | Shows current browser status/frame; renders host start/stop/navigation controls and controller grant/revoke UI; sends normalized pointer/key events. | Existing room socket; room/peer UI |
| Room socket handlers | Own room-scoped browser state and authorize host/controller requests; validate event shape, bounds and rate; emit state/frame updates to room members. | `rooms` map, socket identity/capability, `BrowserSessionManager` |
| `BrowserSessionManager` (new server module) | Single active session lock; process startup/readiness, navigation lifecycle, timeouts, process exit handling, stream fanout lifecycle and cleanup. Does not decide who may control—the room authority does. | Xvfb, Chromium, FFmpeg, xdotool; room handlers |
| Virtual display/browser process group | Provides one private desktop to capture and control. Chromium runs headful with browser UI visible, under a dedicated unprivileged OS user and with its sandbox enabled. | Manager; capture and input processes |
| Capture/frame pump | Reads one bounded capture stream, frames JPEG output, and emits only the newest bounded-size frame at a capped rate. | FFmpeg stdout; Socket.IO room |
| Input injector | Converts a small allowlisted event schema into X pointer/key events using fixed executable/argument mappings. Never passes arbitrary shell text. | Authorized room handler; X display |
| Existing watch-party modules | Continue media sync, chat, and participant WebRTC calls without acquiring browser process responsibilities. | Existing `server/index.js` room state and client socket |

Avoid letting `src/App.tsx` grow another full state machine. Keep the first client extraction minimal (`BrowserPanel` plus a focused hook/module for browser events); keep lifecycle and authorization on the server. No database, queue, worker service, or multi-instance coordination is justified for one ephemeral browser and process-memory rooms.

### Data Flow

1. A client joins its normal room. The server supplies browser status (`stopped`, `starting`, `running`, `stopping`, or `failed`), display dimensions, and current controller identity/name.
2. The host requests start. The server verifies the host capability and global single-session lock, reserves the room, and starts the display, browser, then capture process. Readiness is reported only after required processes are alive; partial startup is rolled back.
3. FFmpeg captures the X display (not a page screenshot). The server emits binary frame data to the active Socket.IO room with a sequence number. Frames are transient: no room history, disk recording, or persistent browser-video state.
4. The host may grant control to one connected room socket or atomically reclaim it. Each transfer changes the server's single `controllerSocketId` and releases any held keys/buttons; host moderation authority does not mean the host and guest can inject input simultaneously.
5. Browser input arrives as typed actions (pointer move/down/up/wheel, key down/up). The server checks that the sender is the single current controller, validates normalized coordinates and a narrow key/button schema, rate-limits/coalesces high-frequency moves, then injects events into the one X display.
6. Revoke, socket disconnect, room leave, idle timeout, explicit stop, child-process failure, or server shutdown releases pressed keys/buttons, stops capture and browser processes, removes the temporary profile, releases the display, and broadcasts final status.

### Authority and Lifecycle Model

- **Do not treat a display name, room membership, or client-provided `isHost` flag as identity.** This repo has no authentication and its room code is currently generated client-side with `Math.random()`. For host-only actions, create a cryptographically random room-owner capability on the server, store only its verifier, and return it only to the room creator (for example, one-time fragment-to-session exchange followed by removing it from the URL). Guests receive no owner capability. A room URL remains a bearer invite; this is suitable only for trusted invitees, not public multi-tenant hosting.
- Bind the active controller to exactly one current `socket.id` in that room. The host capability authorizes lifecycle and grant/revoke actions; input is accepted only from the socket currently named by `controllerSocketId` (initially the host). A host reclaim is an atomic transfer back to the host, not a second concurrent input permission. On disconnect/reconnect, revoke the guest grant and require a fresh host grant. Do not trust an old socket ID or client-side role restored from storage.
- Maintain one process-global browser lease, even though existing room maps permit multiple room IDs. Reject a second room's start request instead of accidentally sharing a desktop across rooms.
- Keep lifecycle state transitions serialized (`stopped → starting → running → stopping → stopped`, with a recoverable `failed` state). Protect duplicate start/stop/navigation requests with a manager-level mutex/generation ID. Define startup timeout, maximum session duration/idle timeout, process exit behavior, and graceful SIGTERM-then-SIGKILL fallback.
- Keep the profile in a new temporary directory per session. Never reuse the operator's Chrome profile or persist cookies/local storage. Remove it on every stop/failure path. Avoid exposing Chromium's remote-debugging port; bind any unavoidable automation/debug endpoint to loopback and do not proxy it to clients.
- Reconnection restores room/browser status and the latest frame only. It does not restore guest control. Since room state is process memory, a server restart is a stop, not a recoverable browser session.

### Security Boundary

The first release is for trusted friends and public pages; it is **not** a hardened hostile-tenant browser service. A disposable profile prevents cross-session persistence, but cannot technically stop someone with authorized keyboard control from typing a password into a public login form. Make the public-pages/no-credentials warning visible before starting; do not offer account sign-in or saved-profile import, and discard all profile data at stop.

Treat every page as hostile code. Keep Chromium's OS sandbox enabled, run it as a dedicated unprivileged user, and apply OS/container resource limits. Do not use `--no-sandbox` as a deployment workaround. Validate browser-control events on the server; never expose the VNC port, X socket, or Chromium debugging interface to the network. URL parsing alone is not an egress security boundary: redirects, scripts, subresources, DNS changes, and alternate IP encodings can reach local services. Apply outbound network restrictions at the host/container/firewall layer so the browser cannot reach loopback, private/link-local ranges, or cloud metadata; verify IPv4 and IPv6 behavior. If that egress control cannot be provided, explicitly limit deployment to a trusted isolated host and do not claim public-page navigation is safe against SSRF.

## Patterns to Follow

### Pattern 1: Server-authoritative control lease
**What:** Store `{ hostCapabilityHash, controllerSocketId, browserStatus }` in server-side room/session state. Every state-changing action rechecks socket membership and authority; clients only render the result.
**When:** Any time a room participant can inject input into a server-owned browser.
**Example:**
```js
function mayInjectInput(socket, session) {
  return socket.data.roomId === session.roomId &&
    socket.id === session.controllerSocketId;
}

socket.on("browser:input", (input, acknowledge) => {
  const session = browserSessions.get(socket.data.roomId);
  if (!session || !mayInjectInput(socket, session) || !isValidInput(input)) {
    acknowledge?.({ ok: false });
    return;
  }
  inputQueue.push({ sessionId: session.id, input, acknowledge });
});
```
The code is illustrative; the host role for lifecycle/grant actions must derive from a server-verified capability, not a client-set property. Only the current controller may inject input.

### Pattern 2: One owned process group, one cleanup path
**What:** Manager owns child process handles and the temporary directory. Start dependencies in order, register exit/error handlers immediately, and make stop idempotent. Cleanup is safe after partial startup.
**When:** The browser, display server, and capture encoder are external OS processes.
**Example:** Allocate session ID → create empty temp profile → start Xvfb → wait for display readiness → start headful Chromium → start FFmpeg capture → publish `running`. On any failure, unwind in reverse order and delete the profile.

### Pattern 3: Lossy video, reliable authority
**What:** Input, host grants, and lifecycle state use validated acknowledged control messages. Frames use bounded, replaceable binary messages; a slow viewer skips old frames rather than buffering seconds of stale screen.
**When:** Sending a low-rate JPEG proof-of-concept over existing Socket.IO.
**Example:** Cap capture FPS/resolution and JPEG size; tag frames with sequence and session ID; use volatile delivery or an equivalent drop policy; keep at most one pending/latest frame per slow client. Measure that this does not starve chat or WebRTC signaling.

### Pattern 4: Host-issued capability without accounts
**What:** Mint an unguessable room-owner secret server-side; guests know only the invite-room identifier. Store only a hash/verifier on the server and compare secrets in constant time. Scope host authority to one room and rotate/revoke it with room lifecycle.
**When:** The app has no accounts but needs host-only session and grant actions.
**Example:** Creator opens a one-time URL fragment containing the secret; the client sends it once to a same-origin claim event, the server validates it, and the client removes the fragment and retains the capability only for reconnect. Never broadcast or log that value.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Headless page screenshot presented as a full browser window
**What:** Capture `page.screenshot()` or CDP page viewport and label it full Chromium.
**Why bad:** It omits browser tabs/address bar/menus, which are required, and page-level input cannot fully control browser chrome.
**Instead:** Capture the headful Chromium desktop rendered on Xvfb.

### Anti-Pattern 2: Trusting noVNC's viewer-side read-only option
**What:** Tell guests to use a noVNC UI configured as view-only and assume that unauthorized input is impossible.
**Why bad:** A client-side restriction is bypassable by a modified client or direct websocket/RFB messages; the host's single-controller policy needs a server enforcement point.
**Instead:** Keep the browser input path behind validated server events, or prove that a chosen VNC gateway/server enforces per-connection read-only authorization server-side.

### Anti-Pattern 3: Reusing the current peer mesh as the browser video transport
**What:** Assume the current `RTCPeerConnection` mesh can share the server's display.
**Why bad:** Its source is each participant's local camera/microphone; the Node process has no captured display `MediaStream`. Making the server a WebRTC publisher is a separate media pipeline.
**Instead:** Begin with one server capture and bounded frame fanout; adopt a media server only after a measured need.

### Anti-Pattern 4: Treating the browser as a URL fetch helper
**What:** Validate only the initial URL protocol or deny a few hostname strings, then allow arbitrary public navigation from the app server.
**Why bad:** Browser redirects and page-originated requests can target internal services; address validation is vulnerable to DNS and IP representation edge cases.
**Instead:** Add host-level egress restrictions plus input validation and test private IPv4/IPv6, loopback, link-local, metadata IPs, redirects, DNS rebinding, and subresource requests.

### Anti-Pattern 5: Shared persistent profile or exposed remote-debugging port
**What:** Launch with an operator's normal profile, keep it between rooms, or expose CDP to room clients.
**Why bad:** Cookies, signed-in accounts, browsing data, and full browser control can escape the intended public-page-only session.
**Instead:** New temporary profile every time, no account import, loopback-only/no remote CDP, cleanup on every lifecycle exit.

### Anti-Pattern 6: Designing multi-room scale before validating one desktop
**What:** Add Redis, durable queues, an SFU cluster, database persistence, or browser-per-guest containers in the initial release.
**Why bad:** It increases deployment and failure modes without solving a current requirement; the bottlenecks are one browser's CPU, frame encoding and host egress.
**Instead:** Enforce a global one-session limit and instrument process health, frame rate, frame size, CPU/memory, and outbound bandwidth.

## Scalability Considerations

| Concern | One room / few friends (target) | 100 users | 10K users / 1M users |
|---------|--------------------------------|-----------|-----------------------|
| Chromium/display | One private Xvfb and Chromium process group; explicit memory/CPU cap. | Not supported by one shared desktop; isolate browser sessions and security domains before expansion. | Out of scope; requires a separate multi-tenant browser fleet and threat model. |
| Video egress | One capture encode fanned out to a few members; cap FPS/resolution, frame size, and drop stale frames. Benchmark at expected room size. | JPEG fanout likely needs replacement with a dedicated WebRTC/SFU or media relay and admission limits. | Dedicated distributed media and browser infrastructure; not a roadmap assumption. |
| Signaling/control | Existing single Socket.IO process, server-authoritative controller lease. | Add shared state/adapter only if multiple app processes become a real requirement. | Re-architect authorization, presence, quotas and media plane; current in-memory room model is unsuitable. |
| State/recovery | Ephemeral process-memory state; reconnect gets latest status/frame, not control. Server restart stops the browser and deletes profile. | Durable orchestration would add risk and is not warranted. | A dedicated platform and persistence design are required. |

## Dependency and Build Order

1. **Resolve identity/authorization first:** define room creation/owner capability and room invite semantics; specify host, controller, disconnect, reconnect, and leave transitions. The current no-auth, low-entropy client-generated room code is not sufficient authority for moderator actions.
2. **Prove the Linux display stack outside the React UI:** on the intended self-hosted OS, start Xvfb and headful Chromium as an unprivileged user, confirm visible browser chrome, capture with FFmpeg, inject pointer/key input, and exercise Chromium sandboxing. Write deployment prerequisites and resource limits.
3. **Build the server session manager and fake-process tests:** one-session lock, explicit state machine, readiness/failure/cleanup, timeouts, temp profile, shutdown hooks. Keep all external commands as fixed executable plus argument arrays, never shell-interpolated user input.
4. **Add server authorization and input injection:** typed payload validation, control lease, host revoke/reclaim, rate limits, event coalescing, release-all on disconnect/revoke, and tests proving an ordinary guest cannot inject input.
5. **Add frame fanout and focused room UI:** first test frame parser/drop policy and Socket.IO binary delivery; then add display, status, grant/revoke, keyboard/pointer handling to a `BrowserPanel`. Ensure media sync, chat, and calls remain independently usable.
6. **Harden and verify the boundary before inviting non-local users:** public-egress controls, profile deletion, no debug/VNC exposure, invite capability handling, process/resource limits, and adversarial URL/network tests. Measure CPU, memory, bandwidth, FPS/latency, slow-client behavior, reconnects, and concurrent start/stop races.
7. **Only then decide whether video needs WebRTC:** if prototype metrics miss an agreed quality/latency/bandwidth target, investigate a self-hosted media pipeline as a separate transport replacement; do not preemptively introduce it.

## Sources

Official and project sources checked on **2026-10-10**. Links below point to the relevant documentation; the date is the access/research date, not a claim that every page was published that day.

- Project context: [`.planning/PROJECT.md`](../PROJECT.md), [codebase architecture](../codebase/ARCHITECTURE.md), [codebase stack](../codebase/STACK.md), and current `server/index.js` / `src/App.tsx`.
- [X.Org Xvfb manual](https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml) — virtual framebuffer and virtual screen configuration.
- [FFmpeg x11grab device docs](https://ffmpeg.org/ffmpeg-devices.html#x11grab) — X11 display capture options. [FFmpeg formats docs](https://ffmpeg.org/ffmpeg-formats.html#mpjpeg) — multipart MJPEG framing (the documented section is a demuxer, not evidence of an output muxer).
- [Chromium sandbox design](https://chromium.googlesource.com/chromium/src/+/main/docs/design/sandbox.md) — sandbox threat model and OS security boundary.
- [Playwright BrowserType API](https://playwright.dev/docs/api/class-browsertype) — headless option, persistent context/profile directory and browser lifecycle (considered as an optional process-management library, not a requirement).
- [noVNC README](https://github.com/novnc/noVNC#readme) and [websockify](https://github.com/novnc/websockify) — RFB/WebSocket model and proxy relationship.
- [Socket.IO rooms](https://socket.io/docs/v4/rooms/) and [middleware](https://socket.io/docs/v4/middlewares/) — server room and connection hooks; app authorization still must be implemented in the handlers.
- [WebRTC peer connections guide](https://webrtc.org/getting-started/peer-connections/) and [W3C WebRTC specification](https://www.w3.org/TR/webrtc/) — browser peer media baseline.
- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html) — application and network defense-in-depth guidance.

**Source-confidence note:** Automated web search was unavailable in this environment, and the source classifier returned LOW for direct `webfetch` fallback. Therefore no performance benchmark, exact VNC per-client authorization claim, or deployment-specific security guarantee is presented as established fact. The selected component boundaries are a recommendation to validate on the target Linux deployment, not a claim that the current repository already supports it.
