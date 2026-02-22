FROM node:20-slim

# 1. pnpm 설정 및 설치
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /usr/src/app

# 2. 소스 코드 복사
COPY . .

# 3. 의존성 설치 (ffmpeg 빌드 스크립트 실행 포함)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    CI=true pnpm install --no-frozen-lockfile --foreground-scripts

# 4. 포트 설정 및 실행
EXPOSE 3000
CMD ["pnpm", "start"]