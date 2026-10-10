# Domain Pitfalls

**Domain:** Self-hosted shared Chromium controlled by watch-room participants  
**Researched:** 2026-10-10  
**Overall confidence:** MEDIUM

This project is a small, single-room prototype, not a hardened remote-browser service. The current Node/Express/Socket.IO server accepts shaped room IDs without authentication, keeps room state in memory, has no explicit CORS policy, and has no browser isolation or remote-input authorization yet. Treat a navigated page and every participant who can control the browser as potentially hostile. "Public pages only" is a product rule, not a network security boundary.

## Critical Pitfalls

### Pitfall 1: A public starting URL can still reach private and metadata networks
**What goes wrong:** A public page can redirect, open popups, load scripts/images/iframes, or otherwise cause the browser to request `localhost`, private/link-local addresses, or cloud instance metadata endpoints. A controller can also type a private URL directly. Same-origin policy limits some reads; it does not make the browser's network requests harmless. A URL parser that accepts only `http:` and `https:` (as the current media URL validator does) is not an SSRF defense.

**Why it happens:** Chromium is intentionally able to make network requests for arbitrary sites. Top-level URL checks do not govern all subresources, redirects, DNS changes, WebSockets, or subsequent navigation. OWASP recommends defense in depth and network-layer restrictions as well as careful destination validation.

**Consequences:** Requests may probe internal services, reach host-local admin endpoints, or expose cloud credentials through metadata services. Browser-side content restrictions cannot reliably establish that the destination is public.

**Prevention:** Before enabling remote navigation, put the browser in an OS-level isolation boundary with explicit outbound policy: deny loopback, private, link-local, multicast, and metadata destinations for both IPv4 and IPv6; allow only the intended public egress; enforce this at the network layer on every connection. A dedicated OS account/network namespace plus host firewall rules, a jail/VM, or a container can provide boundaries; a container is not the only mechanism, but simple URL checks are not a substitute. Add application-side URL checks as defense in depth, re-check redirects/resolutions, limit schemes and ports, and disable unnecessary protocols. If this egress policy cannot be installed and tested, do not expose the browser session to the public internet or claim arbitrary public-page navigation is safe.

**Detection:** Tests show requests to `127.0.0.1`, `::1`, RFC1918/ULA, link-local, or metadata endpoints leaving the browser; redirects or DNS changes bypass URL checks; the browser has unrestricted outbound access; navigation is permitted through keyboard shortcuts even when the UI rejects the URL.

### Pitfall 2: Chromium's renderer sandbox is mistaken for host or network isolation
**What goes wrong:** A hostile page exploits a renderer bug or abuses the browser's privileged broker/network process, then gains access to files, local services, or credentials available to the Node app's operating-system identity. Running Chromium with `--no-sandbox`, as root, or with the app's ordinary user profile makes the consequences worse.

**Why it happens:** Chromium's sandbox is important defense in depth, but it is process/OS dependent. Chromium describes the browser process as a privileged broker and treats sandboxed code as potentially malicious. A renderer sandbox does not enforce the application's destination policy, protect the Node process from every browser-process compromise, or create a tenant boundary.

**Consequences:** A browser compromise can become a host compromise; on the same user/account it may expose app files, environment secrets, sockets, or other room data.

**Prevention:** Keep the Chromium sandbox enabled; never add `--no-sandbox` to make deployment easier. Run the browser as a dedicated unprivileged OS identity with no app secrets, no access to source/configuration files, and no shared host profile. Apply OS resource limits and network egress restrictions. Keep the Node app and browser control protocol inaccessible from page content and room clients. For public exposure to arbitrary pages, require an additional OS-level isolation and egress boundary; if the chosen direct-on-host setup has neither, limit use to a private trusted deployment.

**Detection:** Chromium starts only with sandbox disabled, runs as root/the app owner, uses the developer's normal profile, or can read `.env`/deployment keys; a browser crash affects the Node service or leaves an unrestricted browser process alive.

### Pitfall 3: Room membership is confused with authorization; controller handoff races
**What goes wrong:** Anyone who guesses or learns a room ID joins, then receives the shared screen or sends input. During grant/revoke, a stale socket, reconnect, or two near-simultaneous control requests can leave two controllers active or allow the former controller to keep sending input.

**Why it happens:** Socket.IO rooms are a message-routing mechanism, not proof of identity or permission. In this repository, `room:join` checks only the room-ID shape, and there is no authentication, host identity, invite token, or permission system. Socket IDs change on reconnect and should not be treated as durable user identities.

**Consequences:** Unauthorized viewing/control, browser navigation after revocation, cross-room input, and moderator lockout. Browser input can reach browser chrome as well as page content.

**Prevention:** Make server-side authorization a prerequisite, before adding browser events: create unguessable room/invite credentials; authenticate the host and members; validate room membership and role on every browser-control event; never rely on client UI state or a supplied participant ID. Store the controller and a monotonically increasing grant epoch in authoritative room state, and change them atomically. Require the current epoch on each input event; revoke on host action, disconnect, room leave, and timeout; invalidate old sockets on reconnect. Give one identity exclusive control, make host revocation immediate, rate-limit events, and validate mouse coordinates/buttons, key names, text length, and event type. Do not expose a general CDP/VNC-control endpoint to clients.

**Detection:** The client can emit input before joining; the server trusts a client-supplied host/controller flag; old socket IDs remain authorized; duplicate grant events produce two controllers; unauthorized guests can request frames or see the stream.

### Pitfall 4: Full-desktop capture leaks more than the browser page
**What goes wrong:** Room members see host desktop notifications, another window, terminal/log output, file chooser dialogs, browser downloads, tab titles, URLs, or account details. A remote-control connection may also operate the entire desktop rather than one page.

**Why it happens:** Headless Chrome has no visible UI, and a Playwright page screenshot captures page content rather than the full native browser chrome. Capturing browser chrome therefore requires headed Chromium on a display (for example, a virtual X display) plus desktop capture or VNC/noVNC. Desktop capture broadens the privacy boundary; VNC-style input is desktop-level control unless an authorization gateway constrains it.

**Consequences:** Accidental disclosure of server/operator information, credentials, private URLs, or files; browser chrome can also provide controls to navigate away from approved pages.

**Prevention:** Use a dedicated, disposable display containing only the shared browser—not the operator's desktop. Disable notifications, clipboard sharing, host file mounts, and unnecessary desktop services; prevent downloads/file chooser access; use a neutral background and a fixed capture region. Confirm what the capture path includes (browser chrome, dialogs, cursor, notifications) on each supported OS. Put any VNC server and WebSocket proxy on loopback/private interfaces; place TLS, authentication, room authorization, and per-event controller enforcement at the room-facing gateway. Treat the address bar as a navigation surface requiring the same policy as URL submission.

**Detection:** The stream includes a host desktop or unplanned dialogs; noVNC/VNC listens on `0.0.0.0`; a room client can connect directly to the VNC/debug port; page-only screenshots are being presented as full browser chrome.

## Moderate Pitfalls

### Pitfall 5: Cookies or profile data survive after a "public-only" session
**What goes wrong:** Cookies, local storage, downloads, cache, or a prior login remain available to the next room session; a public site may also display personal account data if someone signs in.

**Prevention:** Start each room session with a new non-persistent Playwright `BrowserContext` or a new disposable browser profile. Never point Chromium at a normal user profile; do not use persistent contexts or export/import `storageState`; do not keep passwords, autofill, sync, or account sign-ins. Remove temporary profile/download directories and close the context/browser on stop, crash, or idle timeout. Show a clear public-pages-only reminder and do not treat a fresh context as permission to sign in.

**Detection:** A cookie or local-storage value is present at session start; the same user-data directory is reused; `storageState` or downloads are retained; a browser restart restores the previous login.

### Pitfall 6: One unbounded page exhausts the host or leaves orphan browser processes
**What goes wrong:** A page spawns popups/tabs, loops scripts, downloads large files, consumes CPU/memory, or streams continuously. A browser crash or room disconnect leaves child processes and framebuffer/encoder resources running. Because Node and Chromium share the server, resource exhaustion can take down chat and signaling too.

**Prevention:** Enforce one browser session, one tab, and a small participant cap. Block or close popups, deny downloads, set navigation and idle/session timeouts, bound frame rate/resolution/bitrate, and rate-limit navigation and input. Apply OS-level CPU, memory, process-count, and file-descriptor limits to the browser/display/encoder processes; supervise and reap the whole child process tree. On shutdown or loss of the host, close the context and browser, terminate stragglers, delete temporary data, and release the display/capture pipeline. Test this under crashes and repeated start/stop, not only normal shutdown.

**Detection:** Browser memory/CPU or process count grows over time; session stop leaves Chromium/Xvfb/encoder children; Node event-loop latency rises during capture; clients can create unlimited tabs or request unlimited frame rates.

### Pitfall 7: STUN-only WebRTC is assumed to work everywhere or cost nothing
**What goes wrong:** Calls or a browser stream fail behind restrictive NAT/firewalls because peers cannot form a direct path. Adding TURN fixes reachability but can relay all media, multiplying outbound bandwidth and exposing an unauthenticated relay to abuse.

**Why it happens:** The current app uses a public STUN server only (per codebase audit); STUN discovers connectivity but does not relay media. The WebRTC guide says direct sockets are often impossible and identifies TURN as the common relay solution.

**Prevention:** Make TURN a deliberate, self-hosted option (coturn is open source) with short-lived credentials, restricted relay ports, rate/usage monitoring, and documented firewall requirements. Measure whether the browser stream and existing calls use direct or relay candidates; cap resolution/bitrate and participant count. Provide an honest degraded/failure state when no relay is configured. "No paid APIs" avoids a vendor fee, not bandwidth, server, public-IP, or operator costs.

**Detection:** Repeated ICE failure in restrictive networks; no `relay` candidate in tests expected to require TURN; unexpected egress spikes; TURN accepts unauthenticated or long-lived credentials; users assume STUN is a relay.

### Pitfall 8: The chosen browser-control/capture stack silently exposes privileged interfaces
**What goes wrong:** The Chromium remote-debugging port, raw VNC port, or unauthenticated WebSocket proxy becomes reachable by guests or the internet. These interfaces can inspect pages, navigate, inject input, or control the browser beyond the intended UI.

**Prevention:** Keep CDP and VNC endpoints bound to loopback or an isolated internal interface, firewall them from room clients, and proxy only the minimum required operations through authenticated server-side code. Terminate TLS at the public edge and authorize WebSocket upgrades by room/session identity; validate origin as defense in depth, not as the only authorization. Avoid logging credentials or browser protocol payloads.

**Detection:** Debug/VNC ports appear in public port scans; browser devtools JSON endpoints respond to room clients; proxy URLs work without an authenticated room session; logs contain cookies, page contents, or input text.

## Minor Pitfalls

### Pitfall 9: "Full browser window" expectations exceed what the capture method can show
**What goes wrong:** A page screenshot omits browser chrome, while headless mode has no visible UI. Even a headed virtual display may not reproduce native OS dialogs, hardware-accelerated overlays, protected media surfaces, or all desktop behavior consistently across systems.

**Prevention:** Decide and demonstrate whether the product promises the page viewport, a Chromium window including its chrome, or a complete desktop. For full chrome, test a headed browser on the isolated display with the actual capture stack. Document unsupported dialogs/content and do not imply that a screenshot API captures the whole browser.

**Detection:** Address bar/tabs are missing from the product demo; platform-specific dialogs appear black or outside the capture region; implementation calls `page.screenshot()` but requirement says "full browser window."

### Pitfall 10: Room and control behavior is tested only on the happy path
**What goes wrong:** Unauthenticated joins, disconnect/reconnect, host departure, rapid handoff, malformed input, browser crash, or cleanup regressions re-open access or strand the session. The current codebase has no app test suite.

**Prevention:** Add automated server tests before exposing the feature: unauthorized room join/input, grant/revoke ordering, stale epoch, reconnect, host/controller disconnect, malformed and flood input, navigation to blocked addresses/redirect chains, clean profile startup, and child-process cleanup. Add operational smoke checks for sandbox enabled, private listener binding, and egress policy.

**Detection:** Security behavior is verified only by manual clicking; the project has no tests for room authorization, resource cleanup, or blocked destinations.

## Phase-Specific Warnings

Phase numbering below is a proposed dependency order; align labels/numbers with the roadmap.

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| 1. Security/deployment gate | Treating public-only URLs or a trusted group as isolation; current room joins are unauthenticated | Decide private/VPN-only versus internet exposure first. Implement identity/invites, room authorization, HTTPS/origin policy, OS browser identity, and tested network egress restrictions before opening remote navigation. |
| 2. Browser runtime and capture | Disabling Chromium sandbox or using page screenshots while promising full chrome; exposing VNC/CDP | Preserve sandbox; use disposable profile/context and dedicated display; decide the capture boundary; bind VNC/CDP privately and proxy only required functions. |
| 3. Remote input and host moderation | Multiple/stale controllers, keyboard escape into browser chrome, unrestricted desktop control | Implement atomic server-owned controller lease/epoch, per-event checks and rate limits; host revoke; validate input; deny unsafe navigation and downloads. |
| 4. Privacy and lifecycle hardening | Cookie/profile reuse, desktop leakage, process/resource leak | Verify clean context per session; isolate display; remove temporary state; impose OS quotas, session/idle deadlines, and crash-safe process-tree cleanup. |
| 5. Streaming and network reliability | STUN-only failure, TURN relay expense, capture bandwidth overload | Test direct and relay paths, self-host coturn if needed, monitor egress, and enforce small-room/resolution/bitrate limits. |

## Architecture Verdict

**Do not expose the selected same-host browser as a secure public service in its current form.** Chromium sandboxing and a public-pages-only policy are valuable defenses but do not by themselves isolate the browser's network access or host privileges from the Node server. For arbitrary public sites and public ingress, require an additional OS-level browser/network boundary (not necessarily a container) and explicit egress-deny rules, plus room authentication and server-authoritative input permissions. If those are out of scope, keep the deployment private (for example, behind a VPN/firewall) and make the trusted-small-group limitation explicit. Even then, do not use shared accounts or operator profiles.

## Sources

Official references reviewed 2026-10-10 unless a source date is noted:

- Chromium, [Sandbox design](https://chromium.googlesource.com/chromium/src/+/main/docs/design/sandbox.md) — HIGH relevance; process/broker model and least privilege.
- Chrome for Developers, [Chrome Headless mode](https://developer.chrome.com/docs/chromium/headless) — HIGH relevance; headless has no visible UI.
- Chrome for Developers, [Changes to remote debugging switches to improve security](https://developer.chrome.com/blog/remote-debugging-port/) — published 2025-03-17; remote-debugging security considerations.
- Playwright, [Browser contexts](https://playwright.dev/docs/browser-contexts) and [BrowserContext API](https://playwright.dev/docs/api/class-browsercontext) — HIGH relevance; cookie/storage isolation and context lifecycle.
- OWASP, [SSRF Prevention Cheat Sheet](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.md) — HIGH relevance; application/network-layer defenses, address classes, DNS and metadata concerns.
- noVNC, [README](https://github.com/novnc/noVNC/blob/master/README.md) — medium relevance; VNC/WebSocket proxy architecture and localhost binding example.
- X.Org, [Xvfb manual](https://www.x.org/archive/X11R7.5/doc/man/man1/Xvfb.1.html) — virtual framebuffer behavior.
- FFmpeg, [Devices documentation: x11grab](https://ffmpeg.org/ffmpeg-devices.html#x11grab) — desktop capture input; capture does not provide authorization or privacy policy.
- WebRTC, [TURN server guide](https://webrtc.org/getting-started/turn-server) — published 2023-05-04; TURN need and self-hosted coturn option.
- Project evidence: `server/index.js` (unauthenticated shaped room join, in-memory room state, HTTP(S)-only media URL validation); `.planning/codebase/CONCERNS.md` (no authentication, no explicit CORS, STUN-only, no test suite).

Confidence is **MEDIUM** overall: key design claims were checked against official vendor/project documentation and the current server implementation; Socket.IO documentation lookup was unavailable during this pass, so its room-routing/auth distinction is grounded in the current server design and should be revalidated during implementation.
