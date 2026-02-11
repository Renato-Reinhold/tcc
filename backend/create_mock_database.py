"""
Script para criar banco de dados mockado com tabelas e relacionamentos
Compatível com CSV e PostgreSQL
"""

import os
import sys
import pandas as pd
from datetime import datetime, timedelta
import random
import string

def generate_mock_data():
    """Gera dados mockados em memória"""
    
    print("📊 Gerando dados mockados...")
    
    # Dados para Categorias
    categorias = [
        {'id': 1, 'nome': 'Eletrônicos', 'descricao': 'Produtos eletrônicos em geral'},
        {'id': 2, 'nome': 'Livros', 'descricao': 'Livros de diversos gêneros'},
        {'id': 3, 'nome': 'Roupas', 'descricao': 'Vestuário e acessórios'},
        {'id': 4, 'nome': 'Alimentos', 'descricao': 'Produtos alimentícios'},
        {'id': 5, 'nome': 'Móveis', 'descricao': 'Móveis e decoração'},
    ]
    
    # Dados para Clientes
    clientes = []
    for i in range(1, 9):
        clientes.append({
            'id': i,
            'nome': f'Cliente {i}',
            'email': f'cliente{i}@email.com',
            'telefone': f'(11) 9{random.randint(10000000, 99999999)}',
            'cidade': random.choice(['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Brasília']),
            'estado': random.choice(['SP', 'RJ', 'MG', 'DF']),
            'data_criacao': (datetime.now() - timedelta(days=random.randint(1, 365))).isoformat()
        })
    
    # Dados para Produtos
    produtos = [
        {'id': 1, 'nome': 'Notebook Dell', 'descricao': 'Notebook de alta performance', 'preco': 3500.00, 'estoque': 15, 'categoria_id': 1, 'data_criacao': datetime.now().isoformat()},
        {'id': 2, 'nome': 'Mouse Logitech', 'descricao': 'Mouse sem fio de precisão', 'preco': 150.00, 'estoque': 45, 'categoria_id': 1, 'data_criacao': datetime.now().isoformat()},
        {'id': 3, 'nome': 'Teclado Mecânico', 'descricao': 'Teclado mecânico RGB', 'preco': 450.00, 'estoque': 20, 'categoria_id': 1, 'data_criacao': datetime.now().isoformat()},
        {'id': 4, 'nome': 'Livro Python', 'descricao': 'Guia completo de Python', 'preco': 89.90, 'estoque': 30, 'categoria_id': 2, 'data_criacao': datetime.now().isoformat()},
        {'id': 5, 'nome': 'Livro JavaScript', 'descricao': 'Dominando JavaScript', 'preco': 79.90, 'estoque': 25, 'categoria_id': 2, 'data_criacao': datetime.now().isoformat()},
        {'id': 6, 'nome': 'Camiseta Básica', 'descricao': 'Camiseta 100% algodão', 'preco': 49.90, 'estoque': 100, 'categoria_id': 3, 'data_criacao': datetime.now().isoformat()},
        {'id': 7, 'nome': 'Calça Jeans', 'descricao': 'Calça jeans clássica', 'preco': 129.90, 'estoque': 50, 'categoria_id': 3, 'data_criacao': datetime.now().isoformat()},
    ]
    
    # Dados para Pedidos
    pedidos = []
    for i in range(1, 21):
        pedidos.append({
            'id': i,
            'cliente_id': random.randint(1, 8),
            'data_pedido': (datetime.now() - timedelta(days=random.randint(1, 180))).isoformat(),
            'total': round(random.uniform(100, 5000), 2),
            'status': random.choice(['pendente', 'processando', 'enviado', 'entregue', 'cancelado'])
        })
    
    # Dados para Itens do Pedido
    itens_pedido = []
    item_id = 1
    for pedido in pedidos:
        num_itens = random.randint(1, 4)
        for _ in range(num_itens):
            itens_pedido.append({
                'id': item_id,
                'pedido_id': pedido['id'],
                'produto_id': random.randint(1, 7),
                'quantidade': random.randint(1, 5),
                'preco_unitario': round(random.uniform(50, 500), 2)
            })
            item_id += 1
    
    return {
        'categorias': categorias,
        'clientes': clientes,
        'produtos': produtos,
        'pedidos': pedidos,
        'itens_pedido': itens_pedido
    }

def save_to_csv(data, output_dir='data'):
    """Salva dados mockados em arquivos CSV"""
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    print(f"💾 Salvando dados em CSV ({output_dir})...")
    
    for table_name, rows in data.items():
        if rows:
            df = pd.DataFrame(rows)
            filepath = os.path.join(output_dir, f'{table_name}.csv')
            df.to_csv(filepath, index=False, encoding='utf-8')
            print(f"   ✅ {table_name}.csv ({len(rows)} linhas)")
    
    print(f"📁 Arquivos CSV criados em: {output_dir}")

def create_postgres_database(data):
    """Cria banco de dados PostgreSQL com dados mockados"""
    
    try:
        import psycopg2
        from psycopg2 import sql
    except ImportError:
        print("⚠️  psycopg2 não está instalado. Pulando criação do PostgreSQL.")
        return False
    
    try:
        host = os.getenv('DB_HOST', 'localhost')
        port = os.getenv('DB_PORT', '5432')
        database = os.getenv('DB_NAME', 'tcc_db')
        user = os.getenv('DB_USER', 'postgres')
        password = os.getenv('DB_PASSWORD', 'postgres')
        
        print(f"🔗 Conectando ao PostgreSQL ({host}:{port}/{database})...")
        
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=database,
            user=user,
            password=password
        )
        cursor = conn.cursor()
        
        # Remover tabelas antigas
        print("🗑️  Removendo tabelas antigas...")
        cursor.execute("""
            DROP TABLE IF EXISTS itens_pedido CASCADE;
            DROP TABLE IF EXISTS pedidos CASCADE;
            DROP TABLE IF EXISTS produtos CASCADE;
            DROP TABLE IF EXISTS clientes CASCADE;
            DROP TABLE IF EXISTS categorias CASCADE;
        """)
        
        # Criar Categorias
        print("📋 Criando tabela: categorias")
        cursor.execute("""
            CREATE TABLE categorias (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(100) NOT NULL UNIQUE,
                descricao TEXT
            );
        """)
        
        # Criar Clientes
        print("📋 Criando tabela: clientes")
        cursor.execute("""
            CREATE TABLE clientes (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(150) NOT NULL,
                email VARCHAR(150) NOT NULL UNIQUE,
                telefone VARCHAR(20),
                cidade VARCHAR(100),
                estado VARCHAR(2),
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Criar Produtos
        print("📋 Criando tabela: produtos")
        cursor.execute("""
            CREATE TABLE produtos (
                id SERIAL PRIMARY KEY,
                nome VARCHAR(200) NOT NULL,
                descricao TEXT,
                preco NUMERIC(10, 2) NOT NULL,
                estoque INTEGER DEFAULT 0,
                categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
                data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Criar Pedidos
        print("📋 Criando tabela: pedidos")
        cursor.execute("""
            CREATE TABLE pedidos (
                id SERIAL PRIMARY KEY,
                cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
                data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                total NUMERIC(10, 2) DEFAULT 0,
                status VARCHAR(50) DEFAULT 'pendente'
            );
        """)
        
        # Criar Itens Pedido
        print("📋 Criando tabela: itens_pedido")
        cursor.execute("""
            CREATE TABLE itens_pedido (
                id SERIAL PRIMARY KEY,
                pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
                produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
                quantidade INTEGER NOT NULL,
                preco_unitario NUMERIC(10, 2) NOT NULL
            );
        """)
        
        # Inserir dados
        print("📝 Inserindo dados...")
        
        for categoria in data['categorias']:
            cursor.execute(
                "INSERT INTO categorias (id, nome, descricao) VALUES (%s, %s, %s)",
                (categoria['id'], categoria['nome'], categoria['descricao'])
            )
        
        for cliente in data['clientes']:
            cursor.execute(
                "INSERT INTO clientes (id, nome, email, telefone, cidade, estado, data_criacao) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (cliente['id'], cliente['nome'], cliente['email'], cliente['telefone'], cliente['cidade'], cliente['estado'], cliente['data_criacao'])
            )
        
        for produto in data['produtos']:
            cursor.execute(
                "INSERT INTO produtos (id, nome, descricao, preco, estoque, categoria_id, data_criacao) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                (produto['id'], produto['nome'], produto['descricao'], produto['preco'], produto['estoque'], produto['categoria_id'], produto['data_criacao'])
            )
        
        for pedido in data['pedidos']:
            cursor.execute(
                "INSERT INTO pedidos (id, cliente_id, data_pedido, total, status) VALUES (%s, %s, %s, %s, %s)",
                (pedido['id'], pedido['cliente_id'], pedido['data_pedido'], pedido['total'], pedido['status'])
            )
        
        for item in data['itens_pedido']:
            cursor.execute(
                "INSERT INTO itens_pedido (id, pedido_id, produto_id, quantidade, preco_unitario) VALUES (%s, %s, %s, %s, %s)",
                (item['id'], item['pedido_id'], item['produto_id'], item['quantidade'], item['preco_unitario'])
            )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Banco de dados PostgreSQL criado com sucesso!")
        return True
        
    except Exception as e:
        print(f"❌ Erro ao criar banco PostgreSQL: {e}")
        return False

def main():
    """Função principal"""
    print("=" * 60)
    print("🗄️  Criador de Banco de Dados Mockado")
    print("=" * 60)
    
    # Gerar dados
    data = generate_mock_data()
    
    # Salvar em CSV
    save_to_csv(data)
    
    # Tentar criar PostgreSQL
    create_postgres_database(data)
    
    print("\n" + "=" * 60)
    print("✅ Processo concluído!")
    print("=" * 60)

if __name__ == '__main__':
    main()
