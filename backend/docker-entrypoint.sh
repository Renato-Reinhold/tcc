#!/bin/bash
# Script para inicializar o banco de dados mockado antes do backend iniciar
set -e

cd /app

echo "🗄️  Verificando banco de dados PostgreSQL..."

# Aguardar banco de dados estar pronto
echo "⏳ Aguardando PostgreSQL..."
max_attempts=30
attempt=0
DB_HOST_TO_CHECK="${DB_HOST:-${PGHOST:-backend-db}}"
DB_PORT_TO_CHECK="${DB_PORT:-${PGPORT:-5432}}"
DB_USER_TO_CHECK="${DB_USER:-${PGUSER:-postgres}}"
while [ $attempt -lt $max_attempts ]; do
    if pg_isready -h "$DB_HOST_TO_CHECK" -p "$DB_PORT_TO_CHECK" -U "$DB_USER_TO_CHECK" 2>/dev/null; then
        echo "✅ PostgreSQL está pronto"
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

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
