import express from 'express';
import http from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

import { indexRoutes } from './routes/indexRoutes.js';
import { handleWebSocketConnection } from './controllers/webSocketController.js';
import { connectToModel } from './controllers/modelController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Express 앱을 생성해 HTTP 서버에 연결합니다.
const app = express();
const server = http.createServer(app);

// HTTP 서버에 WebSocketServer를 붙이고 `/stream` 경로로 라우팅합니다.
const wss = new WebSocketServer({ server, path: '/stream' });

// 클라이언트의 WebSocket 연결을 처리하며, 스트림 중계 로직을 시작합니다.
function onWsConnection(ws, req) {
  const url = req?.url ?? '';
  const queryIndex = url.indexOf('?');
  const query = queryIndex !== -1 ? url.slice(queryIndex + 1) : '';
  const urlParams = new URLSearchParams(query);
  const userId = urlParams.get('userId');

  if (userId) ws.userId = userId;
  console.log(`@#@# 웹소켓 연결: userId ${userId} 할당`);
  handleWebSocketConnection(ws, req);
}

wss.on('connection', onWsConnection);

// 모델 서버 연결은 서버 시작 시 1회만 시도합니다.
connectToModel(wss);

// 브라우저에서 접근하는 정적 파일을 제공하기 위한 설정입니다.
app.use('/', express.static(join(__dirname, 'public')));

// 라우트를 등록해 루트 페이지를 제공합니다.
indexRoutes(app);

const PORT = process.env.PORT || 3000;

// 서버가 실행되면 포트를 로그로 출력합니다.
function onServerListening() {
  console.log(`HTTPS/WebSocket server running on port ${PORT}`);
}

server.listen(PORT, onServerListening);

export default app;

