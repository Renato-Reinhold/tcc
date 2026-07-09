#!/bin/bash
# Script para inicializar o banco de dados mockado antes do backend iniciar
set -e

cd /app

echo "🗄️  Verificando banco de dados PostgreSQL..."

DB_HOST_TO_CHECK="${DB_HOST:-${PGHOST:-}}"
DB_PORT_TO_CHECK="${DB_PORT:-${PGPORT:-5432}}"
DB_USER_TO_CHECK="${DB_USER:-${PGUSER:-postgres}}"
DATABASE_URL_RESOLVED="${DATABASE_URL:-}"

# Aguardar banco de dados estar pronto apenas quando houver destino explícito.
if [ -n "$DATABASE_URL_RESOLVED" ] || [ -n "$DB_HOST_TO_CHECK" ]; then
    echo "⏳ Aguardando PostgreSQL..."
    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if [ -n "$DATABASE_URL_RESOLVED" ]; then
            if python - <<'PY' 2>/dev/null
import os
from urllib.parse import urlparse
import psycopg2

url = os.environ.get("DATABASE_URL", "")
parsed = urlparse(url)
psycopg2.connect(
    host=parsed.hostname,
    port=parsed.port or 5432,
    user=parsed.username,
    password=parsed.password,
    dbname=(parsed.path or "/").lstrip("/") or "postgres",
    sslmode="require" if ("railway" in (parsed.hostname or "") or os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_PROJECT_ID")) else "prefer",
)
PY
            then
                echo "✅ PostgreSQL está pronto"
                break
            fi
        elif pg_isready -h "$DB_HOST_TO_CHECK" -p "$DB_PORT_TO_CHECK" -U "$DB_USER_TO_CHECK" 2>/dev/null; then
            echo "✅ PostgreSQL está pronto"
            break
        fi

        attempt=$((attempt + 1))
        sleep 1
    done
else
    echo "ℹ️ Nenhuma conexão de banco foi configurada; seguindo sem aguardar PostgreSQL."
fi

# Criar banco de dados mockado no Railway por padrão; localmente fica desativado
ENABLE_DB_SEED_RESOLVED="${ENABLE_DB_SEED:-}"
if [ -z "$ENABLE_DB_SEED_RESOLVED" ] && [ -n "${RAILWAY_ENVIRONMENT:-}${RAILWAY_PROJECT_ID:-}" ]; then
    ENABLE_DB_SEED_RESOLVED="true"
fi

if [ "$ENABLE_DB_SEED_RESOLVED" = "true" ]; then
    echo "📊 Criando banco de dados mockado..."
    SEED_SCRIPT="${SEED_SCRIPT:-create_mock_data_postgres.py}"
    if [ ! -f "$SEED_SCRIPT" ] && [ -f "create_mock_database_postgres.py" ]; then
        SEED_SCRIPT="create_mock_database_postgres.py"
    fi

    if [ -f "$SEED_SCRIPT" ]; then
        python "$SEED_SCRIPT"
    else
        echo "⚠️ Nenhum script de seed encontrado; seguindo sem popular banco."
    fi
else
    echo "ℹ️ Seed desativado. Defina ENABLE_DB_SEED=true para popular o banco na inicialização."
fi

# Iniciar o uvicorn
APP_PORT="${PORT:-8000}"
echo "🚀 Iniciando FastAPI na porta ${APP_PORT}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "$APP_PORT"
