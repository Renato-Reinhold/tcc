from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import viz

app = FastAPI(title="TCC Viz API")

# ========== CORS Configuration ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (can be restricted in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(viz.router, prefix="/viz", tags=["Visualization"])

@app.get("/")
def root():
    return {"msg": "Backend rodando!"}
