import { WebSocket } from 'ws';
import { userIdToSubscribers, userIdToMimeType, userIdToStream } from "../config/maps.js";
import { modelWs } from './modelController.js';

// Handling connection between chrome extension - streaming server - model server
export const handleWebSocketConnection = (ws, req) => { 
        
    //const server = app.listen(3000);
    // const server = http.createServer(app);

    // Receive actions from chrome extension program   
    // const wss = new WebSocketServer({ server, path: '/stream' });

    // Central maps for tracking users and their streams
    
    // const userIdToSubscribers = new Map();
    const senderToPublishingUserIds = new Map();
    // const userIdToMimeType = new Map();
    
   const urlParams = new URLSearchParams(req.url.slice(req.url.indexOf('?')));
        const userId = urlParams.get('userId');

        if (userId) {
            ws.userId = userId;
            console.log("@#@# ws.userId: ",ws.userId)
        } else {
            console.warn("Connection attempt without a userId. Disconnecting.");
            ws.close(1008, "userId is required.");
            return;
        }

        const state = {
            subscribedUserId: null,
            isClosed: false,
        };


        ws.on('message', async (data) => {
            console.log("@#@# message 받음");
            let isBinary = false;
            let message;

            try {
                const messageText = (data instanceof Buffer) ? data.toString('utf8') : data;
                message = JSON.parse(messageText);
                
                console.log(`@#@# JSON 메시지가 수신됨 in websockercontroller: ${message.type}`);
                
            } catch (error) {
                // 영상 데이터임 
                isBinary = true;
                console.log(`@#@# 영상 데이터 받음 :`,isBinary);
            }

            if (!isBinary && message) {
                try {
                    // const message = JSON.parse(data);
                    switch (message.type) {
                        case 'start_stream': {
                            const { userId, userName, width, height, fps, mimeType } = message;
                            
                            ws.userId = userId;
                            userIdToStream.set(userId, []); // Initialize new stream buffer 
                            userIdToMimeType.set(userId, mimeType);

                            const subscribers = userIdToSubscribers.get(userId);
                            // console.log("@#@# userIdToSubscribers : ",userIdToSubscribers);
                            // console.log("@#@# subscribers : ",subscribers);
                            console.log("@#@# userId : ",userId);
                            if (subscribers) {
                                subscribers.forEach(subscriber => {
                                    if (subscriber.readyState === WebSocket.OPEN) {
                                        subscriber.send(JSON.stringify({
                                        type: 'stream_started',
                                        mimeType: mimeType
                                        }));
                                    }
                                });
                            }
                            break;
                        }
                        case 'stop_stream': {
                            const { userId } = message;
                            userIdToStream.delete(userId);
                            userIdToMimeType.delete(userId);

                            const subscribers = userIdToSubscribers.get(userId);
                            if (subscribers) {
                                subscribers.forEach(subscriber => {
                                    if (subscriber.readyState === WebSocket.OPEN) {
                                        subscriber.send(JSON.stringify({
                                        type: 'stream_stopped'
                                        }));
                                    }
                                });
                            }
                            break;
                        }
                        case 'subscribe': {
                            const userId = message.userId;
                            if (!userId) {
                                ws.send(JSON.stringify({ type: 'error', message: 'userId is required' }));
                                return;
                            }

                            state.subscribedUserId = userId;
                            
                            if (!userIdToSubscribers.has(userId)) {
                                userIdToSubscribers.set(userId, new Set());
                                console.log("@#@# userIdToSubscribers 에 추가했습니다 : ",userIdToSubscribers.has(userId));
                            }
                            
                            userIdToSubscribers.get(userId).add(ws);
                            // Send mime type first if stream has already been started 
                            if (userIdToStream.has(userId) && userIdToMimeType.has(userId)) {
                                ws.send(JSON.stringify({
                                type: 'stream_started',
                                mimeType: userIdToMimeType.get(userId)
                                }));
                            } 
                            // Stream is not started yet 
                            else {
                                ws.send(JSON.stringify({
                                    type: 'stream_stopped',
                                    message: 'Stream not yet available.'
                                }));
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
                        
                        case 'video_chunk': {
                            /*
                            // Queue: next binary message belongs to this userId
                            const { userId } = message;
                            state.pendingChunkQueue.push(userId);
                            if (modelWs && modelWs.readyState === 1) {
                                // modelWs.send(text);
                                console.log(`Forwarded metadata for user ${userId} to model.`);
                            }
                                */
                            // Next message is video chunk so,, just pass it 
                            break;
                        }
                        default: {
                            ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${message.type}` }));
                        }
                    }
                } catch (error) {
                    console.error('WS message handling error:', error);
                }
            } else if (isBinary) {
                // Handling binary data (video chunk)
                if (modelWs && modelWs.readyState === WebSocket.OPEN) {
                    const { mimeType } = message;
                    let width = 1280;
                    let height = 720;
                    // modelWs.send(data, { binary: true });
                    modelWs.send(JSON.stringify({
                        type: 'stream_config', // 새로운 타입으로 정의
                        userId,
                        mimeType,
                        width,
                        height
                    }));
                    console.log("@#@# model 한테 보냅니다 : ",!!(modelWs));
                    console.log("@#@# model 한테 보낸 데이터 : ", typeof data);
                    console.log("정확히 무슨 타입?, array buffer: ",data instanceof ArrayBuffer);
                    console.log("정확히 무슨 타입?, Blob: ",data instanceof Blob);
                    console.log(`정확히 무슨 타입?, Buffer: ${data instanceof Buffer}`);
                    if (data instanceof ArrayBuffer) {
                        console.log(`@#@# 전송된 ArrayBuffer 크기: ${data.byteLength} 바이트`);
                    } else if (data instanceof Blob) {
                        console.log(`@#@# 전송된 Blob 크기: ${data.size} 바이트`);
                    }
                }
                console.log(`@#@# ws.userID, userIdToSubscribers: ${!!ws.userId} ${userIdToSubscribers.has(ws.userId)}`);
                if (ws.userId && userIdToSubscribers.has(ws.userId)) {
                    const subscribers = userIdToSubscribers.get(ws.userId);
                    console.log(`@#@# 구독자 수: ${subscribers.size}`);
                    subscribers.forEach(subscriber => {
                        if (subscriber.readyState === WebSocket.OPEN) {
                            subscriber.send(data); // 비디오 청크를 그대로 전달
                        }
                    });
                }
            }
            /*
            try {
                if (isBinary) {
                    const publishingUserId = ws.userId;
                    if (!publishingUserId) {
                        console.warn('Binary chunk from a non-publishing connection, dropping.');
                        return;
                    }

                    if (modelWs && modelWs.readyState === 1) {
                        modelWs.send(data); // Sending video data to model 
                        console.log(`Forwarded video chunk for user ${publishingUserId} to model.`);
                    }
                    
                    // Debugging code : checking if video is sending 
                    const subs = userIdToSubscribers.get(publishingUserId);
                    if (subs && subs.size) {
                        for (const client of subs) {
                            if (client.readyState === 1) {
                                client.send(data, { binary: true });
                            }
                        }
                    }
                    return;
                }

                const text = typeof data === 'string' ? data : data.toString('utf8');
                let message;
                try {
                    message = JSON.parse(text);
                } catch (err) {
                    console.warn('Non-JSON text message received:', text.slice(0, 200));
                    return;
                }

                // Changing status of streaming server depend on chrome extension program 
                
            } catch (err) {
                console.error('WS message handling error:', err);
                try { ws.send(JSON.stringify({ type: 'error', error: String(err?.message || err) })); } catch {}
            }
                */
        });

        ws.on('close', () => {
            state.isClosed = true;
            // Remove from subscribers
            if (state.subscribedUserId) {
                const set = userIdToSubscribers.get(state.subscribedUserId);
                if (set) {
                    set.delete(ws);
                }
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
        /*
    wss.on('connection', (ws) => {
        
    });
    */
}
