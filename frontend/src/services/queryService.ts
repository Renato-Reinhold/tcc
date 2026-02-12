import type { QueryModel, ExecutionResponse } from '@/types/query';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export const queryService = {
  /**
   * Executa uma query (gera SQL/Pandas, executa e recomenda gráfico)
   * Fluxo: QueryModel → SQL/Pandas Generator → DataFrame → Recomendação
   */
  async executeQuery(query: QueryModel): Promise<ExecutionResponse> {
    const response = await fetch(`${API_BASE_URL}/viz/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`Erro ao executar query: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Recomenda um gráfico baseado nos dados e metadados da query
   */
  async recommendChart(queryResult: ExecutionResponse) {
    const response = await fetch(`${API_BASE_URL}/viz/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: queryResult.result.data,
        columns: queryResult.result.columns,
        query_model: queryResult.query_model,
      }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao recomendar gráfico: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Valida a query antes de executá-la
   */
  async validateQuery(query: QueryModel): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await fetch(`${API_BASE_URL}/viz/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });

    if (!response.ok) {
      throw new Error(`Erro ao validar query: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Obtém metadados sobre as tabelas disponíveis
   */
  async getTableMetadata(): Promise<{ tables: Array<{ name: string; columns: Array<{ name: string; type: string }> }> }> {
    const response = await fetch(`${API_BASE_URL}/viz/tables`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Erro ao obter metadados: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * Busca os dados reais de uma tabela específica
   */
  async getTableData(tableName: string): Promise<{ data: any[]; columns: string[]; total_count: number; limit: number; offset: number }> {
    try {
      // Tentar primeiro o endpoint de conexão dinâmica
      const response = await fetch(`${API_BASE_URL}/viz/databases/table/${tableName}/data`, {
        method: 'GET',
      });

      if (response.ok) {
        return response.json();
      }

      // Se falhar, tentar o endpoint do banco padrão
      const fallbackResponse = await fetch(`${API_BASE_URL}/viz/tables/${tableName}/data`, {
        method: 'GET',
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Erro ao obter dados da tabela: ${fallbackResponse.statusText}`);
      }

      return fallbackResponse.json();
    } catch (error) {
      console.error("Erro ao buscar dados da tabela:", error);
      throw new Error(`Erro ao obter dados da tabela: ${error}`);
    }
  },
};
