// 사용자별 구독자(시청자)와 스트림 상태를 추적하기 위한 전역 Map입니다.
export const userIdToSubscribers = new Map();

// 사용자별 MIME 타입(코덱 정보)을 저장하기 위한 Map입니다.
export const userIdToMimeType = new Map();

// 사용자별 스트림 버퍼(프레임 큐 등)를 저장하기 위한 Map입니다.
export const userIdToStream = new Map();

