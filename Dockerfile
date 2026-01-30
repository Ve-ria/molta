# 构建
FROM --platform=$BUILDPLATFORM node:22-alpine as builder

# 设置目录
WORKDIR /app

# 复制依赖清单
COPY package.json yarn.lock .yarnrc.yml ./

# 安装依赖
RUN corepack enable && \
    corepack prepare yarn@4.12.0 --activate && \
    yarn install --immutable

# 复制源代码
COPY . .

# 构建项目
RUN yarn build

# 生产
FROM --platform=$TARGETPLATFORM node:22-alpine

# 设置目录
WORKDIR /app

# 复制产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./

# 安装依赖（生产）
RUN corepack enable && \
    corepack prepare yarn@4.10.0 --activate && \
    yarn install --immutable --production

# 暴露端口
EXPOSE 3000

# 启动CSC
CMD ["node", "--run", "start"]
