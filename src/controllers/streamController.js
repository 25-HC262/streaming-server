// Video streaming functionality

document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('video');
    const status = document.getElementById('status');
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');

    
    let mediaSource = new MediaSource();
    let sourceBuffer = null;
    let mimeType = null;
    const pending = [];
    let opened = false;
    let ws;

    const connectToStreamingServer = () => {
	// const serverUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/stream?userId=${userId}`;
        const serverUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/stream`;
	console.log("@#@# serverUrl: ",serverUrl);
        ws = new WebSocket(serverUrl);
        ws.binaryType = 'arraybuffer'; 

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'subscribe', userId }));
        };

        ws.onmessage = async (event) => {
            // Change status message 
            if (typeof event.data === 'string') {
                console.log('JSON 메시지 수신 in streamcontroller:', event.data);
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'stream_started' && msg.mimeType) {
                        mimeType = msg.mimeType;
                        initializeMediaSource(mimeType);
                        status.className = 'status success';
                        status.textContent = '✅ Live stream connected. Playing...';
                        if (opened && !sourceBuffer) {
                            try {
                                sourceBuffer = mediaSource.addSourceBuffer(mimeType);
                                sourceBuffer.addEventListener('updateend', () => {
                                    if (pending.length && !sourceBuffer.updating) {
                                        sourceBuffer.appendBuffer(pending.shift());
                                    }
                                });
                            } catch (e) {
                                console.error('Failed to add SourceBuffer', e);
                            }
                        }
                    }
                    if (msg.type === 'stream_stopped') {
                        status.className = 'status info';
                        status.textContent = 'ℹ️ Stream ended.';
                        try { mediaSource.endOfStream(); } catch (_) {}
                    }
                } catch (_) {}
            } else {
                const chunk = event.data instanceof ArrayBuffer ? event.data : await event.data.arrayBuffer();
                console.log('바이너리 청크 수신, 크기:', chunk.byteLength); 

                if (sourceBuffer && !sourceBuffer.updating) {
                    try { sourceBuffer.appendBuffer(chunk); }
                    catch (e) { console.warn('appendBuffer error, queueing', e); pending.push(chunk); }
                } else {
                    pending.push(chunk);
                    
                }
            }
        };

        ws.onerror = (e) => {
            console.error('WS error', e);
            status.className = 'status error';
            status.textContent = '❌ Live WS error.';
        };

        ws.onclose = () => {
            if (mediaSource.readyState === 'open') {
                try { mediaSource.endOfStream(); } catch (_) {}
            }
        };
    };

    const initializeMediaSource = (videoMimeType) => {
        mediaSource = new MediaSource();
        video.src = URL.createObjectURL(mediaSource);
        mediaSource.addEventListener('sourceopen', () => {
            opened = true;
            if (mimeType && !sourceBuffer) {
                try {
                    sourceBuffer = mediaSource.addSourceBuffer(mimeType);
                    sourceBuffer.addEventListener('updateend', () => {
                        if (pending.length && !sourceBuffer.updating) {
                            sourceBuffer.appendBuffer(pending.shift());
                        }
                    });
                } catch (e) {
                    console.error('Failed to add SourceBuffer', e);
                }
            }
        }, { once: true });
    };

    const addVideoEventListner = () => {
        // Add video event listeners for better status updates
        video.addEventListener('play', function() {
            status.className = 'status success';
            status.textContent = '▶️ Video is now playing!';
        });
        
        video.addEventListener('pause', function() {
            status.className = 'status info';
            status.textContent = '⏸️ Video paused.';
        });
        
        video.addEventListener('error', function() {
            status.className = 'status error';
            status.textContent = '❌ Video playback error occurred.';
        });
        
        // Add loading state
        video.addEventListener('loadstart', function() {
            status.className = 'status info';
            status.textContent = '🔄 Loading video stream...';
        });
        
        // Add buffering state
        video.addEventListener('waiting', function() {
            status.className = 'status info';
            status.textContent = '⏳ Buffering video...';
        });
        
        // Add canplay state
        video.addEventListener('canplay', function() {
            status.className = 'status success';
            status.textContent = '✅ Video ready to play!';
        });
    };
    
    if (userId) {
        connectToStreamingServer();
        addVideoEventListner();
    }
});
