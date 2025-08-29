from fastapi import APIRouter

router = APIRouter()

@router.get("/recommend")
def recommend_chart():
    return {"chart": "Column", "reason": "coluna numérica única"}
