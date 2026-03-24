import express from "express";
import http from "http";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";

import { indexRoutes } from "./routes/indexRoutes.js";
import { handleWebSocketConnection } from "./controllers/webSocketController.js";
import { connectToModel } from "./controllers/modelController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

// 특정 경로(/stream)에서만 웹소켓 연결을 수락하도록 설정합니다.
const wss = new WebSocketServer({ server, path: "/stream" });

/**
 * 웹소켓 연결 이벤트 핸들러
 * 모든 상세 로직(userId 추출, 메시지 라우팅 등)은 Controller에서 담당합니다.
 */
wss.on("connection", (ws, req) => {
  handleWebSocketConnection(ws, req);
});

connectToModel(wss);

app.use("/", express.static(join(__dirname, "public")));

indexRoutes(app);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 HTTPS/WebSocket server running on port ${PORT}`);
});

export default app;
