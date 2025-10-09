// public/client.js

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('video');
    const statusDiv = document.getElementById('status');
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('userId');

    if (!userId) {
        statusDiv.textContent = '❌ URL에 userId가 없습니다. URL에 `?userId=...`를 추가하세요.';
        return;
    }

    statusDiv.textContent = `✅ userId: ${userId} - 스트림 연결 중...`;

    // 비디오 스트림을 위한 상태 변수들
    let mediaSource = null;
    let sourceBuffer = null;
    let bufferQueue = []; // 수신된 비디오 청크를 임시로 저장할 큐
    let isInitialized = false;

    // 비디오 청크 큐를 처리하는 함수
    function processBufferQueue() {
        if (!sourceBuffer || sourceBuffer.updating || bufferQueue.length === 0) {
            console.log("@#@# 처리되는 비디오가 없음");
            return;
        }

        const nextChunk = bufferQueue.shift();
        
        try {
            sourceBuffer.appendBuffer(nextChunk);
        } catch (e) {
            console.error('Buffer append error:', e);
            bufferQueue = []; // 오류 발생 시 큐 초기화
        }
    }

    // 웹소켓 서버에 연결
    const serverUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/stream?userId=${userId}`;
    console.log("서버 URL에 연결 중:", serverUrl);
    const ws = new WebSocket(serverUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
        console.log('스트리밍 서버에 연결되었습니다.');
        // 특정 사용자의 스트림을 구독하도록 서버에 요청
        ws.send(JSON.stringify({
            type: 'subscribe',
            userId: userId
        }));
    };

    ws.onmessage = (event) => {
        // 텍스트 메시지 (JSON) 처리
        console.log('@#@#메시지가 수신됨. 메시지 타입:', typeof event.data);
        if (typeof event.data === 'string') {
            try {
                const message = JSON.parse(event.data);
                console.log('JSON 메시지 수신:', message);

                if (message.type === 'stream_started') {
                    const mimeType = message.mimeType;
                    if (!mimeType) {
                         statusDiv.textContent = `❌ 스트림 메타데이터에 mimeType이 없습니다.`;
                         return;
                    }
                    if (!isInitialized) {
                        isInitialized = true;
                        mediaSource = new MediaSource();
                        videoElement.src = URL.createObjectURL(mediaSource);

                        mediaSource.addEventListener('sourceopen', () => {
                            try {
                                sourceBuffer = mediaSource.addSourceBuffer(mimeType);
                                
                                // 버퍼 업데이트가 끝날 때마다 큐를 처리하도록 이벤트 리스너 추가
                                sourceBuffer.addEventListener('updateend', processBufferQueue);
                                
                                // 초기화 전에 수신된 청크들을 처리
                                processBufferQueue();
                                
                                videoElement.play().catch(e => console.log('비디오 재생 실패:', e));
                                statusDiv.textContent = '✅ 스트림 시작됨. 비디오 재생 중...';
                            } catch (e) {
                                console.error('MediaSource addSourceBuffer 오류:', e);
                                statusDiv.textContent = `❌ 비디오 재생 오류: ${e.message}`;
                            }
                        });
                    }
                } else if (message.type === 'stream_stopped') {
                    statusDiv.textContent = '❌ 스트림이 종료되었습니다.';
                    isInitialized = false;
                    if (mediaSource && mediaSource.readyState === 'open') {
                        mediaSource.endOfStream();
                    }
                }
            } catch (error) {
                console.error('JSON 파싱 오류:', error);
            }

        // 바이너리 메시지 (비디오 청크) 처리
        } else if (event.data instanceof ArrayBuffer) {
            if (isInitialized && sourceBuffer) {
                bufferQueue.push(event.data);
                processBufferQueue(); // 즉시 새 청크를 추가 시도
            }
        }
    };

    ws.onclose = () => {
        console.log('스트리밍 서버와 연결 해제됨');
        statusDiv.textContent = '❌ 스트리밍 서버와 연결 해제됨';
    };

    ws.onerror = (err) => {
        console.error('웹소켓 오류:', err);
        statusDiv.textContent = `❌ 웹소켓 오류: ${err.message}`;
    };
});