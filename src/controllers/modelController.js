import { WebSocket } from 'ws';

// 모델 서버의 WebSocket 연결 객체를 외부에서 참조하기 위한 전역 변수입니다.
export let modelWs = null;

// 모델 서버 WebSocket 엔드포인트입니다.
const modelEndpoint = 'wss://model.trout-model.kro.kr/ws';

// 모델 서버에 연결하고, 특정 userId에 맞는 응답을 전달합니다.
export const connectToModel = (wss) => {
  modelWs = new WebSocket(modelEndpoint);

  // 모델 서버 연결 성공 시 로그를 남깁니다.
  function onModelOpen() {
    console.log('Successfully connected to model endpoint.');
  }

  // 모델 서버 연결이 끊기면 일정 시간 후 재연결을 시도합니다.
  function onModelClose(event) {
    console.warn('Disconnected from model endpoint. Retrying in 5s...', event.reason);
    // 재연결 시도 함수로, `wss` 스코프를 안전하게 캡처합니다.
    function reconnectToModel() {
      connectToModel(wss);
    }
    setTimeout(reconnectToModel, 5000);
  }

  // 모델 서버에서 에러가 발생하면 상세 정보를 출력합니다.
  function onModelError(error) {
    console.error('Model endpoint WebSocket error:', error?.message ?? error);
  }

  // 모델 서버 메시지를 userId 기준으로 해당 클라이언트에 전달합니다.
  function onModelMessage(message) {
    const dataString = message.data.toString();
    try {
      const data = JSON.parse(dataString);
      const targetUserId = data.userId;

      for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN && client.userId === targetUserId) {
          client.send(
            JSON.stringify({
              type: 'model_response',
              userId: targetUserId,
              text: data.text,
            }),
          );
        }
      }
    } catch (error) {
      console.error('Failed to parse message from model:', dataString);
    }
  }

  modelWs.onopen = onModelOpen;
  modelWs.onclose = onModelClose;
  modelWs.onerror = onModelError;
  modelWs.onmessage = onModelMessage;
};

