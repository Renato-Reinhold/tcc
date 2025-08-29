# Etapa 1: Build do React
FROM node:22-alpine AS build

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: Servir com Nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Expor porta padrão do Nginx
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
