# Roadmap: Common Room

## Overview

Deliver the shared-browser experience as two vertical slices: first, a safe host-operated browser that room members can view, with predictable lifecycle and host navigation; then, one-at-a-time guest handoff with server-enforced input permissions and release verification. Internet-facing browser use stays disabled until OS/process isolation and network egress controls are implemented and verified. Existing synchronized video, chat, and calls remain available throughout.

The initial full-window capture path is a dedicated virtual X display running headful Chromium, captured as bounded JPEG frames and delivered to room members over the existing Socket.IO connection. This is preferred for the first small-group slice over exposing VNC/noVNC: VNC clients have an input path even when the UI is marked view-only, so safe host/guest handoff would require a separately verified RFB authorization gateway. A server-originated capture stream plus typed Socket.IO input keeps viewing separate from input authorization and avoids exposing raw VNC, display, or Chromium debugging endpoints. Cap frame size/rate, drop stale frames for slow viewers, and validate CPU, bandwidth, and responsiveness on the supported Linux host; if that prototype is inadequate, reassess a server-originated WebRTC stream or a properly gated VNC gateway before accepting a production transport.

## Phases

- [ ] **Phase 1: Secure Browser Viewing & Lifecycle** - Deliver an isolated, host-operated browser session with full-window viewing, lifecycle visibility, and host navigation before guest handoff.
- [ ] **Phase 2: Guest Handoff & Release Verification** - Add one-at-a-time guest control, enforce revocation and stale-input rejection, and verify/document the complete self-hosted experience.

## Phase Details

### Phase 1: Secure Browser Viewing & Lifecycle
**Goal**: The host can operate one safe, disposable shared browser session while room members view the same full Chromium window, and the browser can reach public pages only after the isolation gate passes.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: WATCH-04, HOST-01, HOST-02, BROW-01, BROW-02, BROW-03, BROW-04, BROW-05, BROW-06, BROW-07, SAFE-01, SAFE-02, SAFE-03
**Success Criteria** (what must be TRUE):
  1. The room creator can prove a private host capability distinct from the public invite and display name; only that capability authorizes browser lifecycle and host moderation actions.
  2. On a supported Linux host, the host can explicitly start and stop one full-window Chromium session; all room members see the same live output, including browser chrome, and can distinguish stopped, starting, ready, disconnected, and failed states with actionable startup/capture errors.
  3. Before any internet-facing browser session is enabled, the browser runs within a verified OS/process isolation boundary with network egress restrictions that block IPv4 and IPv6 loopback, private, link-local, multicast, and metadata destinations, including redirect and subresource attempts. If the gate is not verified, internet-facing sessions remain disabled.
  4. Once the gate is verified, the host can navigate to public pages while guests remain view-only; each session uses a disposable profile, retains no browser state after cleanup, and cleans its processes/display/capture resources on stop, teardown, startup failure, and application shutdown.
  5. Participants see a clear no-sign-in/no-credentials warning, unsupported host dependencies fail with an actionable error without disabling the app as a client, and browser start/stop/failure does not disrupt shared video, chat, or calls.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Guest Handoff & Release Verification
**Goal**: The host can safely hand browser control to at most one guest at a time, reclaim it immediately, and self-host the completed feature with verified authorization and cleanup behavior.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: HOST-03, HOST-04, INPUT-01, INPUT-02, INPUT-03, SAFE-04, TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. The host can grant, revoke, replace, or reclaim control so at most one current guest is authorized; participants can see who currently controls the browser.
  2. The host or currently authorized guest can use supported mouse and keyboard input, while the server rejects unauthorized, malformed, oversized, over-rate, cross-room, and stale input after leave, disconnect, reconnect, revocation, or grant replacement.
  3. Room clients cannot directly reach raw Chromium debugging, VNC, display, or input-injection endpoints; automated tests prove unauthorized lifecycle/grant/input requests are rejected and cover lifecycle cleanup, controller replacement/revocation, and stale input.
  4. The self-host guide documents supported Linux dependencies, resource expectations, startup/cleanup, isolation prerequisites, and the trusted-local testing boundary; a documented manual test verifies full-window viewing, host navigation, read-only guests, handoff, cleanup, and continued operation of existing room features.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Secure Browser Viewing & Lifecycle | 0/TBD | Not started | - |
| 2. Guest Handoff & Release Verification | 0/TBD | Not started | - |
