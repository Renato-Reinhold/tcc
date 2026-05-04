FROM python:3.11-slim

WORKDIR /app

# Variáveis de ambiente
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements
COPY requirements.txt .

# Instalar dependências Python
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copiar código da aplicação
COPY ./app ./app

# Copiar script de inicialização e gerador de dados mock
COPY create_mock_database.py .
COPY create_mock_data_postgres.py .
COPY create_mock_database_postgres.py .
COPY docker-entrypoint.sh .

RUN chmod +x /app/docker-entrypoint.sh

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/ || exit 1

# Porta padrão
EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
