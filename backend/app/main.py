from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import viz

app = FastAPI(title="TCC Viz API")

# ========== CORS Configuration ==========
from app.config.settings import settings

_origins = settings.CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials="*" not in _origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(viz.router, prefix="/viz", tags=["Visualization"])

@app.get("/")
def root():
    return {"msg": "Backend rodando!"}
