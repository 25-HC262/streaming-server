import { WebSocket } from "ws";

// 모델 서버의 WebSocket 연결 객체를 외부에서 참조하기 위한 전역 변수
export let modelWs = null;

const modelEndpoint = "wss://model.trout-model.kro.kr/ws";

// 모델 서버 연결 및 특정 userId에 맞는 응답을 전달
export const connectToModel = (wss) => {
  modelWs = new WebSocket(modelEndpoint);

  function onModelOpen() {
    console.log("Successfully connected to model endpoint.");
  }

  // 모델 서버 재연결 시도
  function onModelClose(event) {
    console.warn(
      "Disconnected from model endpoint. Retrying in 5s...",
      event.reason,
    );
    function reconnectToModel() {
      connectToModel(wss);
    }
    setTimeout(reconnectToModel, 5000);
  }

  // 모델 서버 에러 발생
  function onModelError(error) {
    console.error("Model endpoint WebSocket error:", error?.message ?? error);
  }

  // 모델 서버 메시지 전달
  function onModelMessage(message) {
    const dataString = message.data.toString();
    console.log("@@@@", dataString);
    try {
      const data = JSON.parse(dataString);
      const targetUserId = data.userId;

      for (const client of wss.clients) {
        if (
          client.readyState === WebSocket.OPEN &&
          client.userId === targetUserId
        ) {
          client.send(
            JSON.stringify({
              type: "model_response",
              userId: targetUserId,
              text: data.text,
            }),
          );
        }
      }
    } catch (error) {
      console.error("Failed to parse message from model:", dataString);
    }
  }

  modelWs.onopen = onModelOpen;
  modelWs.onclose = onModelClose;
  modelWs.onerror = onModelError;
  modelWs.onmessage = onModelMessage;
};
