# Phase 1: Secure Browser Viewing & Lifecycle - Context

**Gathered:** 2026-10-10
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/REQUIREMENTS.md)

<domain>
## Phase Boundary

Deliver one host-operated full Chromium window that room members can view, with private host authority, browser lifecycle visibility, public-page navigation, disposable browser state, and predictable cleanup. Preserve existing synced video, chat, and calls. Internet-facing browser sessions must remain disabled until OS/process isolation and network egress restrictions are implemented and verified.

Guest control handoff, guest mouse/keyboard input, and release verification are Phase 2. This phase must not expose browser debugging, display, VNC, or input-injection endpoints to room clients.

</domain>

<decisions>
## Implementation Decisions

### Host authority
- The room creator receives a private host capability distinct from the public room invite and display name.
- The server validates the capability before accepting browser start or stop actions. Display names and client-asserted roles are not authority.
- The capability is not exposed through public room data or to guests.

### Browser session and viewing
- Support one shared browser session for one room on a supported Linux host; macOS remains a browser-client and development environment.
- Launch headful Chromium on a dedicated virtual display and deliver bounded JPEG frames through the existing Socket.IO connection.
- Include the complete Chromium window, including tabs and address bar. Room members view the same live output.
- Expose stopped, starting, ready, disconnected, and failed lifecycle states, with actionable startup or capture errors.
- Keep capture frame size and rate bounded, discard stale frames for slow viewers, and verify resource use and responsiveness on Linux before accepting this transport for release.
- Do not expose raw VNC, display, Chromium debugging, or input-injection endpoints to room clients. If the selected transport cannot meet the target, reassess a server-originated WebRTC stream or a properly gated VNC gateway.

### Public browsing and privacy
- The host can navigate to public pages; guests remain view-only in this phase.
- Display a clear warning that participants must not sign in, enter credentials, or treat the shared browser as private.
- Use a disposable browser profile and retain no cookies, saved passwords, local storage, or other browser state after cleanup.
- Do not describe an ephemeral profile as sufficient protection from hostile pages.
- Do not permit internet-facing browser sessions until an OS/process isolation boundary and egress policy are implemented and verified. The policy must block IPv4 and IPv6 loopback, private, link-local, multicast, and metadata destinations, including redirect and subresource attempts. If this gate is not verified, keep internet-facing sessions disabled.

### Lifecycle and compatibility
- Clean up Chromium processes, display, capture, and related resources on explicit stop, room teardown, startup failure, and application shutdown.
- Missing Linux browser/display dependencies or an unsupported host OS produce actionable browser status/errors without preventing the regular web app from working as a client.
- Starting, stopping, or losing the browser must not disrupt shared video, chat, or calls.

### the agent's Discretion
- Choose concrete Linux virtual-display and capture dependencies, process supervision details, and safe bounded frame defaults, supported by phase research and target-host validation.
- Choose the private host capability's secure generation, storage, and transport mechanics while ensuring it is distinct from public room identifiers and never broadcast to guests.
- Determine how browser lifecycle state and errors fit the existing room event model without changing existing room behavior.
- If isolation or egress verification cannot be completed, implement a fail-closed state that keeps internet-facing browsing unavailable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and acceptance
- `.planning/PROJECT.md` — project vision, constraints, and host/privacy decisions
- `.planning/REQUIREMENTS.md` — authoritative v1 requirements and traceability
- `.planning/ROADMAP.md` — phase boundaries, goals, success criteria, and approved capture direction
- `.planning/research/SUMMARY.md` — synthesized technical research and security gate

### Technical and codebase context
- `.planning/research/STACK.md` — Linux browser-host and capture options
- `.planning/research/ARCHITECTURE.md` — component boundaries and capture transport alternatives
- `.planning/research/PITFALLS.md` — browser isolation, network access, authorization, and lifecycle risks
- `.planning/codebase/ARCHITECTURE.md` — current client/server structure and integration points
- `.planning/codebase/CONCERNS.md` — existing security, persistence, and test limitations

</canonical_refs>

<specifics>
## Specific Ideas

- The selected first transport is a dedicated virtual display with headful Chromium and bounded JPEG frames over Socket.IO, not a raw VNC/noVNC stream.
- Viewing and control remain separate: host navigation belongs to this phase; guest input handoff is deferred to Phase 2.
- The browser is for public pages only, and the internet-facing security gate is a prerequisite, not a UI warning or a future aspiration.

</specifics>

<deferred>
## Deferred Ideas

- Guest control grants, revocation, mouse/keyboard input, and stale-input handling — Phase 2.
- Multiple browser sessions/rooms, configurable limits, reconnect grace periods, and native macOS browser hosting — v2.
- Shared sign-ins, persistent profiles, clipboard, file transfer, local files, or credentials — out of scope.

</deferred>

---

*Phase: 01-secure-browser-viewing-lifecycle*
*Context gathered: 2026-10-10 via PRD Express Path*
