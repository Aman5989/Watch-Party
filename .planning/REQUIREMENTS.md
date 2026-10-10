# Requirements: Common Room

**Defined:** 2026-10-10
**Core Value:** Friends can join one self-hosted room and watch or browse together, with the shared browser showing the same page and control passing only to the person authorized by the host.

## v1 Requirements

Requirements for the initial self-hosted, one-room shared-browser release. The first viewing/lifecycle slice precedes guest input control, but both are in the v1 roadmap.

### Existing Watch Party

- ✓ **WATCH-01**: Room members can load a direct video URL and synchronize play, pause, and seek state — existing behavior to preserve
- ✓ **WATCH-02**: Room members can exchange text messages in real time — existing behavior to preserve
- ✓ **WATCH-03**: Room members can join a peer-to-peer audio/video call — existing behavior to preserve
- [ ] **WATCH-04**: Starting, stopping, or losing the shared browser does not break shared video, chat, or calls

### Room Host Authority

- [ ] **HOST-01**: The room creator receives a private host capability that is distinct from the public room invite and display name
- [ ] **HOST-02**: Only a client proving the valid host capability can start or stop the shared browser or grant/revoke control
- [ ] **HOST-03**: A host can grant control to at most one current room guest at a time and can immediately revoke or replace that grant
- [ ] **HOST-04**: A guest can control the browser only while their current room connection holds the active grant; room leave, disconnect, reconnect, revocation, and grant replacement invalidate stale input

### Shared Browser Session

- [ ] **BROW-01**: On a supported Linux host, the host can explicitly start and stop one full-window Chromium session for the room
- [ ] **BROW-02**: Room members can view the same live browser output, including Chromium browser chrome such as tabs and the address bar
- [ ] **BROW-03**: Room members can see the browser lifecycle state as stopped, starting, ready, disconnected, or failed, with a useful error when startup or capture fails
- [ ] **BROW-04**: The host can navigate the shared browser to public web pages; display-only guests cannot change the browser
- [ ] **BROW-05**: The browser starts with a disposable profile and does not retain cookies, saved passwords, local storage, or browser state after session cleanup
- [ ] **BROW-06**: Browser processes, display capture, and related resources are cleaned up on explicit stop, room teardown, startup failure, and application shutdown
- [ ] **BROW-07**: Unsupported operating systems or missing Linux browser/display dependencies produce an actionable status/error without preventing use of the regular web app as a client

### Browser Input

- [ ] **INPUT-01**: The host and the single currently authorized guest can send supported mouse and keyboard input to the shared browser
- [ ] **INPUT-02**: The server validates browser-input event types, coordinates, key names, payload sizes, rates, room membership, host capability, and active control grant before forwarding input
- [ ] **INPUT-03**: Raw Chromium debugging, VNC, display, or input-injection endpoints are not directly reachable by room clients

### Security and Self-Hosting

- [ ] **SAFE-01**: The shared browser is not enabled for public/internet-facing use until a documented OS/process isolation boundary and network egress policy have been implemented and verified
- [ ] **SAFE-02**: Before internet exposure is permitted, the browser runtime cannot access host secrets or reach loopback, private, link-local, multicast, or metadata-service destinations, including through redirects and subresources
- [ ] **SAFE-03**: The shared-browser UI clearly tells participants not to sign in, enter credentials, or treat the browser as private; ephemeral-profile use is not represented as sufficient protection from hostile pages
- [ ] **SAFE-04**: The self-host guide documents the supported Linux dependencies, startup and cleanup behavior, resource requirements, isolation prerequisites, and trusted-local testing boundary

### Verification

- [ ] **TEST-01**: Automated tests prove that unauthorized clients cannot start/stop the browser, grant control, or submit browser input
- [ ] **TEST-02**: Automated tests cover browser lifecycle success/failure cleanup, controller replacement/revocation, and stale input after disconnect/reconnect
- [ ] **TEST-03**: A documented manual test verifies full-window output, host navigation, viewer read-only behavior, host handoff, cleanup, and continued operation of existing room features

## v2 Requirements

Deferred until the one-room Linux session has been validated.

### Scale and Convenience

- **SCALE-01**: A self-hosted instance can run multiple isolated browser rooms concurrently
- **SCALE-02**: The host can configure browser resolution, frame rate, and resource/idle limits
- **UX-01**: Guests can request control and the host can approve the request
- **UX-02**: Participants can reconnect to a running browser session during a short grace period
- **PLAT-01**: The browser runtime can be hosted natively on macOS or other non-Linux platforms

## Out of Scope

| Feature | Reason |
|---------|--------|
| Public multi-tenant browser hosting | The product is initially self-hosted for a trusted small group; shared arbitrary browsing requires a verified isolation and egress boundary first. |
| Shared account sign-ins, saved credentials, or persistent browser profiles | Browser state is visible to room participants and must not retain private account data. |
| Multiple browser sessions/rooms on one instance | Start with one room to bound resource use and prove lifecycle/security behavior. |
| File upload/download, clipboard sharing, local files, or browser profile import/export | These expand host data exposure and are unnecessary for public-page browsing. |
| A paid hosted browser, managed relay, or paid API | The user requires an open-source, self-hostable path without required paid services. |
| Large-room SFU/video infrastructure | Initial target is a few friends and one room; introduce only if measurement proves it necessary. |
| Native mobile apps | The initial product remains the existing web app. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WATCH-01 | Existing | Complete |
| WATCH-02 | Existing | Complete |
| WATCH-03 | Existing | Complete |
| WATCH-04 | Pending | Pending |
| HOST-01 | Pending | Pending |
| HOST-02 | Pending | Pending |
| HOST-03 | Pending | Pending |
| HOST-04 | Pending | Pending |
| BROW-01 | Pending | Pending |
| BROW-02 | Pending | Pending |
| BROW-03 | Pending | Pending |
| BROW-04 | Pending | Pending |
| BROW-05 | Pending | Pending |
| BROW-06 | Pending | Pending |
| BROW-07 | Pending | Pending |
| INPUT-01 | Pending | Pending |
| INPUT-02 | Pending | Pending |
| INPUT-03 | Pending | Pending |
| SAFE-01 | Pending | Pending |
| SAFE-02 | Pending | Pending |
| SAFE-03 | Pending | Pending |
| SAFE-04 | Pending | Pending |
| TEST-01 | Pending | Pending |
| TEST-02 | Pending | Pending |
| TEST-03 | Pending | Pending |

**Coverage:**
- v1 requirements: 22 total (3 existing/complete, 19 active)
- Mapped to phases: 0
- Unmapped: 19

---
*Requirements defined: 2026-10-10*
*Last updated: 2026-10-10 after initial scope approval*
