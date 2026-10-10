# Common Room

## What This Is

Common Room is a free, open-source, self-hostable watch-together app for small groups of friends. It already provides synchronized direct-video playback, room chat, and peer-to-peer calls; the goal is to grow it into a Hyperbeam-style experience by letting a room share and control a full browser window running on the app host.

The first shared-browser release targets one room at a time, with the room host able to grant browser control to one guest at a time. The initial browser is for public pages only; it must not be used to share signed-in accounts or private browsing data.

## Core Value

Friends can join one self-hosted room and watch or browse together, with the shared browser showing the same page and control passing only to the person authorized by the host.

## Requirements

### Validated

- ✓ Room members can load a direct video URL and synchronize play, pause, and seek state — existing
- ✓ Room members can exchange text messages in real time — existing
- ✓ Room members can join a peer-to-peer audio/video call — existing

### Active

- [ ] The host can explicitly start and stop one full Chromium window on a supported Linux host, and room members can view it
- [ ] The host can navigate the shared browser to public pages; signed-in accounts and saved browser profiles are unsupported
- [ ] A private host capability, distinct from the public room invite and display name, authorizes session lifecycle and later controller grants
- [ ] The host can grant and revoke control to one guest at a time; the server rejects unauthorized and stale mouse/keyboard input
- [ ] Browser processes, display, and capture resources are cleaned up predictably; existing video sync, chat, and calls continue working
- [ ] The shared browser remains local/private until OS/process isolation and network egress restrictions are implemented and verified
- [ ] Linux hosts can self-host one room for a few friends without paid APIs or managed services; macOS remains supported as a browser client/development environment

### Out of Scope

- Multiple concurrent browser rooms — defer until the single-room resource and isolation model is proven
- Shared sign-ins, password entry, or account-cookie persistence — private credentials must not be exposed to other room members
- Public multi-tenant hosting — this project is self-hosted for trusted small groups, not an open service
- A large-scale media SFU or cloud browser service — conflicts with the no-paid-service constraint and is unnecessary for the first milestone
- Mobile native clients — begin with the existing browser-based web app

## Context

- The current project is a brownfield prototype. See `.planning/codebase/` for the mapped architecture, stack, conventions, testing status, and risks.
- The web client is React and TypeScript. The server is Node.js, Express, and Socket.IO. Current shared room data is in process memory.
- The existing app already has synced direct-video playback, room chat, and a browser WebRTC mesh call. These behaviors should remain available as the shared-browser capability is introduced.
- The selected shared-browser approach is to launch Chromium directly on the app server and expose its full browser window to the room. Guests view it and the host grants control to a single guest at a time.
- The host is identified by a private server-validated capability, not by display name. The capability must be distinct from ordinary guest invites.
- Linux is the initial browser-host target; macOS remains supported for development and browser clients.
- This is a small-group, one-room-at-a-time target. The room's browser is not a secure boundary against hostile pages or untrusted users. Planning and implementation must explicitly handle browser sandboxing, network access, input authorization, and session cleanup before the session is exposed beyond trusted invitees.
- The application currently has no automated test suite, authentication, persistent store, Git history, or deployment configuration. Git was initialized during project setup.

## Constraints

- **Budget**: Use open-source, self-hostable components and avoid paid APIs, hosted browser services, and managed infrastructure — the project must be usable without new service charges.
- **Deployment**: The user operates the app server and its Chromium process; it must be possible to run locally for development and self-host without a vendor account.
- **Scope**: Initially support one shared browser session and a few friends — limit resource use and avoid designing for public multi-tenant scale before validating the core experience.
- **Privacy and security**: Shared sessions are for public pages only; do not persist browser profiles or expose account credentials, cookies, or private user data to room members.
- **Compatibility**: Preserve the existing React/Vite client and Node/Express/Socket.IO server unless research or implementation evidence justifies a change.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build a shared browser session before polishing existing watch-party features | The shared remote browser is the key capability that makes this more like Hyperbeam | — Pending |
| Run Chromium directly on a Linux app server for the first milestone | Uses open-source virtual-display tooling and avoids a separate hosted browser service; macOS remains a client/dev environment | — Pending |
| Show the full browser window, including browser chrome | This matches the requested shared-browser experience | — Pending |
| Separate a private host capability from public room invites | The current app has no login system and display names are not trustworthy host identity | — Pending |
| Let the host grant browser control to one guest at a time | Keeps remote input predictable and lets the host moderate control | — Pending |
| Restrict the first browser milestone to public pages without shared sign-ins | Avoids exposing guest credentials and browser account data | — Pending |
| Defer internet-facing browser sessions until process/network isolation is verified | Same-host Chromium without OS isolation and egress restrictions can reach private networks and host services | — Pending |
| Target one room and a few friends | Keeps a no-cost self-hosted install achievable on modest infrastructure | — Pending |
| Keep tools and infrastructure free/open-source; inference costs depend on provider choice | Avoids project-required service fees while keeping AI-provider charges explicit | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-10 after shared-browser scope definition*
