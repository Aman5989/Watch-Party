# Technology Stack

**Project:** Common Room (existing `open-watch-party` React/Node application)  
**Researched:** 2026-10-10  
**Scope:** Add one self-hosted, full-window Chromium session for a small group; preserve the existing app stack.  
**Confidence:** MEDIUM — recommendations are grounded in current official project documentation, but browser/VNC performance and secure per-viewer input authorization have not been benchmarked or prototyped.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| React + TypeScript + Vite | Existing lockfile: React 19.1.0, TypeScript 5.9.2, Vite 6.3.5 | Shared-browser UI and existing client | Keep the brownfield frontend. Embed the self-hosted noVNC client and browser controls rather than adding a second frontend stack. |
| Node.js + Express + Socket.IO | Existing runtime: Node.js 20+ recommended; Express 5.1.0; Socket.IO 4.8.1 | Browser-process lifecycle, room control lease, and app integration | Reuse the existing server and real-time channel. Keep browser session state in process memory for the one-room iteration; no database is justified yet. |
| Playwright (`playwright`) | Add one current, pinned release compatible with its downloaded Chromium | Launch and close the browser; create an isolated context; provide navigation and automation hooks | Its Node API fits the server and TypeScript application. Launch Chromium with `headless: false`; Playwright is the browser controller, not the full-window video transport. Do not add Puppeteer as a second automation framework. |

### Database

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| None | — | Persist browser state | Deliberately do not persist browser profiles, cookies, local storage, credentials, or control grants. Use a fresh, non-persistent Playwright `BrowserContext` per room session and close it during cleanup. |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Linux server with TigerVNC `Xvnc` | Pin the supported distribution package | Provide a virtual X display and VNC server | `Xvnc` combines an X server with a virtual screen and VNC server. Headful Chromium can run directly on this display on the app server; no Docker or hosted browser is required. |
| noVNC + websockify | Pin a compatible upstream release/package pair | Serve the browser-based VNC viewer and bridge browser WebSockets to the local VNC server | Gives room members a web-native view of the actual virtual desktop, including Chromium's browser chrome. Bind the VNC service to loopback and expose it only through a deliberate authenticated application gateway. |
| Lightweight window manager (e.g. Openbox) | Optional, distribution package | Manage/maximize the Chromium window in the virtual desktop | A minimal window manager can make the full browser window behave predictably. It is not a browser-rendering or streaming dependency. |
| Existing Socket.IO server | Existing 4.8.1 | Room control plane: host role, current controller, grant/revoke, and session status | Avoid a new managed signaling service. The server must authorize control; a client-side UI toggle is insufficient. |

### Supporting Libraries and Components

| Library/component | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Chromium installed by Playwright | Match the pinned Playwright release | Headful, disposable shared browser | Prefer the Playwright-managed build for version alignment. If using distro Chromium instead, verify compatibility against Playwright's documented `executablePath` caveat. |
| TigerVNC `Xvnc` | Distribution package, pinned at deployment | Virtual display plus remote desktop protocol | Recommended over assembling Xvfb with an independently chosen VNC server for the first Linux MVP. |
| noVNC | Compatible pinned release | HTML5 VNC client | Use for the remote desktop view/input path. Keep it self-hosted with the app. |
| websockify | Compatible pinned release | WebSocket-to-TCP proxy for a VNC server | Needed where the VNC server does not itself speak WebSockets; noVNC documents this bridge. Keep its target and listener private behind the app gateway. |
| Xvfb | Distribution package | Alternative virtual X server | Use if deployment constraints favor Xvfb; it must be paired with a VNC server and WebSocket gateway to reach browsers. Xvfb alone is only a virtual display, not a remote viewer. |

## Recommended MVP Shape

1. On a supported Linux host, start a dedicated `Xvnc` display at a fixed, modest resolution. Launch only the session's Chromium (and optional lightweight window manager) on that display.
2. Have the Node server launch Chromium headfully through Playwright, with an explicitly enabled Chromium sandbox where the host supports it. Create a fresh non-persistent context; never load saved storage state or reuse a profile. On session end, close the context/browser and stop the display/VNC processes.
3. Serve the noVNC client from the existing app and connect it through a same-origin, authenticated WebSocket gateway to a loopback-only VNC endpoint. The virtual display—not `page.screenshot()`—is the source of the shared image, so browser tabs, address bar, and other visible browser chrome are present.
4. Keep room membership and a single active controller lease in Socket.IO/server state. Establish a trustworthy host capability before granting guest control: the existing application has no authentication, so a client-provided “I am host” flag or visible UI state is not sufficient.
5. Treat write authorization as a release blocker, not a frontend convenience. noVNC's `viewOnly` option prevents that client instance from sending keyboard/mouse events, but a viewer can alter client-side code/options. Before exposing a writable VNC path, implement and test server-side per-connection input authorization (or a VNC server/gateway with equivalent per-client enforcement), including immediate revocation and disconnect of the old controller. Never expose the raw VNC/websockify port to room clients.
6. Show a clear “public pages only—do not sign in” notice. A disposable context limits persistence but does not technically prevent a participant from typing credentials into a public login form. Do not claim that a fresh context alone enforces the public-pages-only policy.

**Cost and operational tradeoff:** The recommended components are self-hosted open-source software with no required paid API or hosted browser account. The software adds no service subscription, but the operator still pays in server capacity, electricity, and network egress. Full-window desktop encoding and concurrent viewers consume CPU/bandwidth; no reliable resource estimate is available without testing the target host, resolution, and group size. Keep the first trial to one room and a few viewers.

## Full Window vs. Webpage Capture

- **A direct webpage/viewport capture is not a full browser window.** Playwright's `page.screenshot()` captures a page; `fullPage: true` means its full scrollable document rather than browser chrome. CDP `Page.startScreencast` emits frames for a page target. CDP's `Browser.getWindowForTarget` and `Browser.setWindowBounds` can inspect or size a browser window, but do not provide a desktop stream. These paths are useful for page automation or a future page-only mode, not for the requested visible browser chrome.
- **Headless Chromium is not the answer for showing chrome.** Chrome's official headless documentation says headless mode creates but does not display platform windows. Use headful Chromium on a virtual display.
- **A virtual desktop/VNC path captures the displayed window.** `Xvnc` provides the virtual display and VNC server; noVNC renders that VNC session in a web client through WebSockets. This is the most direct fit for the selected full-window experience.
- **Browser `getDisplayMedia()` is not a server capture service.** The W3C Screen Capture API asks the end user to select a display surface in the calling browser and requires user activation. It does not give a guest's browser access to the app server's separate Chromium/X display. A WebRTC alternative would still need a server-side desktop capture/encoding source and a media distribution path.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Full-window capture | TigerVNC `Xvnc` + noVNC/websockify | Xvfb + x11vnc + noVNC | Xvfb is a valid virtual-display primitive, but needs a separate VNC server. The x11vnc upstream README currently labels that repository unmaintained/seeking a maintainer, so it is not the preferred new stack. If Xvfb is required, select and validate a maintained VNC server separately. |
| Page automation | Playwright | Puppeteer or raw CDP | Puppeteer can automate Chromium too, and raw CDP is viable for specialized control. Playwright is the opinionated single Node automation dependency for this app; using multiple APIs adds maintenance without solving full-window capture. |
| Display transport | VNC through noVNC | WebRTC desktop streaming | WebRTC is attractive for adaptive low-latency media, and the existing app already uses WebRTC for calls. But those calls do not capture the server's X display. A desktop capture/encoder, signaling, and distribution path would add implementation and operations work; test it later only if VNC latency/bandwidth proves unacceptable. |
| Headless page capture | Full virtual desktop | Playwright screenshot / CDP page screencast | Simpler for viewport-only sharing, but excludes browser chrome and is therefore a requirements mismatch. |
| Browser hosting | Direct app-server process | Hosted browser service or containerized browser | Hosted services can simplify operations but violate the no-cost/self-hosted choice. Docker is explicitly not the selected first iteration. |

## Security and Compatibility Notes

- Keep Chromium non-root and sandboxed; Playwright documents `chromiumSandbox` as disabled by default unless enabled. Do not normalize `--no-sandbox` to make deployment work. Test sandbox support on the selected Linux distribution.
- The browser loads user-selected, untrusted pages from a server that also hosts the app. Process isolation is not network isolation: implement a deliberate policy for access to loopback/private-network services and unsafe URL redirects before exposing sessions beyond trusted invitees.
- Use an ephemeral profile/context and close it on disconnect, room shutdown, and server termination. Do not write storage state, downloads, or browser profiles into persistent app data.
- Pin Playwright and its matching Chromium together. If selecting a system browser via `executablePath`, verify that combination; Playwright warns that it does not guarantee compatibility with arbitrary browser executables.
- A single shared browser is shared state: all members see its current page and any content rendered there. No concurrent rooms, saved sessions, or sign-in workflows are part of this recommendation.

## Installation

```bash
# Add only the Node browser-automation dependency; retain existing React/Express/Socket.IO packages.
npm install playwright
npx playwright install chromium

# Install using the target Linux distribution's package manager:
# TigerVNC server/Xvnc, noVNC, websockify
# Optional: a lightweight window manager such as Openbox
```

Use distribution packages or upstream release artifacts for the display stack, pin the chosen versions, and document the supported Linux distribution. Package names and dependency-install commands vary across operating systems; this recommendation does not assume a particular one.

## Sources

All sources below are upstream/standards documentation checked on 2026-10-10. Confidence tags reflect the GSD provider classification for web findings (`MEDIUM` after verification); they are not performance measurements.

- [Chrome for Developers: Chrome Headless mode](https://developer.chrome.com/docs/chromium/headless) — documents headless windows/UI behavior and `headless: false`; article metadata shows 2024-10-21 update. **MEDIUM**
- [Playwright BrowserType API](https://playwright.dev/docs/api/class-browsertype) — launch options, headful mode, Chromium sandbox setting, and executable path warning. **MEDIUM**
- [Playwright Browser API](https://playwright.dev/docs/api/class-browser) — isolated incognito browser contexts. **MEDIUM**
- [Playwright Page API](https://playwright.dev/docs/api/class-page) — page screenshot and `fullPage` semantics. **MEDIUM**
- [Chrome DevTools Protocol: Page](https://chromedevtools.github.io/devtools-protocol/tot/Page/) and [Browser](https://chromedevtools.github.io/devtools-protocol/tot/Browser/) — page screencast and browser window methods. `tot` is moving documentation; pin/test the protocol with the selected Chromium. **MEDIUM**
- [TigerVNC Xvnc manual](https://tigervnc.org/doc/Xvnc.html) and [TigerVNC project](https://tigervnc.org/) — virtual X display combined with VNC server and supported project distributions. **MEDIUM**
- [noVNC upstream README](https://github.com/novnc/noVNC) and [noVNC API](https://novnc.com/noVNC/docs/API.html) — VNC-over-WebSocket connectivity, websockify bridge, and client-side `viewOnly` behavior. **MEDIUM**
- [X.Org Xvfb manual](https://www.x.org/releases/X11R7.7/doc/man/man1/Xvfb.1.xhtml) — virtual X server for machines without display hardware. **MEDIUM**
- [W3C Screen Capture specification](https://w3c.github.io/mediacapture-screen-share/) — `getDisplayMedia()` surface selection, permission, and activation model. **MEDIUM**
- [x11vnc upstream README](https://github.com/LibVNC/x11vnc) — upstream's current maintenance warning, considered when rejecting it as the default new component. **MEDIUM**
