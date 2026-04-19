import { Server } from "socket.io";
import http from "http";
import { env } from "../config/env";
import { parseCookies } from "../utils/cookies";
import { sessionCookieName } from "../config/security";
import { verifyToken } from "../utils/jwt";

export let io: Server;

export const initSocket = (server: http.Server) => {
  io = new Server(server, {
    cors: {
      origin: env.FRONTEND_URLS,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const sessionToken = cookies[sessionCookieName];

      if (!sessionToken) {
        next(new Error("Unauthorized"));
        return;
      }

      const { userId } = verifyToken(sessionToken);
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
    console.log(`[Socket.io] Client connected: ${socket.id}`);
    socket.on("disconnect", () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};
