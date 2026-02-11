"""
Script para criar dados mockados no PostgreSQL
Cria tabelas com relacionamentos e insere dados de exemplo
"""

import psycopg2
from psycopg2 import sql
import os
from datetime import datetime, timedelta
import random

def get_connection():
    """Conecta ao banco de dados PostgreSQL"""
    host = os.getenv('DB_HOST', 'localhost')
    port = os.getenv('DB_PORT', '5432')
    database = os.getenv('DB_NAME', 'tcc_db')
    user = os.getenv('DB_USER', 'postgres')
    password = os.getenv('DB_PASSWORD', 'postgres')
    
    return psycopg2.connect(
        host=host,
        port=port,
        database=database,
        user=user,
        password=password
    )

def create_tables(cursor):
    """Cria as tabelas com relacionamentos"""
    
    # Tabela de Clientes
    cursor.execute("""
        DROP TABLE IF EXISTS pedidos CASCADE;
        DROP TABLE IF EXISTS itens_pedido CASCADE;
        DROP TABLE IF EXISTS produtos CASCADE;
        DROP TABLE IF EXISTS categorias CASCADE;
        DROP TABLE IF EXISTS clientes CASCADE;
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(100) NOT NULL UNIQUE,
            descricao TEXT
        );
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS clientes (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(150) NOT NULL,
            email VARCHAR(150) NOT NULL UNIQUE,
            telefone VARCHAR(20),
            cidade VARCHAR(100),
            estado VARCHAR(2),
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS produtos (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(200) NOT NULL,
            descricao TEXT,
            preco DECIMAL(10, 2) NOT NULL,
            estoque INTEGER DEFAULT 0,
            categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
            data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id SERIAL PRIMARY KEY,
            cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
            data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total DECIMAL(10, 2) DEFAULT 0,
            status VARCHAR(50) DEFAULT 'pendente'
        );
    """)
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS itens_pedido (
            id SERIAL PRIMARY KEY,
            pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
            produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
            quantidade INTEGER NOT NULL,
            preco_unitario DECIMAL(10, 2) NOT NULL
        );
    """)

def insert_mock_data(cursor, conn):
    """Insere dados mockados nas tabelas"""
    
    # Dados mockados para categorias
    categorias = [
        ('Eletrônicos', 'Produtos eletrônicos em geral'),
        ('Livros', 'Livros de diversos gêneros'),
        ('Roupas', 'Vestuário e acessórios'),
        ('Alimentos', 'Produtos alimentícios'),
        ('Casa', 'Artigos para o lar'),
    ]
    
    for nome, descricao in categorias:
        cursor.execute(
            "INSERT INTO categorias (nome, descricao) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
            (nome, descricao)
        )
    
    # Dados mockados para clientes
    clientes_nomes = [
        ('João Silva', 'joao@email.com', '11999999999', 'São Paulo', 'SP'),
        ('Maria Santos', 'maria@email.com', '21988888888', 'Rio de Janeiro', 'RJ'),
        ('Pedro Oliveira', 'pedro@email.com', '31977777777', 'Belo Horizonte', 'MG'),
        ('Ana Costa', 'ana@email.com', '85966666666', 'Fortaleza', 'CE'),
        ('Carlos Souza', 'carlos@email.com', '48955555555', 'Florianópolis', 'SC'),
        ('Lucia Ferreira', 'lucia@email.com', '61944444444', 'Brasília', 'DF'),
        ('Bruno Rocha', 'bruno@email.com', '71933333333', 'Salvador', 'BA'),
        ('Fernanda Lima', 'fernanda@email.com', '92922222222', 'Manaus', 'AM'),
    ]
    
    cliente_ids = []
    for nome, email, telefone, cidade, estado in clientes_nomes:
        cursor.execute(
            """INSERT INTO clientes (nome, email, telefone, cidade, estado) 
               VALUES (%s, %s, %s, %s, %s) RETURNING id;""",
            (nome, email, telefone, cidade, estado)
        )
        cliente_ids.append(cursor.fetchone()[0])
    
    # Dados mockados para produtos
    produtos = [
        ('Notebook Dell', 'Notebook 15 polegadas', 3500.00, 'Eletrônicos'),
        ('Mouse Logitech', 'Mouse sem fio', 89.90, 'Eletrônicos'),
        ('Teclado Mecânico', 'Teclado RGB', 450.00, 'Eletrônicos'),
        ('Monitor LG 27"', 'Monitor Full HD', 1200.00, 'Eletrônicos'),
        ('Clean Code', 'Livro de programação', 120.00, 'Livros'),
        ('Design Patterns', 'Padrões de design', 95.00, 'Livros'),
        ('Camiseta Básica', 'Camiseta 100% algodão', 49.90, 'Roupas'),
        ('Calça Jeans', 'Calça azul marinho', 129.90, 'Roupas'),
        ('Café Premium', 'Café 500g', 35.00, 'Alimentos'),
        ('Chocolates Belgas', 'Caixa 12 unidades', 85.00, 'Alimentos'),
        ('Luminária LED', 'Luminária de mesa', 199.90, 'Casa'),
        ('Almofada Decorativa', 'Almofada 40x40cm', 59.90, 'Casa'),
    ]
    
    produto_ids = []
    for nome, descricao, preco, categoria_nome in produtos:
        cursor.execute("SELECT id FROM categorias WHERE nome = %s;", (categoria_nome,))
        categoria_id = cursor.fetchone()[0]
        cursor.execute(
            """INSERT INTO produtos (nome, descricao, preco, estoque, categoria_id) 
               VALUES (%s, %s, %s, %s, %s) RETURNING id;""",
            (nome, descricao, preco, random.randint(5, 100), categoria_id)
        )
        produto_ids.append(cursor.fetchone()[0])
    
    # Criar pedidos
    statuses = ['pendente', 'processando', 'enviado', 'entregue', 'cancelado']
    
    for i in range(20):
        cliente_id = random.choice(cliente_ids)
        data_pedido = datetime.now() - timedelta(days=random.randint(0, 90))
        status = random.choice(statuses)
        
        cursor.execute(
            """INSERT INTO pedidos (cliente_id, data_pedido, status) 
               VALUES (%s, %s, %s) RETURNING id;""",
            (cliente_id, data_pedido, status)
        )
        pedido_id = cursor.fetchone()[0]
        
        # Adicionar itens ao pedido
        num_itens = random.randint(1, 5)
        total = 0
        
        for _ in range(num_itens):
            produto_id = random.choice(produto_ids)
            quantidade = random.randint(1, 3)
            
            cursor.execute(
                "SELECT preco FROM produtos WHERE id = %s;",
                (produto_id,)
            )
            preco_unitario = cursor.fetchone()[0]
            
            cursor.execute(
                """INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) 
                   VALUES (%s, %s, %s, %s);""",
                (pedido_id, produto_id, quantidade, preco_unitario)
            )
            
            total += quantidade * preco_unitario
        
        # Atualizar total do pedido
        cursor.execute(
            "UPDATE pedidos SET total = %s WHERE id = %s;",
            (total, pedido_id)
        )
    
    conn.commit()
    print("✅ Dados mockados inseridos com sucesso!")

def main():
    """Função principal"""
    try:
        print("🗄️  Conectando ao PostgreSQL...")
        conn = get_connection()
        cursor = conn.cursor()
        
        print("📊 Criando tabelas...")
        create_tables(cursor)
        conn.commit()
        
        print("📝 Inserindo dados mockados...")
        insert_mock_data(cursor, conn)
        
        cursor.close()
        conn.close()
        print("✅ Dados mockados carregados com sucesso!")
        
    except Exception as e:
        print(f"❌ Erro ao carregar dados mockados: {e}")
        raise

if __name__ == '__main__':
    main()
