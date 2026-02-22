FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# 내장 패키지 매니저 관리 도구 활성화
RUN corepack enable && corepack prepare pnpm@latest --activate

# 빌드 단계 선언 및 pnpm 캐시 마운트 이용
FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    CI=true pnpm install --no-frozen-lockfile

# 실행 전용 이미지 생성 및 결과물 복사
FROM node:20-slim
WORKDIR /app
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package.json ./package.json
COPY --from=build /usr/src/app/node_modules ./node_modules

EXPOSE 8080
CMD ["pnpm", "start"]