// Video streaming functionality
document.addEventListener('DOMContentLoaded', function() {
    const video = document.getElementById('video');
    const status = document.getElementById('status');

    // Determine playback: if userId is provided, subscribe over WS and play with MediaSource; else play demo HLS
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    const playbackUrl = '/src/video/test.m3u8';
    
    if (userId) {
        // Live playback over WebSocket + MediaSource using webm chunks
        const serverUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/stream';
        const ws = new WebSocket(serverUrl);
        ws.binaryType = 'arraybuffer';

        const mediaSource = new MediaSource();
        video.src = URL.createObjectURL(mediaSource);
        let sourceBuffer = null;
        let mimeType = null;
        const pending = [];
        let opened = false;

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

        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'subscribe', userId }));
        };
        ws.onmessage = async (event) => {
            if (typeof event.data === 'string') {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'stream_started' && msg.mimeType) {
                        mimeType = msg.mimeType;
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
    } else {
        // Fallback to demo HLS asset
        // Check if HLS is supported
        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(playbackUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
                status.className = 'status success';
                status.textContent = '✅ Video loaded successfully! Click play to start streaming.';
                console.log('HLS manifest loaded');
            });
            hls.on(Hls.Events.ERROR, function(event, data) {
                console.error('HLS Error:', data);
                status.className = 'status error';
                status.textContent = '❌ Error loading video. Check console for details.';
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = playbackUrl;
            video.addEventListener('loadedmetadata', function() {
                status.className = 'status success';
                status.textContent = '✅ Video loaded successfully! Click play to start streaming.';
            });
        } else {
            status.className = 'status error';
            status.textContent = '❌ HLS is not supported in this browser.';
        }
    }
    
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
});
