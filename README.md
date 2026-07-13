# TCC - Sistema de Recomendação de Visualizações

## Documentação

---

## Desenvolvimento Rápido

```bash
# Clone/Navegue para o projeto
cd d:\Projetos\tcc

# Windows (PowerShell)
.\dev-up.ps1

# Linux/Mac (Bash)
chmod +x dev-up.sh && ./dev-up.sh
```

**Mudanças no código refletem instantaneamente!**

**Acesso em Desenvolvimento:**
- Frontend: `http://localhost:5173` (com HMR)
- Backend: `http://localhost:8000`
- API Docs: `http://localhost:8000/docs`

Para parar: `.\dev-down.ps1` (Windows) ou `./dev-down.sh` (Linux/Mac)

---

## Produção

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

## Início Rápido Local

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
---

## 🐳 Docker Compose Estrutura

```yaml
Serviços:
├── backend          → FastAPI (Python)      | Port 8000
├── frontend         → Node.js (Vite)        | Port 5173
└── nginx (opcional) → Proxy Reverso         | Port 80
```

---

## 📞 Próximos Passos

1. Executar Docker compose: `docker-compose build`
2. Executar Docker Compose: `docker-compose up -d`
3. Abrir `http://localhost:5173`