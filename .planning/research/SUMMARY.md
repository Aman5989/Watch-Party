# Project Research Summary

**Project:** Common Room
**Domain:** Self-hosted shared-browser watch room for a small trusted group
**Researched:** 2026-10-10
**Confidence:** MEDIUM

## Executive Summary

Common Room is a self-hosted watch-together room that already supports synchronized direct-video playback, room chat, and peer-to-peer WebRTC calls. The missing capability is a single server-owned Chromium browser window shared to room members, with the host able to grant browser control to one guest at a time while preserving the existing direct-video, chat, and call features. The recommended approach keeps the current React/Vite frontend and Node/Express/Socket.IO backend, and adds a headful Chromium session on a private virtual X display exposed through a self-hosted VNC/noVNC or equivalent display stream. This matches the approved project scope: one room at a time, a small trusted group, public pages only, no sign-ins, and no paid services.

The key risk is not feature completeness but security. The research explicitly warns that direct Chromium on the same host without additional isolation is unsafe for public exposure because the browser can reach localhost, private-network ranges, link-local addresses, multicast addresses, and metadata endpoints. That creates SSRF/private-network exposure and can become host compromise if the browser runs without an OS-level boundary and egress policy. This must be treated as a roadmap gate: the app may only be tested in a trusted local or private deployment until a network and process-isolation boundary is implemented and verified. The project must not silently recommend exposing this as a secure public service.

The recommended path is to validate the user experience in a trusted local/self-hosted environment, harden the browser runtime and network policy, and only then decide whether a broader or internet-exposed deployment is acceptable. Because the app has no authentication and no persistent user store yet, room ownership and controller authorization must be server-side and room-scoped rather than client-side UI state.

## Key Findings

### Recommended Stack

The current stack is already the right foundation for the first small-group implementation. The research recommends keeping React + TypeScript + Vite on the browser side and Node.js + Express + Socket.IO on the server, while adding a dedicated headful Chromium runtime for the browser-sharing feature. For the first MVP, the browser should run on a Linux host using a private X display such as TigerVNC/Xvnc or Xvfb plus a VNC bridge, then be exposed to room members through noVNC/websockify or an equivalent display viewer. Playwright is the recommended automation library for the server because it fits the Node runtime and allows a fresh, disposable browser context with no saved cookie or profile state. A database is not justified for this first iteration; room state and browser control can remain in process memory, and browser profiles, cookies, local storage, and credentials must not be persisted.

**Core technologies:**
- React + TypeScript + Vite — preserves the existing frontend and room UI, and provides a natural surface for browser status and controller controls.
- Node.js + Express + Socket.IO — keeps room membership, host ownership, current controller, and browser lifecycle in the same service.
- Playwright — manages the headful Chromium browser process, creates the disposable context, and supports startup/cleanup and browser automation hooks.
- Xvnc or virtual X display + noVNC + websockify — creates the full-window browser view and keeps the rendered window private to the app host while exposing a controlled web view to members.
- FFmpeg or equivalent display capture — provides a bounded, lossy desktop stream suitable for a few viewers without introducing a paid hosted media service.

### Expected Features

The table stakes are a single server-owned browser session, a visible full-window browser view, and a host-controlled handoff to one guest at a time. The browser should be public-pages only, with no sign-ins or password entry and no persistent profile. The existing room features remain valuable and need to continue working: direct-video sync, chat, and peer-to-peer calls should remain independent of the browser session. Differentiators should be modest and focused on clarity: visible controller status, a clean handoff notice, and a short reconnect grace period. Advanced browser features such as multiple rooms, persistent profiles, uncontrolled downloads, or private browsing are explicitly out of scope for v1.

**Must have (table stakes):**
- Host starts one shared Chromium window for the room, explicitly and server-owned.
- Every room member can observe the same full browser window, including address bar and browser chrome.
- One active controller at a time; the host can grant and revoke control immediately.
- Keyboard and mouse input accepted only from the host or current controller.
- Session cleanup on stop, room teardown, host disconnect, or shutdown.
- Public-pages-only use with no shared sign-ins or credential persistence.

**Should have (competitive):**
- Visible browser lifecycle and controller status.
- Clear controller-change notice and labeled cursor or turn indicator.
- Optional request-to-take-control affordance before host approval.
- Reconnect grace period without tearing down the browser session.

**Defer (v2+):**
- Multiple concurrent browser rooms.
- Shared accounts or persistent browser profiles.
- File upload/download, clipboard sharing, or local file access.
- Advanced dashboards and analytics beyond a thin room status panel.

### Architecture Approach

The recommended architecture keeps the existing Express/Socket.IO application as the room control plane and adds a single BrowserSessionManager that owns a room-scoped browser session. The server validates host capability, room membership, and controller grant before accepting any browser event. Chromium runs headful on a private virtual X display; the resulting window is captured and delivered to room members through a bounded display stream or noVNC/VNC bridge. The essential pattern is to separate room authorization from browser process management: the room server decides who has control, while the browser manager starts, stops, cleans up, and reports status for the single shared session.

**Major components:**
1. Room socket handlers — validate room membership, ownership, controller lease, and input authorization before accepting any browser event.
2. BrowserSessionManager — creates a single browser session, manages lifecycle state, and handles start/stop, cleanup, and timeouts.
3. Virtual display + Chromium — runs a full, headful browser window privately on the app host, not the user desktop.
4. Capture and display path — delivers the browser window to participants through a bounded frame stream or a controlled noVNC/VNC path.
5. Existing watch-party modules — continue to support direct-video sync, chat, and peer-to-peer calls independently of the browser session.

### Critical Pitfalls

The main pitfall is a false sense of security: the project is not a hardened public remote-browser service yet, and exposing a browser on the same host without tight isolation is unsafe. The research calls out SSRF and private-network exposure as the key security landmine: a page can redirect or request localhost, private IPs, link-local ranges, multicast addresses, or metadata endpoints. The browser process can also become a host-compromise vector if it is launched with the app user context or without a dedicated isolation boundary.

1. **Direct Chromium on the same host is unsafe for public exposure** — URL allowlists are not an SSRF defense. Prevent by imposing OS/network egress restrictions that deny loopback, private ranges, link-local, multicast, and metadata endpoints; only a dedicated trusted/local deployment is safe without this boundary.
2. **Renderer sandboxing is not host or network isolation** — a Chromium sandbox is useful but does not stop private-network requests or host compromise. Prevent by using a dedicated unprivileged OS user, sandbox enabled, and strict egress rules.
3. **Room membership is not authorization** — a room ID or display name does not establish moderator or host identity. Prevent with server-held host capability, atomic controller lease state, and input validation on every event.
4. **Full desktop capture leaks more than the browser page** — browser chrome, notifications, dialogs, host OS state, and file chooser flows can leak more data than the public-page design allows. Prevent by using a dedicated virtual desktop and disabling host notifications and file access.
5. **Controller handoff races can leave stale input active** — reconnects or simultaneous grant commands can allow the previous controller to continue sending events. Prevent with a monotonic grant epoch, server-side validation, and immediate disconnect or revocation.

## Implications for Roadmap

The roadmap should be ordered around two realities from the research: first, the room ownership and controller model must be correct; second, the browser runtime may only be deployed in a trusted local/private environment until the OS-level isolation decision is enforced. This means the product is not ready for public exposure until the secure boundary is proven.

### Phase 1: Room authority and controller lease foundation
**Rationale:** The current room model has no authenticated host identity or trusted controller lease; browser control is meaningless without a deterministic server-held owner and grant state.
**Delivers:** server-owned room authority, host capability, current-controller state, reconnect cleanup, and teardown policy.
**Addresses:** host starts/stops the browser, room ownership and moderation, one active controller, and input authorization.
**Avoids:** permission confusion, stale sockets, and controller races.

### Phase 2: Shared-browser runtime and display view
**Rationale:** The feature value is the actual browser window; this should be built after the room authority model exists, but before visual polish or broader rollout.
**Delivers:** a single headful Chromium session on a virtual display, a room-scoped browser lifecycle, and an initial browser stream from the app host to room members.
**Addresses:** host starts a shared browser, every member sees the same full browser window, and basic public-page navigation.
**Avoids:** wrong feature shape and insecure browser runtime choices.

### Phase 3: Handoff and control authorization
**Rationale:** After the browser stream exists, the critical product interaction is the handoff from host to one guest at a time with immediate revocation and server-side validation.
**Delivers:** grant/revoke flow, current-controller enforcement, rate limiting, mouse/keyboard validation, and reconnect-safe authorization.
**Addresses:** one active controller, host-only input acceptance, and status visibility.
**Avoids:** source-side input races and stale-controller events.

### Phase 4: Security hardening and trusted deployment gate
**Rationale:** This is the decisive roadmap gate. The research warns that direct Chromium on the same host without additional isolation is unsafe for public exposure due to SSRF, localhost/private-network access, and browser-to-host compromise risk.
**Delivers:** dedicated OS user and process isolation, network egress restrictions, public-pages-only enforcement, and a clear approval gate for trusted local testing versus public exposure.
**Addresses:** the no-sign-in rule, private-network safeguards, and the explicit warning not to expose the app as a secure public service.
**Avoids:** unsafe browser exposure and host-level compromise.

### Phase 5: UX polish and small-group conveniences
**Rationale:** Once the runtime is deterministic and safe for trusted use, the product can add low-risk clarity features without obscuring the security gate.
**Delivers:** controller-change notices, request-to-control flow, reconnect grace periods, and a concise browser status panel.
**Addresses:** should-have differentiators.
**Avoids:** overbuilding a complex browser collaboration tool before the core trust model is proven.

### Phase Ordering Rationale

- The server ownership and controller lease must exist before a browser can safely accept input or navigation commands.
- The browser display lifecycle should come before advanced collaboration features because it defines the user-visible product experience.
- The security gate is intentionally before any public or internet-facing claim because the research explicitly warns against the same-host direct Chromium pattern.
- Trusted/local testing should remain bounded and explicit; broader exposure is a separate decision that requires isolation and validation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2:** browser runtime and display-capture integration, especially the choice between noVNC/VNC and a custom capture path on the target host.
- **Phase 4:** security hardening and egress isolation; this needs explicit validation before any external exposure or public-facing decision.

Phases with standard patterns (skip a deep research phase):
- **Phase 1:** room ownership and controller lease logic are standard room-state patterns for a Socket.IO app.
- **Phase 3:** event validation and grant/revoke flow are standard server-side permission patterns and can be implemented without large external API research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | The current app stack and the recommended Linux/browser runtime are clear, but the exact VNC/capture and security tuning is not yet benchmarked in this repo. |
| Features | HIGH | The approved scope and required feature boundaries are clear in .planning/PROJECT.md and .planning/research/FEATURES.md. |
| Architecture | MEDIUM | The separation between room control authority and browser runtime is a strong fit, but actual media performance and deployment-specific isolation still need validation. |
| Pitfalls | HIGH | The security, authorization, and SSRF warnings are explicit and are central to the project risk assessment. |

**Overall confidence:** MEDIUM

### Gaps to Address

- Browser-runtime benchmark: confirm resolution, FPS, CPU, and bandwidth for the chosen display-capture path on a real target host and room size.
- Isolation design: document the exact OS-level and network-layer strategy needed before any broader deployment.
- Deployment test plan: validate the trusted/local setup and prove that the browser cannot reach localhost, private RFC1918/ULA ranges, link-local networks, or metadata services.
- Input authorization proof: confirm that every browser and controller event is validated server-side and cannot be bypassed by client-side tampering.

## Sources

### Primary (HIGH confidence)
- .planning/PROJECT.md — approved scope, constraints, and product boundaries.
- .planning/research/STACK.md — recommended stack, browser runtime, and virtual-display pattern.
- .planning/research/FEATURES.md — required features, table stakes, and v2+ deferrals.
- .planning/research/ARCHITECTURE.md — proposed component boundaries and browser/control architecture.
- .planning/research/PITFALLS.md — critical security and authorization risks, including the direct Chromium-on-host warning.

### Secondary (MEDIUM confidence)
- .planning/codebase/STACK.md — confirms the existing brownfield app stack and constraints.
- .planning/codebase/ARCHITECTURE.md — validates room structure and architectural assumptions.

---
*Research completed: 2026-10-10*
*Ready for roadmap: yes, with a required security gate before any public or internet-exposed deployment.*
