# Common Room

A free, self-hostable starting point for a watch-party app. Friends join the same room link to share a video player's URL, play/pause state, and seek position, chat, and join a peer-to-peer audio/video call.

## Stack

- React + TypeScript + Vite
- Node.js + Express + Socket.IO
- Browser WebRTC for peer-to-peer calls (with a public STUN server for connection discovery)
- No paid APIs, managed database, or external account required

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies with `npm install`.
3. Start the frontend and realtime server with `npm run dev`.
4. Open the Vite URL printed in the terminal (usually `http://localhost:5173`).
5. Open the room URL in another browser on your machine to try it out.

For a production build, run `npm run build` and then `npm start`. The Node server serves the built app and the Socket.IO endpoint on port `3001` by default. Set `PORT` to change it.

To invite people outside your local network, the app needs to run on a machine they can reach (for example, your own server or a computer with suitable router/network configuration). No paid hosting or API is included or required; external reachability and the video source itself are up to you.

## Optional AI development tools

These tools are for developing this repository, not features shipped to watch-party users:

- **GSD Core** is installed locally for GitHub Copilot under `.github/`. Start a project workflow with `/gsd-onboard` or explore commands with `/gsd-help`. The installer command is `npx @opengsd/gsd-core@latest --copilot --local`.
- **Zoo Code** (the community continuation of Roo Code) is recommended in VS Code. Install it from the Extensions view; the workspace mode is defined in `.roomodes`. This extension is free, but the model provider you configure may charge. A local model avoids API charges but needs suitable hardware.
- **Ralph Loop** is available as the Copilot prompt `/ralph-loop` in `.github/prompts/ralph-loop.prompt.md`. It uses bounded iterations and verifies work; it does not auto-run indefinitely.
- **CodeRabbit** has a starter repository config in `.coderabbit.yaml`. Automatic reviews are disabled by default to avoid unexpected usage. To use CodeRabbit, connect its GitHub app to a GitHub-hosted repository and enable reviews in its configuration/settings as desired.

The configurations and open-source tooling are free, but that does not make AI inference or hosted review services universally free. Use an existing free allowance or a local model, and check provider plans before enabling hosted services. CodeRabbit is optional and hosted; its service availability and limits depend on its current plan. It must be enabled and connected to the GitHub repository before it can review pull requests.

## Current scope and call networking

Use a direct `http` or `https` video URL that the browser supports, such as an MP4 or WebM file. The browser's media support and the source host's CORS policy determine whether a link can play. This starter does not embed YouTube or provide a shared remote browser. Room state is held in server memory and disappears when the server restarts.

Chat history is also held in memory (the latest 100 messages per room). Video calls connect participants directly in a peer-to-peer mesh, which is suitable for small groups but uses more bandwidth on each participant as the room grows. Browser camera and microphone permission is required. The included public STUN server helps discover direct connections, but restrictive networks may require a TURN relay. You can self-host open-source [coturn](https://github.com/coturn/coturn) for that; public reachability, TURN bandwidth, and video hosting may have costs depending on your setup. No paid service is bundled.

## Next steps

- Add moderator controls and participant mute/status indicators.
- Improve synchronization for streams with different buffering behavior.
- Add optional self-hosted HLS playback and persistent room metadata.
- Add deployment instructions for a server you control.

## License

MIT. See [LICENSE](./LICENSE).
