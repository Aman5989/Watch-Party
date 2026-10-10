import express from "express";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const rooms = new Map();
const roomIdPattern = /^[a-zA-Z0-9-]{1,48}$/;

io.on("connection", (socket) => {
  socket.on("room:join", (roomId) => {
    if (typeof roomId !== "string" || !roomIdPattern.test(roomId)) return;

    if (socket.data.roomId) {
      socket.to(socket.data.roomId).emit("peer:left", socket.id);
      socket.leave(socket.data.roomId);
    }
    socket.data.roomId = roomId;
    socket.join(roomId);

    const room = rooms.get(roomId) ?? { state: null, messages: [] };
    rooms.set(roomId, room);
    const peers = Array.from(io.sockets.adapter.rooms.get(roomId) ?? [])
      .filter((peerId) => peerId !== socket.id)
      .map((peerId) => ({
        id: peerId,
        name: io.sockets.sockets.get(peerId)?.data.displayName ?? "Guest",
      }));
    socket.emit("room:peers", peers);
    socket.emit("chat:history", room.messages);
    socket.to(roomId).emit("peer:joined", {
      id: socket.id,
      name: socket.data.displayName ?? "Guest",
    });
    socket.emit("room:state", {
      state: room?.state ?? null,
      viewers: io.sockets.adapter.rooms.get(roomId)?.size ?? 1,
    });
    io.to(roomId).emit("room:viewers", io.sockets.adapter.rooms.get(roomId)?.size ?? 1);
  });

  socket.on("profile:name", (name) => {
    if (typeof name !== "string") return;
    const normalizedName = name.trim().slice(0, 32);
    if (!normalizedName) return;
    socket.data.displayName = normalizedName;
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit("peer:name", { id: socket.id, name: normalizedName });
    }
  });

  socket.on("media:state", (state) => {
    const roomId = socket.data.roomId;
    if (!roomId || !isValidMediaState(state)) return;

    const room = rooms.get(roomId) ?? { state: null, messages: [] };
    room.state = state;
    rooms.set(roomId, room);
    socket.to(roomId).emit("media:state", state);
  });

  socket.on("chat:send", (text) => {
    const roomId = socket.data.roomId;
    if (!roomId || typeof text !== "string") return;
    const content = text.trim().slice(0, 1000);
    if (!content) return;

    const room = rooms.get(roomId) ?? { state: null, messages: [] };
    const message = {
      id: `${Date.now()}-${socket.id}`,
      name: socket.data.displayName ?? "Guest",
      text: content,
      timestamp: Date.now(),
    };
    room.messages.push(message);
    if (room.messages.length > 100) room.messages.shift();
    rooms.set(roomId, room);
    io.to(roomId).emit("chat:message", message);
  });

  socket.on("rtc:signal", ({ to, description, candidate, ended } = {}) => {
    const roomId = socket.data.roomId;
    if (
      !roomId ||
      typeof to !== "string" ||
      !io.sockets.sockets.get(to)?.rooms.has(roomId)
    ) return;

    if (ended === true) {
      io.to(to).emit("rtc:signal", { from: socket.id, ended: true });
      return;
    }

    if (description && isValidDescription(description)) {
      io.to(to).emit("rtc:signal", { from: socket.id, description });
      return;
    }

    if (candidate && typeof candidate.candidate === "string" && candidate.candidate.length <= 2048) {
      io.to(to).emit("rtc:signal", { from: socket.id, candidate });
    }
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit("peer:left", socket.id);
      io.to(roomId).emit("room:viewers", io.sockets.adapter.rooms.get(roomId)?.size ?? 0);
    }
  });
});

function isValidDescription(description) {
  return (
    typeof description === "object" &&
    ["offer", "answer"].includes(description.type) &&
    typeof description.sdp === "string" &&
    description.sdp.length <= 100_000
  );
}

function isValidMediaState(state) {
  if (!state || typeof state !== "object") return false;
  if (typeof state.url !== "string" || state.url.length > 2048) return false;
  if (typeof state.paused !== "boolean") return false;
  if (typeof state.currentTime !== "number" || !Number.isFinite(state.currentTime)) return false;

  try {
    const url = new URL(state.url);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const distPath = join(process.cwd(), "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((_, response) => response.sendFile(join(distPath, "index.html")));
}

const port = Number(process.env.PORT) || 3001;
httpServer.listen(port, "0.0.0.0", () => {
  console.log(`Watch party server listening on http://localhost:${port}`);
});
