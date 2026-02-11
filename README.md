# TCC - Sistema de Recomendação de Visualizações

## 📋 Documentação

### 🚀 Comece por Aqui
- **[SUMARIO_EXECUTIVO.md](SUMARIO_EXECUTIVO.md)** - Visão geral da implementação ⭐
- **[DEV_GUIDE.md](DEV_GUIDE.md)** - Guia de desenvolvimento com Docker 🛠️

### 🐳 Docker
- **[DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md)** - Guia completo de uso do Docker
- **[DOCKER_SUMMARY.md](DOCKER_SUMMARY.md)** - Resumo das configurações Docker

### 📊 Fluxo Frontend ↔ Backend
- **[FLUXO_VISAO_GERAL.md](FLUXO_VISAO_GERAL.md)** - Arquitetura completa
- **[FLUXO_IMPLEMENTADO.md](FLUXO_IMPLEMENTADO.md)** - Documentação técnica detalhada
- **[DIAGRAMA_ASCII.md](DIAGRAMA_ASCII.md)** - Diagrama visual do fluxo
- **[IMPLEMENTACAO_RESUMO.md](IMPLEMENTACAO_RESUMO.md)** - Sumário das mudanças

### 🧪 Testes
- **[GUIA_TESTE.md](GUIA_TESTE.md)** - Instruções de teste manual

---

## 🛠️ Desenvolvimento Rápido (HOT RELOAD)

```bash
# Clone/Navegue para o projeto
cd d:\Projetos\tcc

# Windows (PowerShell)
.\dev-up.ps1

# Linux/Mac (Bash)
chmod +x dev-up.sh && ./dev-up.sh
```

✨ **Mudanças no código refletem instantaneamente!**

**Acesso em Desenvolvimento:**
- Frontend: `http://localhost:5173` (com HMR)
- Backend: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

Para parar: `.\dev-down.ps1` (Windows) ou `./dev-down.sh` (Linux/Mac)

---

## ⚡ Produção (Sem Hot Reload)

```bash
# Windows (PowerShell)
.\start-docker.ps1

# Linux/Mac (Bash)
./start-docker.sh

# Ou manualmente
docker-compose up -d
```

**Acesso em Produção:**
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

---

## ⚡ Início Rápido Local

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## ✅ Status

- [x] Fluxo Frontend ↔ Backend implementado
- [x] Endpoints FastAPI criados
- [x] Componentes React expandidos
- [x] Tipos TypeScript finalizados
- [x] Documentação completa
- [x] Docker Compose configurado
- [x] Scripts de inicialização
- [x] Pronto para teste

---

## 📁 Estrutura do Projeto

```
.
├── backend/              # API FastAPI
│   ├── app/
│   │   ├── routes/
│   │   │   └── viz.py   ⭐ (4 endpoints implementados)
│   │   ├── data/        ⭐ (metadata, loader expandidos)
│   │   └── main.py
│   ├── Dockerfile       ⭐ (Melhorado)
│   └── requirements.txt
│
├── frontend/             # React + TypeScript
│   ├── src/
│   │   ├── types/
│   │   │   └── query.ts ✨ (Tipos QueryModel)
│   │   ├── services/
│   │   │   └── queryService.ts ⭐ (API Client)
│   │   └── components/
│   │       ├── TableDetail.tsx ⭐ (Expandido)
│   │       └── ChartRecommendationComponent.tsx ✨ (Novo)
│   ├── Dockerfile       ⭐ (Multi-stage)
│   └── package.json
│
├── docker-compose.yml   ✨ (Novo - Completo)
├── .env.docker          ✨ (Novo)
├── nginx.conf           ✨ (Novo - Proxy reverso)
├── start-docker.sh      ✨ (Novo - Script bash)
├── start-docker.ps1     ✨ (Novo - Script PowerShell)
│
└── Documentação/
    ├── SUMARIO_EXECUTIVO.md
    ├── DOCKER_COMPOSE_GUIDE.md ✨
    ├── DOCKER_SUMMARY.md ✨
    ├── FLUXO_VISAO_GERAL.md
    ├── FLUXO_IMPLEMENTADO.md
    ├── IMPLEMENTACAO_RESUMO.md
    ├── DIAGRAMA_ASCII.md
    ├── GUIA_TESTE.md
    ├── CHECKLIST_FINAL.md
    └── LISTA_ARQUIVOS.md
```

---

## 🎯 Fluxo Implementado

```
1. Usuário seleciona campos + agregações no TableDetail
2. Frontend cria QueryModel e envia POST /viz/execute
3. Backend processa com SQL Generator ou Pandas
4. Backend extrai metadados e recomenda gráfico
5. Frontend exibe ChartRecommendationComponent
6. Usuário aceita e gera gráfico
```

---

## 🐳 Docker Compose Estrutura

```yaml
Serviços:
├── backend          → FastAPI (Python)      | Port 8000
├── frontend         → Node.js (Vite)        | Port 5173
├── backend-db       → SQLite Volume         | -
└── nginx (opcional) → Proxy Reverso         | Port 80
```

---

## 📞 Próximos Passos

1. Executar Docker Compose: `docker-compose up -d`
2. Abrir `http://localhost:5173`
3. Teste a aplicação completa
4. Ver [DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md) para mais detalhes

---

Para documentação detalhada, veja:
- **[SUMARIO_EXECUTIVO.md](SUMARIO_EXECUTIVO.md)** - Visão geral
- **[DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md)** - Docker
- **[FLUXO_IMPLEMENTADO.md](FLUXO_IMPLEMENTADO.md)** - Fluxo técnico

 
