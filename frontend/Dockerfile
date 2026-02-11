# Etapa 1: Build do React com Vite
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package files
COPY package.json package-lock.json* ./

# Instalar dependências
RUN npm install

# Copiar código-fonte
COPY . .

# Build para produção
RUN npm run build

# Etapa 2: Runtime - Desenvolvimento com Vite (para dev)
FROM node:22-alpine AS development

WORKDIR /app

COPY package.json package-lock.json* bun.lockb* ./
RUN npm install

COPY . .

EXPOSE 80 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# Etapa 3: Produção com Nginx
FROM nginx:alpine AS production

# Remover configuração padrão
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuração customizada
COPY nginx.conf /etc/nginx/conf.d/app.conf

# Copiar arquivos buildados
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
