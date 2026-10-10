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

- [ ] A room can share a full Chromium browser window hosted by the app server
- [ ] Room members can see browser navigation and page changes in real time
- [ ] The host can grant and revoke browser control for one guest at a time
- [ ] Browser input is accepted only from the current controller or host
- [ ] The initial browser session is limited to public pages and does not expose shared account sign-ins
- [ ] A single self-hosted server can run one room for a small group without paid APIs or managed services

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
| Run Chromium directly on the app server for the first milestone | Keeps the initial deployment self-hosted and avoids a separate hosted browser service | — Pending |
| Show the full browser window, including browser chrome | This matches the requested shared-browser experience | — Pending |
| Let the host grant browser control to one guest at a time | Keeps remote input predictable and lets the host moderate control | — Pending |
| Restrict the first browser milestone to public pages without shared sign-ins | Avoids exposing guest credentials and browser account data | — Pending |
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
*Last updated: 2026-10-10 after project initialization*
