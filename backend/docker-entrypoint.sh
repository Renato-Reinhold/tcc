#!/bin/bash
# Script para inicializar o banco de dados mockado antes do backend iniciar

cd /app

echo "🗄️  Verificando banco de dados PostgreSQL..."

# Aguardar banco de dados estar pronto
echo "⏳ Aguardando PostgreSQL..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if pg_isready -h ${DB_HOST:-backend-db} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} 2>/dev/null; then
        echo "✅ PostgreSQL está pronto"
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

# Criar banco de dados mockado
echo "📊 Criando banco de dados mockado..."
python create_mock_data_postgres.py

# Iniciar o uvicorn
echo "🚀 Iniciando FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
