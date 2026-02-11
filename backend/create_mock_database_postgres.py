"""
Script para criar banco de dados PostgreSQL mockado com dados para testes
Execução: python create_mock_database_postgres.py
"""

import os
from datetime import datetime, timedelta
import random
from sqlalchemy import create_engine, text
import pandas as pd

# Configuração do banco
DB_HOST = os.getenv("DB_HOST", "backend-db")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "tcc_db")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")

DB_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

def create_mock_database():
    """Cria banco de dados PostgreSQL mockado com tabelas e dados"""
    
    try:
        # Conectar ao banco
        engine = create_engine(DB_URL)
        
        print("\n📊 Criando banco de dados mockado no PostgreSQL...")
        
        with engine.connect() as conn:
            # Verificar se tabelas já existem
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'vendas'
                )
            """))
            
            if result.scalar():
                print("✅ Tabelas já existem no banco de dados")
                return
            
            # ========== TABELA 1: VENDAS ==========
            print("\n1️⃣  Criando tabela: vendas")
            conn.execute(text('''
            CREATE TABLE vendas (
                id SERIAL PRIMARY KEY,
                data DATE,
                produto_id INTEGER,
                quantidade INTEGER,
                preco_unitario REAL,
                valor_total REAL,
                regiao TEXT,
                vendedor_id INTEGER
            )
            '''))
            
            # ========== TABELA 2: PRODUTOS ==========
            print("2️⃣  Criando tabela: produtos")
            conn.execute(text('''
            CREATE TABLE produtos (
                id SERIAL PRIMARY KEY,
                nome TEXT,
                categoria TEXT,
                preco_venda REAL,
                estoque INTEGER,
                data_criacao DATE
            )
            '''))
            
            # ========== TABELA 3: CLIENTES ==========
            print("3️⃣  Criando tabela: clientes")
            conn.execute(text('''
            CREATE TABLE clientes (
                id SERIAL PRIMARY KEY,
                nome TEXT,
                email TEXT,
                telefone TEXT,
                cidade TEXT,
                estado TEXT,
                data_cadastro DATE
            )
            '''))
            
            # ========== TABELA 4: VENDEDORES ==========
            print("4️⃣  Criando tabela: vendedores")
            conn.execute(text('''
            CREATE TABLE vendedores (
                id SERIAL PRIMARY KEY,
                nome TEXT,
                email TEXT,
                regiao TEXT,
                comissao REAL,
                data_admissao DATE
            )
            '''))
            
            conn.commit()
            print("\n✅ Tabelas criadas com sucesso!")
            
        # Inserir dados com pandas
        print("\n📝 Inserindo dados mockados...")
        
        # Dados de Vendas
        base_date = datetime.now() - timedelta(days=365)
        produtos_lista = ['Notebook', 'Mouse', 'Teclado', 'Monitor', 'Fone', 'Webcam', 'SSD', 'RAM']
        precos = {'Notebook': 3500, 'Mouse': 50, 'Teclado': 150, 'Monitor': 800, 
                  'Fone': 200, 'Webcam': 250, 'SSD': 400, 'RAM': 250}
        regioes = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']
        
        vendas_data = []
        for i in range(500):
            data = base_date + timedelta(days=random.randint(0, 365))
            produto = random.choice(produtos_lista)
            quantidade = random.randint(1, 20)
            preco = precos[produto]
            valor_total = quantidade * preco
            regiao = random.choice(regioes)
            vendedor_id = random.randint(1, 10)
            
            vendas_data.append({
                'data': data.date(),
                'produto_id': list(range(1, 9)).index(produtos_lista.index(produto)) + 1 if produto in produtos_lista else 1,
                'quantidade': quantidade,
                'preco_unitario': preco,
                'valor_total': valor_total,
                'regiao': regiao,
                'vendedor_id': vendedor_id
            })
        
        df_vendas = pd.DataFrame(vendas_data)
        df_vendas.to_sql('vendas', engine, if_exists='append', index=False)
        print(f"   ✓ {len(vendas_data)} registros de vendas inseridos")
        
        # Dados de Produtos
        produtos_data = [
            {'nome': 'Notebook Dell', 'categoria': 'Computadores', 'preco_venda': 3500, 'estoque': 45, 'data_criacao': '2024-01-15'},
            {'nome': 'Notebook Lenovo', 'categoria': 'Computadores', 'preco_venda': 3200, 'estoque': 60, 'data_criacao': '2024-01-15'},
            {'nome': 'Mouse Logitech', 'categoria': 'Periféricos', 'preco_venda': 50, 'estoque': 200, 'data_criacao': '2024-02-01'},
            {'nome': 'Mouse Razer', 'categoria': 'Periféricos', 'preco_venda': 120, 'estoque': 80, 'data_criacao': '2024-02-01'},
            {'nome': 'Teclado Mecânico', 'categoria': 'Periféricos', 'preco_venda': 150, 'estoque': 120, 'data_criacao': '2024-02-15'},
            {'nome': 'Monitor LG 27"', 'categoria': 'Periféricos', 'preco_venda': 800, 'estoque': 25, 'data_criacao': '2024-03-01'},
            {'nome': 'Fone Bluetooth', 'categoria': 'Áudio', 'preco_venda': 200, 'estoque': 150, 'data_criacao': '2024-03-10'},
            {'nome': 'SSD 1TB', 'categoria': 'Armazenamento', 'preco_venda': 400, 'estoque': 80, 'data_criacao': '2024-03-15'},
        ]
        
        df_produtos = pd.DataFrame(produtos_data)
        df_produtos.to_sql('produtos', engine, if_exists='append', index=False)
        print(f"   ✓ {len(produtos_data)} registros de produtos inseridos")
        
        # Dados de Clientes
        clientes_data = []
        nomes = ['João Silva', 'Maria Santos', 'Carlos Oliveira', 'Ana Costa', 'Pedro Alves']
        cidades = ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Salvador', 'Brasília']
        estados = ['SP', 'RJ', 'MG', 'BA', 'DF']
        
        for i in range(100):
            clientes_data.append({
                'nome': f"{random.choice(nomes)} {i}",
                'email': f"cliente{i}@email.com",
                'telefone': f"11 9{random.randint(10000000, 99999999)}",
                'cidade': random.choice(cidades),
                'estado': random.choice(estados),
                'data_cadastro': (base_date + timedelta(days=random.randint(0, 365))).date()
            })
        
        df_clientes = pd.DataFrame(clientes_data)
        df_clientes.to_sql('clientes', engine, if_exists='append', index=False)
        print(f"   ✓ {len(clientes_data)} registros de clientes inseridos")
        
        # Dados de Vendedores
        vendedores_data = [
            {'nome': 'Vendedor A', 'email': 'vendedor.a@company.com', 'regiao': 'Norte', 'comissao': 0.05, 'data_admissao': '2023-01-10'},
            {'nome': 'Vendedor B', 'email': 'vendedor.b@company.com', 'regiao': 'Nordeste', 'comissao': 0.05, 'data_admissao': '2023-02-15'},
            {'nome': 'Vendedor C', 'email': 'vendedor.c@company.com', 'regiao': 'Centro-Oeste', 'comissao': 0.05, 'data_admissao': '2023-03-20'},
            {'nome': 'Vendedor D', 'email': 'vendedor.d@company.com', 'regiao': 'Sudeste', 'comissao': 0.05, 'data_admissao': '2023-04-05'},
            {'nome': 'Vendedor E', 'email': 'vendedor.e@company.com', 'regiao': 'Sul', 'comissao': 0.05, 'data_admissao': '2023-05-12'},
            {'nome': 'Vendedor F', 'email': 'vendedor.f@company.com', 'regiao': 'Norte', 'comissao': 0.06, 'data_admissao': '2023-06-18'},
            {'nome': 'Vendedor G', 'email': 'vendedor.g@company.com', 'regiao': 'Sudeste', 'comissao': 0.06, 'data_admissao': '2023-07-22'},
            {'nome': 'Vendedor H', 'email': 'vendedor.h@company.com', 'regiao': 'Sul', 'comissao': 0.05, 'data_admissao': '2023-08-30'},
            {'nome': 'Vendedor I', 'email': 'vendedor.i@company.com', 'regiao': 'Nordeste', 'comissao': 0.05, 'data_admissao': '2023-09-14'},
            {'nome': 'Vendedor J', 'email': 'vendedor.j@company.com', 'regiao': 'Centro-Oeste', 'comissao': 0.06, 'data_admissao': '2023-10-25'},
        ]
        
        df_vendedores = pd.DataFrame(vendedores_data)
        df_vendedores.to_sql('vendedores', engine, if_exists='append', index=False)
        print(f"   ✓ {len(vendedores_data)} registros de vendedores inseridos")
        
        print("\n✅ Banco de dados criado com sucesso!")
        
    except Exception as e:
        print(f"\n❌ Erro ao criar banco de dados: {str(e)}")
        raise

if __name__ == "__main__":
    create_mock_database()
