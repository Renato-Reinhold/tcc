#!/bin/bash
# Script para gerar banco de dados mockado no Linux/Mac

echo ""
echo "================================"
echo "   Banco de Dados Mockado"
echo "================================"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "requirements.txt" ]; then
    echo "❌ Erro: Execute este script no diretório backend/"
    exit 1
fi

# Verificar se o Python está instalado
if ! command -v python3 &> /dev/null; then
    echo "❌ Erro: Python 3 não encontrado"
    exit 1
fi

# Backup do banco existente
if [ -f "test.db" ]; then
    echo ""
    echo "📁 Fazendo backup do banco antigo..."
    
    backup_name="test.db.backup_$(date +%Y%m%d_%H%M%S)"
    mv test.db "$backup_name"
    
    echo "   ✓ Backup criado: $backup_name"
fi

echo ""
echo "📊 Gerando novo banco de dados mockado..."
echo ""

python3 create_mock_database.py

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro ao gerar o banco!"
    exit 1
fi

echo ""
echo "✅ Banco de dados criado com sucesso!"
echo ""
echo "Arquivos:"
echo "   - test.db (novo banco)"
if [ -n "$(ls -1 test.db.backup_* 2>/dev/null)" ]; then
    echo "   - test.db.backup_* (backups anteriores)"
fi
echo ""
