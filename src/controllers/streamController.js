// 브라우저에서 스트리밍 서버로부터 비디오 청크를 받아 재생합니다.
document.addEventListener('DOMContentLoaded', onDomContentLoaded);

// DOM이 준비되면 userId 기반으로 스트리밍을 시작합니다.
function onDomContentLoaded() {
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

  // SourceBuffer의 updateend 시점에 큐의 다음 청크를 append합니다.
  function onSourceBufferUpdateEnd() {
    if (!sourceBuffer || pending.length === 0) return;
    if (sourceBuffer.updating) return;
    sourceBuffer.appendBuffer(pending.shift());
  }

  // WebSocket 서버에 연결해 subscribe 요청을 보내고 메시지를 처리합니다.
  function connectToStreamingServer() {
    const serverUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + `/stream?userId=${userId}`;
    console.log('@#@# serverUrl: ', serverUrl);

    ws = new WebSocket(serverUrl);
    ws.binaryType = 'arraybuffer';

    // 연결되면 해당 userId 스트림을 구독합니다.
    function onWsOpen() {
      ws.send(JSON.stringify({ type: 'subscribe', userId }));
    }

    // 메시지는 JSON(상태) 또는 바이너리(비디오 청크)로 처리합니다.
    async function onWsMessage(event) {
      if (typeof event.data === 'string') {
        // console.log('JSON 메시지 수신 in streamcontroller:', event.data);
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
                sourceBuffer.addEventListener('updateend', onSourceBufferUpdateEnd);
              } catch (e) {
                console.error('Failed to add SourceBuffer', e);
              }
            }
          }

          if (msg.type === 'stream_stopped') {
            status.className = 'status info';
            status.textContent = 'ℹ️ Stream ended.';
            try {
              mediaSource.endOfStream();
            } catch (_) {}
          }
        } catch (_) {}
        return;
      }

      const chunk = event.data instanceof ArrayBuffer ? event.data : await event.data.arrayBuffer();
      // console.log('바이너리 청크 수신, 크기:', chunk.byteLength);

      if (sourceBuffer && !sourceBuffer.updating) {
        try {
          sourceBuffer.appendBuffer(chunk);
        } catch (e) {
          console.warn('appendBuffer error, queueing', e);
          pending.push(chunk);
        }
      } else {
        pending.push(chunk);
      }
    }

    // WebSocket 에러가 발생하면 상태를 업데이트합니다.
    function onWsError(e) {
      console.error('WS error', e);
      status.className = 'status error';
      status.textContent = '❌ Live WS error.';
    }

    // WebSocket이 닫히면 MediaSource를 종료합니다.
    function onWsClose() {
      if (mediaSource.readyState === 'open') {
        try {
          mediaSource.endOfStream();
        } catch (_) {}
      }
    }

    ws.onopen = onWsOpen;
    ws.onmessage = onWsMessage;
    ws.onerror = onWsError;
    ws.onclose = onWsClose;
  }

  // MediaSource를 초기화하고 sourceopen 시 SourceBuffer 구성을 준비합니다.
  function initializeMediaSource(videoMimeType) {
    mediaSource = new MediaSource();
    video.src = URL.createObjectURL(mediaSource);
    opened = false;
    mimeType = videoMimeType;

    // MediaSource가 열리면 SourceBuffer를 만들고 큐를 이어서 재생합니다.
    function onMediaSourceSourceOpen() {
      opened = true;
      if (mimeType && !sourceBuffer) {
        try {
          sourceBuffer = mediaSource.addSourceBuffer(mimeType);
          sourceBuffer.addEventListener('updateend', onSourceBufferUpdateEnd);
        } catch (e) {
          console.error('Failed to add SourceBuffer', e);
        }
      }
    }

    mediaSource.addEventListener('sourceopen', onMediaSourceSourceOpen, { once: true });
  }

  // 비디오 플레이/에러 상태를 UI에 반영하기 위한 이벤트 리스너를 추가합니다.
  function addVideoEventListner() {
    // 비디오 재생 시작 시 상태를 갱신합니다.
    function onVideoPlay() {
      status.className = 'status success';
      status.textContent = '▶️ Video is now playing!';
    }

    // 비디오 일시정지 시 상태를 갱신합니다.
    function onVideoPause() {
      status.className = 'status info';
      status.textContent = '⏸️ Video paused.';
    }

    // 비디오 재생 중 에러가 발생하면 상태를 갱신합니다.
    function onVideoError() {
      status.className = 'status error';
      status.textContent = '❌ Video playback error occurred.';
    }

    // 비디오 로딩 시작 시 상태를 갱신합니다.
    function onVideoLoadStart() {
      status.className = 'status info';
      status.textContent = '🔄 Loading video stream...';
    }

    // 비디오 버퍼링 시 상태를 갱신합니다.
    function onVideoWaiting() {
      status.className = 'status info';
      status.textContent = '⏳ Buffering video...';
    }

    // 비디오를 재생할 준비가 되면 상태를 갱신합니다.
    function onVideoCanPlay() {
      status.className = 'status success';
      status.textContent = '✅ Video ready to play!';
    }

    video.addEventListener('play', onVideoPlay);
    video.addEventListener('pause', onVideoPause);
    video.addEventListener('error', onVideoError);
    video.addEventListener('loadstart', onVideoLoadStart);
    video.addEventListener('waiting', onVideoWaiting);
    video.addEventListener('canplay', onVideoCanPlay);
  }

  if (userId) {
    connectToStreamingServer();
    addVideoEventListner();
  }
}

