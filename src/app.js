import express from 'express';
import fs from 'fs';
import hls from 'hls-server';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// 엔드포인트 ws://3.34.11.17:8000/ws

//const privateKey = fs.readFileSync(join(__dirname, 'private.key'), 'utf8');
//const certificate = fs.readFileSync(join(__dirname, 'certificate.crt'), 'utf8');
//const credentials = { key: privateKey, cert: certificate };


// Websocket client 
const modelEndpoint = 'wss://model.trout-model.kro.kr/ws';
let modelWs = null;

function connectToModel() {
    modelWs = new WebSocket(modelEndpoint);

    modelWs.onopen = () => {
        console.log('Successfully connected to model endpoint.');
    };

    modelWs.onclose = (event) => {
        console.warn('Disconnected from model endpoint. Retrying in 5s...', event.reason);
        setTimeout(connectToModel, 5000);
    };

    modelWs.onerror = (error) => {
        console.error('Model endpoint WebSocket error:', error);
    };

    modelWs.onmessage = (message) => {
        // 모델로부터의 응답 처리 (필요시)
        try {
            const data = JSON.parse(message.data);
            console.log(`[모델 서버 응답] -> ${data.text}`);
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message.data); // message.data는 이미 JSON 문자열
                }
            });
        } catch (error) {
            console.error('Failed to parse message from model:', message.data);
        }
    };
}

connectToModel();

// Serve static files from the src directory
app.use('/', express.static(join(__dirname, '..')));
//app.use(express.static(join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile('./src/client.html', { root: process.cwd() });
});

//const server = app.listen(3000);
const server = http.createServer(app);

// WebSocket server for receiving live streams and forwarding to viewers
const wss = new WebSocketServer({ server, path: '/stream' });

// Routing maps
const userIdToSubscribers = new Map();
const senderToPublishingUserIds = new Map(); 
const userIdToMimeType = new Map(); 

// Keep simple per-connection state for pairing metadata with the next binary chunk
wss.on('connection', (ws) => {
    const state = {
        pendingChunkQueue: [],
        subscribedUserId: null,
        isClosed: false,
    };

    ws.on('message', async (data, isBinary) => {
        try {
            if (isBinary) {
                if (state.pendingChunkQueue.length === 0) {
                    console.warn('Binary chunk without prior metadata, dropping');
                    return;
                }
                const userId = state.pendingChunkQueue.shift();
                if (modelWs && modelWs.readyState === 1) {
                    modelWs.send(data);
                    console.log(`Forwarded video chunk for user ${userId} to model.`);
                }
                return;
                
                // const subs = userIdToSubscribers.get(userId);
                // if (subs && subs.size) {
                //     for (const client of subs) {
                //         if (client.readyState === 1) {
                //             client.send(data, { binary: true });
                //         }
                //     }
                // }
                // return;
            }

            // Text message: try parse JSON control/info messages
            const text = typeof data === 'string' ? data : data.toString('utf8');
            let message;
            try {
                message = JSON.parse(text);
            } catch (err) {
                console.warn('Non-JSON text message received:', text.slice(0, 200));
                return;
            }

            switch (message.type) {
                case 'start_stream': {
                    const { userId, userName, width, height, fps, mimeType } = message;
                    console.log("@#@#",userId);
                    userIdToMimeType.set(userId, mimeType || 'video/webm');
                    let set = senderToPublishingUserIds.get(ws);
                    if (!set) { set = new Set(); senderToPublishingUserIds.set(ws, set); }
                    set.add(userId);
                    // Notify subscribers that stream is ready
                    const subs = userIdToSubscribers.get(userId);
                    if (subs && subs.size) {
                        for (const client of subs) {
                            if (client.readyState === 1) {
                                client.send(JSON.stringify({ type: 'stream_started', userId, userName, width, height, fps, mimeType: userIdToMimeType.get(userId) }));
                            }
                        }
                    }
                    // Ack to sender
                    ws.send(JSON.stringify({ type: 'stream_started', userId, userName, width, height, fps }));
                    break;
                }
                case 'video_chunk': {
                    // Queue: next binary message belongs to this userId
                    const { userId } = message;
                    state.pendingChunkQueue.push(userId);
                    if (modelWs && modelWs.readyState === 1) {
                        modelWs.send(text);
                        console.log(`Forwarded metadata for user ${userId} to model.`);
                    }
                    break;
                }
                case 'stop_stream': {
                    const { userId } = message;
                    // Notify subscribers and cleanup
                    const subs = userIdToSubscribers.get(userId);
                    if (subs && subs.size) {
                        for (const client of subs) {
                            if (client.readyState === 1) {
                                client.send(JSON.stringify({ type: 'stream_stopped', userId }));
                            }
                        }
                    }
                    const pub = senderToPublishingUserIds.get(ws);
                    if (pub) pub.delete(userId);
                    userIdToMimeType.delete(userId);
                    ws.send(JSON.stringify({ type: 'stream_stopped', userId }));
                    break;
                }
                case 'subscribe': {
                    const { userId } = message;
                    state.subscribedUserId = userId;
                    let set = userIdToSubscribers.get(userId);
                    if (!set) { set = new Set(); userIdToSubscribers.set(userId, set); }
                    set.add(ws);
                    const mt = userIdToMimeType.get(userId);
                    if (mt) {
                        ws.send(JSON.stringify({ type: 'stream_started', userId, mimeType: mt }));
                    } else {
                        ws.send(JSON.stringify({ type: 'waiting', userId }));
                    }
                    break;
                }
                case 'unsubscribe': {
                    const { userId } = message;
                    const set = userIdToSubscribers.get(userId);
                    if (set) set.delete(ws);
                    if (state.subscribedUserId === userId) state.subscribedUserId = null;
                    ws.send(JSON.stringify({ type: 'unsubscribed', userId }));
                    break;
                }
                default: {
                    ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${message.type}` }));
                }
            }
        } catch (err) {
            console.error('WS message handling error:', err);
            try { ws.send(JSON.stringify({ type: 'error', error: String(err?.message || err) })); } catch {}
        }
    });

    ws.on('close', () => {
        state.isClosed = true;
        // Remove from subscribers
        if (state.subscribedUserId) {
            const set = userIdToSubscribers.get(state.subscribedUserId);
            if (set) set.delete(ws);
        }
        // If sender, notify and cleanup
        const publishing = senderToPublishingUserIds.get(ws);
        if (publishing) {
            for (const userId of publishing) {
                const subs = userIdToSubscribers.get(userId);
                if (subs && subs.size) {
                    for (const client of subs) {
                        if (client.readyState === 1) {
                            client.send(JSON.stringify({ type: 'stream_stopped', userId }));
                        }
                    }
                }
                userIdToMimeType.delete(userId);
            }
            senderToPublishingUserIds.delete(ws);
        }
    });
});


server.listen(3000, () => {
    console.log('HTTPS server running on port 3000');
});

// HLS server configuration
new hls(server, {
    provider: {
        exists: (req, cb) => {
            const ext = req.url.split('.').pop();
            if (ext !== 'm3u8' && ext !== 'ts') {
                return cb(null, true);
            }

            const filePath = join(process.cwd(), 'src', req.url.replace('/src', ''));
            fs.access(filePath, fs.constants.F_OK, (err) => {
                if (err) {
                    console.log('File not exist:', filePath);
                    return cb(null, false);
                }
                cb(null, true);
            });
        },
        getManifestStream: (req, cb) => {
            const filePath = join(process.cwd(), 'src', req.url.replace('/src', ''));
            const stream = fs.createReadStream(filePath);
            cb(null, stream);
        },
        getSegmentStream: (req, cb) => {
            const filePath = join(process.cwd(), 'src', req.url.replace('/src', ''));
            const stream = fs.createReadStream(filePath);
            cb(null, stream);
        }
    }
});

export default app;
