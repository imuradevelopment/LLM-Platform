FROM node:20-alpine
WORKDIR /usr/src/app

# pnpm
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm i --frozen-lockfile || pnpm i

COPY . .

EXPOSE 4000
CMD ["pnpm", "dev"]


