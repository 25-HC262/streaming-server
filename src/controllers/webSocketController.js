import { WebSocket } from "ws";
import {
  userIdToMimeType,
  userIdToStream,
  userIdToSubscribers,
} from "../config/maps.js";
import { modelWs } from "./modelController.js";

// Chrome 확장 프로그램 ↔ 스트리밍 서버 ↔ 모델 서버 사이의 메시지를 중계합니다.
export const handleWebSocketConnection = (ws, req) => {
  ws.send(
    JSON.stringify({
      type: "info",
      message: "서버와 연결되었습니다. 모델 서버 없이 통신 테스트 중입니다.",
    }),
  );

  const state = {
    subscribedUserId: null,
    isClosed: false,
  };

  // URL 파라미터에서 userId를 추출해 세션에 바인딩합니다.
  const url = new URL(req.url, `http://${req.headers.host}`);
  // const queryIndex = url.indexOf('?');
  // const query = queryIndex !== -1 ? url.slice(queryIndex + 1) : '';
  // const urlParams = new URLSearchParams(query);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    ws.close(1008, "userId is required.");
    return;
  }

  ws.userId = userId;

  // WebSocket 프레임을 텍스트/바이너리로 구분해 제어 메시지와 프레임을 라우팅합니다.
  async function handleWsMessage(data) {
    // 텍스트 메시지 처리 (JSON 제어 메시지)
    if (typeof data === "string") {
      // 텍스트 프레임은 제어 JSON으로 취급합니다.
      let parsedMessage;
      try {
        parsedMessage = JSON.parse(data);
      } catch (_) {
        return;
      }

      // 주기 확인용 ping/pong 처리입니다.
      if (parsedMessage.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", sentAt: parsedMessage.sentAt }));
        return;
      }

      switch (parsedMessage.type) {
        case "start_stream": {
          const {
            userId: publishingUserId,
            mimeType,
            fps,
            width,
            height,
          } = parsedMessage;
          ws.userId = publishingUserId;
          userIdToStream.set(publishingUserId, []);
          userIdToMimeType.set(publishingUserId, mimeType);

          const subscribers = userIdToSubscribers.get(publishingUserId);
          if (subscribers) {
            for (const subscriber of subscribers) {
              if (subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(
                  JSON.stringify({ type: "stream_started", mimeType }),
                );
                subscriber.send(
                  JSON.stringify({
                    type: "info",
                    message: "수어 번역을 시작합니다",
                  }),
                );
              }
            }
          }

          // 모델 서버에 스트림 메타데이터를 전달합니다.
          if (modelWs && modelWs.readyState === WebSocket.OPEN) {
            const config = {
              type: "stream_config",
              userId: publishingUserId,
              mimeType,
              fps,
              width,
              height,
            };
            console.log("@@@@", config.userId);
            // 값이 없으면 불필요한 키 전송을 줄입니다.
            if (typeof width === "undefined") delete config.width;
            if (typeof height === "undefined") delete config.height;
            modelWs.send(JSON.stringify(config));
          }
          break;
        }

        case "stop_stream": {
          const { userId: publishingUserId } = parsedMessage;
          userIdToStream.delete(publishingUserId);
          userIdToMimeType.delete(publishingUserId);

          const subscribers = userIdToSubscribers.get(publishingUserId);
          if (subscribers) {
            for (const subscriber of subscribers) {
              if (subscriber.readyState === WebSocket.OPEN) {
                subscriber.send(JSON.stringify({ type: "stream_stopped" }));
                subscriber.send(
                  JSON.stringify({
                    type: "info",
                    message: "수어 번역을 종료합니다",
                  }),
                );
              }
            }
          }

          if (modelWs && modelWs.readyState === WebSocket.OPEN) {
            modelWs.send(
              JSON.stringify({ type: "stop_stream", userId: publishingUserId }),
            );
          }
          break;
        }

        case "subscribe": {
          const subscribeUserId = parsedMessage.userId;
          if (!subscribeUserId) {
            ws.send(
              JSON.stringify({ type: "error", error: "userId is required" }),
            );
            return;
          }

          state.subscribedUserId = subscribeUserId;
          if (!userIdToSubscribers.has(subscribeUserId)) {
            userIdToSubscribers.set(subscribeUserId, new Set());
          }
          userIdToSubscribers.get(subscribeUserId).add(ws);

          // 스트림이 이미 시작됐으면 mimeType을 먼저 전달합니다.
          if (
            userIdToStream.has(subscribeUserId) &&
            userIdToMimeType.has(subscribeUserId)
          ) {
            ws.send(
              JSON.stringify({
                type: "stream_started",
                mimeType: userIdToMimeType.get(subscribeUserId),
              }),
            );
          } else {
            ws.send(
              JSON.stringify({
                type: "stream_stopped",
                error: "Stream not yet available.",
              }),
            );
          }
          break;
        }

        case "unsubscribe": {
          const { userId: unsubUserId } = parsedMessage;
          const set = userIdToSubscribers.get(unsubUserId);
          if (set) set.delete(ws);
          if (state.subscribedUserId === unsubUserId)
            state.subscribedUserId = null;
          ws.send(
            JSON.stringify({ type: "unsubscribed", userId: unsubUserId }),
          );
          break;
        }

        default:
          ws.send(
            JSON.stringify({
              type: "error",
              error: `Unknown message type: ${parsedMessage.type}`,
            }),
          );
      }
      return;
    }

    // 바이너리 프레임은 [4byte userIdLen][UTF-8 userId][JPEG bytes] 프로토콜을 그대로 처리합니다.
    const buffer = data instanceof Buffer ? data : Buffer.from(data);
    if (buffer.byteLength < 4) return;

    let publishingUserId = ws.userId;
    const userIdLen = buffer.readUInt32BE(0);
    const userIdStart = 4;
    const userIdEnd = userIdStart + userIdLen;

    if (buffer.byteLength < userIdEnd) return;

    const extractedUserId = buffer.subarray(4, userIdEnd).toString("utf8");

    // 모델 서버와 구독자에게는 수신 프레임을 원본 그대로 전달합니다.
    if (modelWs && modelWs.readyState === WebSocket.OPEN) {
      modelWs.send(buffer, { binary: true });
    }

    const subscribers = userIdToSubscribers.get(extractedUserId);
    if (subscribers) {
      for (const subscriber of subscribers) {
        if (subscriber.readyState === WebSocket.OPEN) {
          subscriber.send(buffer, { binary: true });
        }
      }
    }
  }

  // 연결이 종료되면 구독자 목록에서 해당 WebSocket을 제거합니다.
  function handleWsClose() {
    state.isClosed = true;
    if (!state.subscribedUserId) return;

    const set = userIdToSubscribers.get(state.subscribedUserId);
    if (set) set.delete(ws);
  }

  ws.on("message", handleWsMessage);
  ws.on("close", handleWsClose);
};
