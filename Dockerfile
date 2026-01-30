# 构建
FROM --platform=$BUILDPLATFORM node:22-alpine as builder

# 设置目录
WORKDIR /app

# 复制依赖清单
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 预取依赖
RUN corepack enable && \
    pnpm fetch

# 复制源代码
COPY . .

# 构建项目
RUN pnpm install --offline --frozen-lockfile && \
    pnpm build

# 生产
FROM --platform=$TARGETPLATFORM node:22-alpine

# 设置目录
WORKDIR /app

# 复制产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# 安装依赖（生产）
RUN corepack enable && \
    pnpm fetch --prod && \
    pnpm install --offline --frozen-lockfile --prod

# 暴露端口
EXPOSE 3000

# 启动CSC
CMD ["node", "--run", "start"]
