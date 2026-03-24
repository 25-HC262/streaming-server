import { WebSocket } from "ws";
import {
  userIdToMimeType,
  userIdToStream,
  userIdToSubscribers,
} from "../config/maps.js";
import { modelWs } from "./modelController.js";

export const handleWebSocketConnection = (ws, req) => {
  // 1. 초기 상태 설정
  const state = {
    subscribedUserId: null,
    isClosed: false,
  };

  // URL 파라미터에서 userId 추출
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    ws.close(1008, "userId is required.");
    return;
  }

  ws.userId = userId;

  /**
   * [추가] 연결 종료 처리 함수
   */
  function handleWsClose() {
    state.isClosed = true;

    if (state.subscribedUserId) {
      const set = userIdToSubscribers.get(state.subscribedUserId);
      if (set) set.delete(ws);
    }
  }

  /**
   * 바이너리 프레임(이미지) 처리 함수
   */
  function handleBinaryFrame(data) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    if (buffer.byteLength < 4) return;

    const userIdLen = buffer.readUInt32BE(0);
    const userIdEnd = 4 + userIdLen;
    if (buffer.byteLength < userIdEnd) return;

    const extractedUserId = buffer.subarray(4, userIdEnd).toString("utf8");

    // 모델 서버 전송
    if (modelWs && modelWs.readyState === WebSocket.OPEN) {
      modelWs.send(buffer, { binary: true });
    }

    // 구독자들에게 중계
    const subscribers = userIdToSubscribers.get(extractedUserId);
    if (subscribers) {
      for (const subscriber of subscribers) {
        if (subscriber.readyState === WebSocket.OPEN) {
          subscriber.send(buffer, { binary: true });
        }
      }
    }
  }

  /**
   * 메시지 통합 핸들러
   */
  async function handleWsMessage(data) {
    let messageString = "";
    const isBuffer = Buffer.isBuffer(data);

    // JSON 텍스트인지 판별 (첫 바이트가 '{' 인지 확인)
    if (!isBuffer && typeof data === "string") {
      messageString = data;
    } else if (isBuffer && data[0] === 123) {
      // 123은 '{' 의 ASCII 코드
      messageString = data.toString("utf8");
    }

    // 텍스트(JSON) 메시지 처리
    if (messageString.startsWith("{")) {
      try {
        const parsedMessage = JSON.parse(messageString);

        switch (parsedMessage.type) {
          case "start_stream": {
            const { userId: pubId, mimeType } = parsedMessage;
            ws.userId = pubId;
            userIdToStream.set(pubId, []);
            userIdToMimeType.set(pubId, mimeType);

            console.log(`[START_STREAM] ${pubId}`);

            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "stream_started", mimeType }));
              ws.send(
                JSON.stringify({
                  type: "info",
                  message: "수어 번역을 시작합니다",
                }),
              );
            }
            break;
          }

          case "stop_stream": {
            const { userId: pubId } = parsedMessage;
            console.log(`[STOP_STREAM] ${pubId}`);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "info",
                  message: "수어 번역을 종료합니다",
                }),
              );
            }
            userIdToStream.delete(pubId);
            break;
          }

          case "subscribe": {
            const subId = parsedMessage.userId;
            state.subscribedUserId = subId;
            if (!userIdToSubscribers.has(subId)) {
              userIdToSubscribers.set(subId, new Set());
            }
            userIdToSubscribers.get(subId).add(ws);
            break;
          }
        }
      } catch (e) {
        console.error("JSON Parsing Error", e);
      }
      return;
    }

    // JSON이 아니면 바이너리 이미지로 처리
    handleBinaryFrame(data);
  }

  ws.on("message", handleWsMessage);
  ws.on("close", handleWsClose);
};
