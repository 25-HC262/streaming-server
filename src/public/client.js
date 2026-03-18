// 브라우저에서 스트림을 구독하고, MediaSource로 비디오를 재생합니다.
document.addEventListener('DOMContentLoaded', onDomContentLoaded);

// DOM이 준비되면 스트림 연결 로직을 시작합니다.
function onDomContentLoaded() {
  const videoElement = document.getElementById('video');
  const statusDiv = document.getElementById('status');
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId');

  if (!userId) {
    statusDiv.textContent = '❌ URL에 userId가 없습니다. URL에 `?userId=...`를 추가하세요.';
    return;
  }

  statusDiv.textContent = `✅ userId: ${userId} - 스트림 연결 중...`;

  // 비디오 청크를 임시로 저장하는 큐입니다.
  let mediaSource = null;
  let sourceBuffer = null;
  let bufferQueue = [];
  let isInitialized = false;

  // sourceBuffer가 준비/업데이트된 타이밍에 큐의 다음 청크를 append합니다.
  function processBufferQueue() {
    if (!sourceBuffer || bufferQueue.length === 0) {
      console.log('@#@# 처리되는 비디오가 없음');
      return;
    }

    if (sourceBuffer.updating) {
      console.log('소스 버퍼가 데이터를 처리 중입니다');
      return;
    }

    const nextChunk = bufferQueue.shift();

    try {
      sourceBuffer.appendBuffer(nextChunk);
    } catch (e) {
      console.error('Buffer append error:', e);
      bufferQueue = [];
    }
  }

  // 웹소켓 서버에 연결합니다.
  const serverUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/stream?userId=${userId}`;
  console.log('서버 URL에 연결 중:', serverUrl);
  const ws = new WebSocket(serverUrl);
  ws.binaryType = 'arraybuffer';

  // 서버 연결이 열리면 해당 userId를 구독합니다.
  function onWsOpen() {
    console.log('스트리밍 서버에 연결되었습니다.');
    ws.send(
      JSON.stringify({
        type: 'subscribe',
        userId: userId,
      }),
    );
  }

  ws.onopen = onWsOpen;

  // MediaSource 소스오픈 시 SourceBuffer를 생성하고 재생을 시작합니다.
  function onMediaSourceOpen(mimeType) {
    mediaSource.addEventListener(
      'sourceopen',
      // MediaSource가 소스오픈되면 SourceBuffer를 만들고 재생을 시작합니다.
      function onSourceOpenInner() {
        try {
          sourceBuffer = mediaSource.addSourceBuffer(mimeType);
          sourceBuffer.addEventListener('updateend', processBufferQueue);
          processBufferQueue();
          videoElement.play().catch(logPlayError);
          statusDiv.textContent = '✅ 스트림 시작됨. 비디오 재생 중...';
        } catch (e) {
          console.error('MediaSource addSourceBuffer 오류:', e);
          statusDiv.textContent = `❌ 비디오 재생 오류: ${e.message}`;
        }
      },
      { once: true },
    );
  }

  // 비디오 재생 실패 시 로그를 남깁니다.
  function logPlayError(e) {
    console.log('비디오 재생 실패:', e);
  }

  // 웹소켓 메시지를 텍스트(JSON)와 바이너리(비디오 청크)로 나누어 처리합니다.
  async function onWsMessage(event) {
    if (typeof event.data === 'string') {
      try {
        const message = JSON.parse(event.data);
        console.log('JSON 메시지 수신:', message);

        if (message.type === 'stream_started') {
          const mimeType = message.mimeType;
          if (!mimeType) {
            statusDiv.textContent = '❌ 스트림 메타데이터에 mimeType이 없습니다.';
            return;
          }

          if (!isInitialized) {
            isInitialized = true;
            mediaSource = new MediaSource();
            videoElement.src = URL.createObjectURL(mediaSource);
            onMediaSourceOpen(mimeType);
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
      return;
    }

    if (!(event.data instanceof ArrayBuffer)) return;

    const arrayBuffer = event.data instanceof ArrayBuffer ? event.data : await event.data.arrayBuffer();

    // 네트워크 지연 계산용 타임스탬프를 추출합니다.
    const receivedAt = performance.now();
    const view = new DataView(arrayBuffer);
    const sentAt = view.getFloat64(0, true);
    const videoChunk = arrayBuffer.slice(8);

    if (sentAt > 0 && sentAt < 1e15) {
      const latency = (receivedAt - sentAt).toFixed(2);
      console.log(
        `%c[NETWORK LATENCY] %c${latency}ms`,
        'color: #00ff00; font-weight: bold;',
        'color: #fff;',
      );
    } else {
      console.warn('⚠️ 타임스탬프가 비정상입니다. 전송부의 헤더를 확인하세요.');
    }

    // sourceBuffer에 append하거나 큐에 적재합니다.
    if (sourceBuffer && !sourceBuffer.updating) {
      try {
        sourceBuffer.appendBuffer(videoChunk);
      } catch (e) {
        bufferQueue.push(videoChunk);
      }
    } else {
      bufferQueue.push(videoChunk);
    }
  }

  ws.onmessage = onWsMessage;

  // 연결이 닫히면 상태를 갱신합니다.
  function onWsClose() {
    console.log('스트리밍 서버와 연결 해제됨');
    statusDiv.textContent = '❌ 스트리밍 서버와 연결 해제됨';
  }

  ws.onclose = onWsClose;

  // 연결 오류 시 사용자에게 알립니다.
  function onWsError(err) {
    console.error('웹소켓 오류:', err);
    statusDiv.textContent = `❌ 웹소켓 오류: ${err.message}`;
  }

  ws.onerror = onWsError;
}

