from fastapi import FastAPI
from app.routes import viz

app = FastAPI(title="TCC Viz API")

app.include_router(viz.router, prefix="/viz", tags=["Visualization"])

@app.get("/")
def root():
    return {"msg": "Backend rodando!"}
