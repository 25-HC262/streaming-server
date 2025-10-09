import express from 'express';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocketServer } from 'ws';

import { indexRoutes } from './routes/indexRoutes.js'
import { handleWebSocketConnection } from './controllers/webSocketController.js'; 


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);

// Connecting WebSocketServer into HTTP server and setting path 
const wss = new WebSocketServer({ server, path: '/stream' });
wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId');

    if (userId) {
        // ⭐ 웹소켓 객체에 userId를 직접 할당
        ws.userId = userId; 
        console.log(`@#@# 웹소켓 연결: userId ${userId} 할당`);
    }

    handleWebSocketConnection(ws, req)
});

app.use('/', express.static(join(__dirname, 'public')));
indexRoutes(app);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`HTTPS/WebSocket server running on port ${PORT}`);
});

export default app;