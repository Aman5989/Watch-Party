import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";

type MediaState = {
  url: string;
  paused: boolean;
  currentTime: number;
};

type RoomState = {
  state: MediaState | null;
  viewers: number;
};

type Peer = { id: string; name: string };
type ChatMessage = { id: string; name: string; text: string; timestamp: number };
type Signal = {
  from: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  ended?: boolean;
};

function createRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

function getInitialRoomId() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");
  if (roomId && /^[a-zA-Z0-9-]{1,48}$/.test(roomId)) return roomId;

  const newRoomId = createRoomId();
  params.set("room", newRoomId);
  window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  return newRoomId;
}

function getInitialName() {
  return localStorage.getItem("common-room-name") || `Guest ${Math.floor(Math.random() * 900 + 100)}`;
}

function VideoTile({ stream, muted = false, label }: { stream: MediaStream; muted?: boolean; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="video-tile">
      <video ref={videoRef} autoPlay playsInline muted={muted} />
      <span>{label}</span>
    </div>
  );
}

export default function App() {
  const [roomId] = useState(getInitialRoomId);
  const [name, setName] = useState(getInitialName);
  const [nameDraft, setNameDraft] = useState(name);
  const [mediaUrl, setMediaUrl] = useState("");
  const [playbackUrl, setPlaybackUrl] = useState("");
  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState(1);
  const [message, setMessage] = useState("");
  const [chatDraft, setChatDraft] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [callActive, setCallActive] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [callError, setCallError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const applyingRemoteState = useRef(false);
  const pendingRemoteState = useRef<MediaState | null>(null);
  const lastTimeSync = useRef(-1);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerIds = useRef<Peer[]>([]);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const makingOffer = useRef(new Map<string, boolean>());
  const ignoreOffer = useRef(new Map<string, boolean>());
  const politePeers = useRef(new Map<string, boolean>());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isCallActive = useRef(false);

  function applyVideoState(state: MediaState) {
    const video = videoRef.current;
    if (!video || video.src !== state.url) return;

    applyingRemoteState.current = true;
    video.currentTime = state.currentTime;
    if (state.paused) video.pause();
    else void video.play().catch(() => setMessage("Press play to start the shared video."));
    window.setTimeout(() => {
      applyingRemoteState.current = false;
    }, 500);
  }

  function receiveMediaState(state: MediaState) {
    setMediaUrl(state.url);
    setPlaybackUrl(state.url);
    pendingRemoteState.current = state;
    applyVideoState(state);
  }

  function sendMediaState(state: MediaState) {
    if (!applyingRemoteState.current) socketRef.current?.emit("media:state", state);
  }

  function updatePeers(nextPeers: Peer[]) {
    peerIds.current = nextPeers;
    setPeers(nextPeers);
  }

  function closePeer(peerId: string) {
    peerConnections.current.get(peerId)?.close();
    peerConnections.current.delete(peerId);
    makingOffer.current.delete(peerId);
    ignoreOffer.current.delete(peerId);
    politePeers.current.delete(peerId);
    setRemoteStreams((current) => {
      if (!current[peerId]) return current;
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }

  function createPeerConnection(peerId: string) {
    const existing = peerConnections.current.get(peerId);
    if (existing) return existing;

    const socketId = socketRef.current?.id ?? "";
    politePeers.current.set(peerId, socketId.localeCompare(peerId) > 0);
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    peerConnections.current.set(peerId, connection);

    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        connection.addTrack(track, localStreamRef.current);
      }
    }

    connection.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.current?.emit("rtc:signal", { to: peerId, candidate });
    };
    connection.ontrack = ({ streams }) => {
      const stream = streams[0];
      if (stream) setRemoteStreams((current) => ({ ...current, [peerId]: stream }));
    };
    connection.onnegotiationneeded = async () => {
      try {
        makingOffer.current.set(peerId, true);
        await connection.setLocalDescription();
        socketRef.current?.emit("rtc:signal", {
          to: peerId,
          description: connection.localDescription,
        });
      } catch (error) {
        setCallError(error instanceof Error ? error.message : "Could not set up the call.");
      } finally {
        makingOffer.current.set(peerId, false);
      }
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        setCallError("Could not connect to a participant. Their network may require a TURN relay.");
      }
    };
    return connection;
  }

  async function handleSignal({ from, description, candidate, ended }: Signal) {
    if (ended) {
      closePeer(from);
      return;
    }
    const connection = createPeerConnection(from);
    try {
      if (description) {
        const collision =
          description.type === "offer" &&
          (makingOffer.current.get(from) === true || connection.signalingState !== "stable");
        const polite = politePeers.current.get(from) === true;
        ignoreOffer.current.set(from, !polite && collision);
        if (!polite && collision) return;
        if (collision && polite) await connection.setLocalDescription({ type: "rollback" });
        await connection.setRemoteDescription(description);
        if (description.type === "offer") {
          await connection.setLocalDescription();
          socketRef.current?.emit("rtc:signal", {
            to: from,
            description: connection.localDescription,
          });
        }
      } else if (candidate && !ignoreOffer.current.get(from)) {
        await connection.addIceCandidate(candidate);
      }
    } catch (error) {
      if (!ignoreOffer.current.get(from)) {
        setCallError(error instanceof Error ? error.message : "A call connection error occurred.");
      }
    }
  }

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("room:join", roomId);
      socket.emit("profile:name", name);
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("room:state", ({ state, viewers: count }: RoomState) => {
      setViewers(count);
      if (state) receiveMediaState(state);
    });
    socket.on("room:viewers", (count: number) => setViewers(count));
    socket.on("media:state", (state: MediaState) => receiveMediaState(state));
    socket.on("room:peers", (list: Peer[]) => updatePeers(list));
    socket.on("peer:joined", (peer: Peer) => {
      updatePeers([...peerIds.current.filter(({ id }) => id !== peer.id), peer]);
      if (isCallActive.current) createPeerConnection(peer.id);
    });
    socket.on("peer:name", ({ id, name: peerName }: Peer) => {
      updatePeers(peerIds.current.map((peer) => peer.id === id ? { ...peer, name: peerName } : peer));
    });
    socket.on("peer:left", (peerId: string) => {
      closePeer(peerId);
      updatePeers(peerIds.current.filter(({ id }) => id !== peerId));
    });
    socket.on("rtc:signal", (signal: Signal) => void handleSignal(signal));
    socket.on("chat:history", (history: ChatMessage[]) => setChatMessages(history));
    socket.on("chat:message", (chatMessage: ChatMessage) => {
      setChatMessages((current) => [...current, chatMessage].slice(-100));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages]);

  useEffect(() => () => {
    for (const connection of peerConnections.current.values()) connection.close();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function startCall() {
    setCallError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCallActive(true);
      setMicrophoneEnabled(true);
      setCameraEnabled(true);
      isCallActive.current = true;
      for (const peer of peerIds.current) createPeerConnection(peer.id);
    } catch (error) {
      setCallError(
        error instanceof Error && error.name === "NotAllowedError"
          ? "Allow camera and microphone access in your browser to join the call."
          : "Could not access your camera or microphone. Check your device settings.",
      );
    }
  }

  function endCall() {
    for (const peerId of peerConnections.current.keys()) {
      socketRef.current?.emit("rtc:signal", { to: peerId, ended: true });
      closePeer(peerId);
    }
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    setRemoteStreams({});
    setCallActive(false);
    setMicrophoneEnabled(true);
    setCameraEnabled(true);
    isCallActive.current = false;
    setCallError("");
  }

  function handleSetVideo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedUrl = mediaUrl.trim();
    try {
      const parsedUrl = new URL(trimmedUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Unsupported URL");
      setMessage("");
      const state = { url: parsedUrl.href, currentTime: 0, paused: true };
      setPlaybackUrl(state.url);
      pendingRemoteState.current = state;
      sendMediaState(state);
    } catch {
      setMessage("Enter a valid http or https video URL.");
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Invite link copied.");
    } catch {
      setMessage("Could not copy the link. Copy it from your address bar.");
    }
  }

  function onVideoEvent() {
    const video = videoRef.current;
    if (!video || !playbackUrl || applyingRemoteState.current) return;
    sendMediaState({
      url: playbackUrl,
      currentTime: video.currentTime,
      paused: video.paused,
    });
  }

  function onVideoProgress() {
    const video = videoRef.current;
    if (!video || video.paused) return;
    const second = Math.floor(video.currentTime);
    if (second % 5 === 0 && second !== lastTimeSync.current) {
      lastTimeSync.current = second;
      onVideoEvent();
    }
  }

  function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = nameDraft.trim().slice(0, 32);
    if (!normalizedName) return;
    setName(normalizedName);
    setNameDraft(normalizedName);
    localStorage.setItem("common-room-name", normalizedName);
    socketRef.current?.emit("profile:name", normalizedName);
  }

  function sendChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text || !connected) return;
    socketRef.current?.emit("chat:send", text);
    setChatDraft("");
  }

  function toggleTracks(kind: "audio" | "video") {
    const tracks = localStreamRef.current?.getTracks().filter((track) => track.kind === kind) ?? [];
    if (tracks.length === 0) return;
    const enabled = !tracks[0].enabled;
    tracks.forEach((track) => {
      track.enabled = enabled;
    });
    if (kind === "audio") setMicrophoneEnabled(enabled);
    else setCameraEnabled(enabled);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Common Room home">
          <span className="brand-mark">◉</span>
          <span>common room</span>
        </a>
        <div className="topbar-right">
          <span className={`connection ${connected ? "is-connected" : ""}`}>
            <span className="status-dot" />
            {connected ? "Room is live" : "Connecting"}
          </span>
          <button className="invite-button" onClick={copyInvite}>
            <span aria-hidden="true">↗</span> Invite friends
          </button>
        </div>
      </header>

      <section className="room-heading">
        <div>
          <div className="eyebrow">YOUR PRIVATE WATCH ROOM</div>
          <h1>Good things are better <span>together.</span></h1>
          <p>Watch, talk, and catch up with your people.</p>
        </div>
        <div className="room-card">
          <div className="avatar-stack" aria-hidden="true">
            <span className="avatar avatar-one">{name.charAt(0).toUpperCase()}</span>
            {viewers > 1 && <span className="avatar avatar-two">+</span>}
          </div>
          <div><strong>{viewers} {viewers === 1 ? "person" : "people"}</strong><small>in this room</small></div>
          <span className="room-divider" />
          <div><small>ROOM CODE</small><strong className="room-code">{roomId}</strong></div>
        </div>
      </section>

      <section className="room-content">
        <div className="player-section">
          <div className="player-frame">
            {playbackUrl ? (
              <video
                ref={videoRef}
                src={playbackUrl}
                controls
                playsInline
                onLoadedMetadata={() => {
                  if (pendingRemoteState.current) applyVideoState(pendingRemoteState.current);
                }}
                onPlay={onVideoEvent}
                onPause={onVideoEvent}
                onSeeked={onVideoEvent}
                onTimeUpdate={onVideoProgress}
                onError={() => setMessage("This video could not be loaded. Try a direct MP4 or WebM link.")}
              />
            ) : (
              <div className="empty-player">
                <div className="play-orb"><span>▶</span></div>
                <strong>Your next movie night starts here</strong>
                <span>Paste a video link below to get everyone watching.</span>
              </div>
            )}
            <span className="player-label"><span className="status-dot" /> LIVE ROOM</span>
          </div>

          <form className="video-form" onSubmit={handleSetVideo}>
            <label htmlFor="video-url">VIDEO LINK</label>
            <div className="input-row">
              <span className="link-icon" aria-hidden="true">↗</span>
              <input
                id="video-url"
                type="url"
                placeholder="Paste a direct video link (MP4, WebM...)"
                value={mediaUrl}
                onChange={(event) => setMediaUrl(event.target.value)}
              />
              <button type="submit">Load video <span aria-hidden="true">→</span></button>
            </div>
            <p className="form-note">Use a direct video file URL that your browser can play. Everyone shares playback.</p>
            {message && <p className="message" role="status">{message}</p>}
          </form>

          <section className="call-section">
            <div className="call-heading">
              <div><span className="panel-kicker">HANG OUT</span><h2>Video call</h2></div>
              {!callActive ? (
                <button className="call-button" onClick={() => void startCall()}>
                  <span>◉</span> Join call
                </button>
              ) : (
                <div className="call-controls">
                  <button className={`call-control ${microphoneEnabled ? "" : "is-off"}`} onClick={() => toggleTracks("audio")} aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}>
                    {microphoneEnabled ? "Mic on" : "Mic off"}
                  </button>
                  <button className={`call-control ${cameraEnabled ? "" : "is-off"}`} onClick={() => toggleTracks("video")} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"}>
                    {cameraEnabled ? "Camera on" : "Camera off"}
                  </button>
                  <button className="call-button call-button-end" onClick={endCall}>Leave call</button>
                </div>
              )}
            </div>
            {callActive ? (
              <div className="video-grid">
                {localStream && <VideoTile stream={localStream} muted label={`${name} (you)`} />}
                {Object.entries(remoteStreams).map(([peerId, stream]) => (
                  <VideoTile key={peerId} stream={stream} label={peers.find(({ id }) => id === peerId)?.name ?? "Guest"} />
                ))}
                {Object.keys(remoteStreams).length === 0 && (
                  <p className="call-hint">Your camera is on. Friends can join from their room.</p>
                )}
              </div>
            ) : (
              <p className="call-hint">Turn on your camera and microphone to catch up face to face.</p>
            )}
            {callError && <p className="call-error" role="status">{callError}</p>}
          </section>
        </div>

        <aside className="chat-panel">
          <div className="chat-header"><div><span className="panel-kicker">ROOM CHAT</span><h2>Messages</h2></div><span className="chat-count">{viewers} here</span></div>
          <form className="name-form" onSubmit={saveName}>
            <label htmlFor="display-name">YOUR NAME</label>
            <div><input id="display-name" value={nameDraft} maxLength={32} onChange={(event) => setNameDraft(event.target.value)} /><button type="submit" aria-label="Save display name">↵</button></div>
          </form>
          <div className="chat-messages" aria-live="polite">
            {chatMessages.length === 0 ? (
              <div className="chat-empty"><span>✳</span><strong>Make yourself at home</strong><p>Say hello to everyone in the room.</p></div>
            ) : chatMessages.map((chatMessage) => (
              <article className="chat-message" key={chatMessage.id}>
                <div className="chat-message-meta"><strong>{chatMessage.name}</strong><time>{new Date(chatMessage.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>
                <p>{chatMessage.text}</p>
              </article>
            ))}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-form" onSubmit={sendChat}>
            <input
              aria-label="Write a message"
              placeholder={connected ? "Write a message..." : "Connecting to chat..."}
              value={chatDraft}
              maxLength={1000}
              disabled={!connected}
              onChange={(event) => setChatDraft(event.target.value)}
            />
            <button type="submit" disabled={!chatDraft.trim() || !connected} aria-label="Send message">↑</button>
          </form>
        </aside>
      </section>

      <footer className="footer">
        <span>Made for the moments you share.</span>
        <span className="footer-right"><span className="status-dot" /> Open source · Self-hostable · No paid APIs</span>
      </footer>
    </main>
  );
}
