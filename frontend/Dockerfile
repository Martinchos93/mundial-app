FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* must be present at build time (baked into the client bundle).
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_ADMIN_TOKEN=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_ADMIN_TOKEN=$NEXT_PUBLIC_ADMIN_TOKEN

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
