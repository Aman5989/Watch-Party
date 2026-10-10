# Feature Landscape

**Domain:** Self-hosted shared-browser watch room for one room and a few friends  
**Researched:** 2026-10-10  
**Scope:** Feature research only; recommendations are grounded in `.planning/PROJECT.md`, codebase audits, and official product documentation.

## Product Shape

This is not a browser tab-sharing add-on to the existing video player. It adds a second shared activity: the app host runs one full Chromium browser window, room members watch its rendered output, and input is accepted from the host or one explicitly authorized guest. Keep the existing synchronized direct-video player, chat, and peer-to-peer calls available as separate room features.

The existing room has no authenticated identity or moderator role: members join by room ID and display name. Therefore "host" cannot safely mean "whoever claims the host display name." The room creator needs a server-recognized owner capability before browser start/stop and controller grants can be authorized. Treat browser operation and every input event as server-authorized room actions, not UI-only controls.

## Table Stakes

Without these, users cannot understand or safely use the shared-browser feature. Complexity is for the current prototype, where the remote-browser runtime and input path are not present.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Host starts one shared Chromium window** | The shared browser is the core new capability. | High | Explicit Start action; create a clean, disposable browser session for this room. Show starting/ready/error state. Do not silently launch a browser on every room join. |
| **Host stops it; session is cleaned up** | Users need an unambiguous end to a host-side process that consumes CPU/RAM and may retain page state. | Med | Stop should terminate the browser and streaming resources, clear active controller state, and broadcast that the browser is stopped. Also clean up on room teardown and server shutdown; define behavior if the host disconnects. |
| **Every room member can observe the same full browser window** | View-only observation is the base of collaboration. | High | Include the browser chrome, not just a page crop. Hyperbeam documents kiosk mode as hiding Chromium navigation UI; this project should not enable that mode. Viewer-only users must not accidentally generate input. |
| **Address bar and ordinary navigation** | People need to open the public page they came to share and understand where the browser is. | Med | Keep Chromium's visible address/navigation UI and support normal page navigation, including address entry and back/forward. Apply the same public-page policy regardless of whether the URL came from the address bar, link, redirect, or popup. |
| **One active controller at a time** | Concurrent mouse/keyboard streams conflict and produce an unpredictable shared page. | High | Host can grant control to a named room member and revoke it at any time. Granting another guest replaces the previous guest; never maintain a multi-controller state. The host retains override/revoke authority. |
| **Keyboard and mouse input for host/current controller only** | Observation without the ability to interact is not a collaborative browser. | High | Cover pointer movement, click, scroll, text entry, and ordinary keys/shortcuts. Reject input server-side from observers, stale controllers, and non-room sockets, including after reconnects or handoff races. |
| **Visible control and browser status** | Friends need to know who is driving and whether the browser is usable. | Med | Show stopped/starting/ready/loading/error/disconnected states, the current controller, and a clear host-only grant/revoke action. Make browser failures distinct from room/chat/call connection failures. |
| **Room ownership and browser moderation** | The requested host role gates costly process lifecycle and guest control, but current rooms have no identity or authorization. | High | Bind owner authority to a server-issued capability associated with room creation, not the mutable display name or a client-side boolean. On owner disconnect, preserve a deterministic stop/recovery policy; do not silently promote an arbitrary guest. |
| **Public-pages-only use, with no shared sign-ins** | A shared browser exposes page contents, cookies, and input to all participants. | High | Start with a fresh ephemeral profile; do not save passwords, cookies, or profiles across sessions. Tell users not to sign in or enter credentials. Do not claim that URL heuristics can reliably identify every login or private page; private/local network access and credential handling need explicit security design before exposure. |
| **Existing watch-room features remain available** | Browser browsing should complement rather than regress the validated synchronized video, chat, and calls. | Med | Keep existing player state, chat, and WebRTC mesh behavior independent. Browser start/stop, stream failure, or controller changes must not tear down those features. |

## Differentiators

Valuable for this product, but not blockers to a first usable shared-browser slice.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Controller-change notice and visible cursor identity** | Makes handoff legible and reduces accidental input after a guest starts driving. | Low–Med | A banner/toast and a labeled cursor are enough initially; do not require cursor trails or a full collaborative pointer system. |
| **Controller request affordance** | Guests can ask for a turn without interrupting via chat. | Low | Defer until basic host grant/revoke works. A request must not grant control automatically. |
| **Short browser reconnect grace period** | A transient stream or socket interruption need not force a full room restart. | Med | Preserve the running browser briefly, show reconnecting state, and re-check ownership/controller authorization on reconnect. Do not persist browser profile state. |
| **Host-only initial URL field / launch choice** | Lets the host set the first page before inviting the group into the browser view. | Low | Useful if launch URL privacy or a blank startup page matters; regular browser navigation remains the primary interaction. |
| **Session resource/idle visibility** | Self-hosters can understand why the browser stopped or why the host is under load. | Med | A small status/readout is sufficient: elapsed time, resource/idle timeout, and a readable stop reason. Advanced dashboards are unnecessary for one room. |
| **Optional handoff history** | Helps a small group understand who had control if an action surprises them. | Low | Keep transient and minimal; do not build a durable audit/compliance system for trusted friends. |

## Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multiple simultaneous controllers** | Input races undermine the shared view; Kasm's session-sharing guidance likewise warns that multiple people controlling one session can make the experience inconsistent. | Enforce a single controller, host-mediated replacement, and immediate revoke. |
| **Shared accounts, password entry, or persistent browser profiles** | Cookies and credentials become room-shared data, contrary to the product's public-pages-only boundary. | Use a clean ephemeral profile for each browser session; state the no-sign-in rule prominently and destroy profile data at stop. |
| **Assuming display names establish ownership** | Display names are user-controlled and current room membership has no authentication. | Establish a server-held owner capability at room creation and authorize every host action against it. |
| **Kiosk-only/page-only rendering** | Hiding browser chrome removes the requested full-window experience and makes address/navigation ownership unclear. | Show the full Chromium window, including browser UI. |
| **Clipboard, file upload/download, local-file access, or browser profile import/export in v1** | These create additional data-exfiltration, credential, and host-file risks while adding little to public-page viewing. Hyperbeam exposes clipboard and upload-related permissions separately, illustrating that these are optional capabilities, not inherent to basic control. | Keep them disabled/out of scope; provide ordinary keyboard/mouse only. |
| **Trying to implement full browser-product parity** | Extensions, multiple tabs/profiles, bookmarks sync, arbitrary permission prompts, browser settings, and persistent sessions balloon scope and operational risk. | Deliver one controlled Chromium window and explicitly defer advanced browser management. |
| **Letting a browser failure take down the whole watch room** | Browser process instability should not erase existing video/chat/call value. | Isolate browser lifecycle and surface its errors in its own panel/status channel. |
| **Scaling for many rooms or public multi-tenancy in the first cut** | Conflicts with the one-room, few-friends, self-hosted target and increases isolation/resource work before validating the experience. | Keep an explicit one-browser/one-room limit; revisit only after measuring resource use and isolation. |
| **Duplicating chat, synchronized video, or calls inside the browser surface** | Adds redundant controls and couples the new subsystem to functioning features. | Keep the existing room UI and features alongside the browser. |

## Feature Dependencies

```text
Server-recognized room owner
  → authorized browser start/stop
  → one room-scoped browser session + deterministic cleanup
  → browser stream available to room members (view-only by default)

Room membership + server-side role state
  → host grants/revokes one guest controller
  → controller identity/status shown to all participants
  → remote keyboard/mouse accepted only from host/current controller

Browser window streaming + lifecycle events
  → shared page/navigation visibility
  → useful starting/loading/ready/disconnected/error/stopped status

Ephemeral profile + public-page policy
  → no persisted shared credentials/cookies
  → cleanup on stop, room teardown, and server shutdown

Existing room shell
  → browser panel coexists with synchronized video, chat, and P2P calls
```

Important ordering constraint: define owner identity and server-side input authorization before enabling guest control. A client-only "controller" badge is not authorization. Browser creation/cleanup and streamed observation must work before controller handoff can be meaningfully tested.

## MVP Recommendation

Build one vertical slice for a single room:

1. Establish a server-recognized room owner and a room-scoped browser state.
2. Let the owner explicitly start and stop one fresh Chromium window; expose lifecycle and useful failure/cleanup statuses.
3. Render the **full** browser window, including Chromium chrome, to all room members in observe-only mode; include ordinary address/navigation.
4. Let the owner grant control to one named guest, revoke it, or replace that guest. Keep the owner able to take back control.
5. Accept ordinary mouse/keyboard input only from the owner or current guest and enforce that rule server-side.
6. Ensure browser stop/failure does not disrupt existing synchronized video, chat, or P2P calls; use a disposable profile and document no sign-ins/credentials.

Keep the first slice narrow: no concurrent browser rooms, no shared/private account use, no persistent profiles, no upload/download/clipboard, no browser extensions, and no multi-tenant service. A host action to grant/revoke is required in MVP; guest control requests, controller queues, handoff history, and reconnect grace are later polish.

**Public-page boundary caveat:** "Public pages only" is a product/security constraint, not a reliably discoverable page category. A URL can redirect, open a popup, resolve to a private network target, or display a sign-in form. Do not represent URL-pattern filtering as proof that a page is public or unauthenticated. The implementation plan should decide how to restrict private/local destinations, prevent credential persistence, and warn users before remote access is enabled; this needs security-focused validation.

## Defer Until Later

- Guest control requests or a turn-taking queue.
- Browser session reconnect/recovery beyond a clear stopped/error state.
- Multiple tabs, browser settings/extensions, bookmarks, clipboard, uploads/downloads, and profile restore.
- Persistence of browser state or room history.
- Multiple concurrent rooms, large-room scaling, SFU/media redesign, and public multi-tenant hosting.
- Automated recognition of login forms or a claim that arbitrary destinations are guaranteed public.

## Sources

Product documentation is used as feature-pattern evidence, not as a recommendation to adopt a hosted vendor or replicate its architecture. Hyperbeam's documentation sitemap lists these pages with last-modified dates in January 2026; accessed 2026-10-10. Kasm's linked 1.17 documentation labels itself outdated; accessed 2026-10-10.

- [Hyperbeam — Features](https://docs.hyperbeam.com/home/features) — identifies kiosk mode as hiding Chromium navigation UI and documents permissions, programmatic browser control, and state/events. **Confidence: MEDIUM** (official product docs; relevance is feature-pattern benchmarking).
- [Hyperbeam — Starting a Chromium Session](https://docs.hyperbeam.com/rest-api/dispatch/start-chromium-session) — session startup fields include `start_url`, kiosk, and timeout options. **Confidence: MEDIUM**.
- [Hyperbeam — Ending a Session](https://docs.hyperbeam.com/rest-api/dispatch/ending-session) — documents explicit termination by session ID. **Confidence: MEDIUM**.
- [Hyperbeam — Roles](https://docs.hyperbeam.com/guides/roles) — describes per-user control and optional clipboard/upload roles, including dynamically toggling roles. **Confidence: MEDIUM**.
- [Hyperbeam — Set User Permissions](https://docs.hyperbeam.com/rest-api/session/set-user-permission) and [Add Roles](https://docs.hyperbeam.com/rest-api/session/add-roles) — per-user permission operations. **Confidence: MEDIUM**.
- [Kasm — Session Sharing](https://kasm.com/docs/latest/guide/session_sharing.html) — shared session URL, viewer visibility, default initiator control with guest view-only, and a warning about simultaneous control. **Confidence: MEDIUM** (official but explicitly marked outdated documentation).
- [Kasm — Session Casting](https://kasm.com/docs/latest/guide/sessions.html) — illustrates administrative session view/stop/start/delete lifecycle controls. **Confidence: MEDIUM** (official but explicitly marked outdated documentation).
- Project grounding: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, and `.planning/codebase/ARCHITECTURE.md` (all analyzed 2026-10-10). Existing functionality, project constraints, lack of owner authorization, in-memory room state, and absent shared-browser layer are codebase-specific, higher-confidence context.
