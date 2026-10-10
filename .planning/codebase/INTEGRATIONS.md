# External Integrations

**Analysis Date:** 2026-10-10

## APIs & External Services

**Realtime application signaling:**
- Socket.IO - Used for room events, chat history, synced video state, and WebRTC peer signaling.
  - Server: `server/index.js`
  - Client: `src/App.tsx`
  - Event names include `room:join`, `profile:name`, `media:state`, `chat:send`, `rtc:signal`, `peer:left`, `room:viewers`, and `chat:history`.

**Peer-to-peer media discovery:**
- Google public STUN server - `src/App.tsx` creates `RTCPeerConnection` with `iceServers: [{ urls: "stun:stun.l.google.com:19302" }]` for basic ICE discovery.
  - Auth: not required for public STUN, but network reachability still matters.

**No external business APIs detected:**
- There are no Stripe, Firebase, Supabase, Twilio, OpenAI, or similar vendor integrations in the checked-in code.

## Data Storage

**Databases:**
- None detected - room metadata, chat history, and playback state are stored in memory only within `server/index.js` via a `Map` and array-based room store.
  - Connection: not applicable
  - Client: not applicable

**File Storage:**
- Local static hosting only - built frontend assets may be served from `dist/` via Express in `server/index.js`.

**Caching:**
- In-memory state only; no Redis, Memcached, or dedicated cache layer is configured.

## Authentication & Identity

**Auth Provider:**
- Custom identity model, not external auth - the browser emits `profile:name` to the server and persists the chosen name in browser `localStorage`.
  - Implementation: `getInitialName()` and `saveName()` in `src/App.tsx`.

## Monitoring & Observability

**Error Tracking:**
- None detected - no Sentry, LogRocket, or similar instrumentation is configured in the repo snapshot.

**Logs:**
- Console logging is used in `server/index.js` for startup status: `console.log('Watch party server listening on http://localhost:${port}')`.

## CI/CD & Deployment

**Hosting:**
- Self-hosted Node.js deployment is the intended pattern; `README.md` describes running locally or on a reachable server with public access.

**CI Pipeline:**
- Not detected - no GitHub Actions workflow files or deployment automation were part of the repo snapshot.

## Environment Configuration

**Required env vars:**
- `PORT` - optional runtime port override used in `server/index.js`.
- No `.env` file or secret-bearing configuration file was present in the repo snapshot.

**Secrets location:**
- Not applicable; the app does not rely on API keys or cloud credentials.

## Webhooks & Callbacks

**Incoming:**
- None detected - no webhook endpoint or callback route is implemented in `server/index.js`.

**Outgoing:**
- WebRTC signaling is passed via Socket.IO between peers; the browser also contacts the public STUN discovery service at startup for ICE connectivity.

---

*Integration audit: 2026-10-10*
