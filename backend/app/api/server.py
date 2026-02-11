from fastapi import FastAPI
from app.data.sql_generator import generate_sql
from app.data.loader import DataLoader
from app.services.recommender import recommend_chart

app = FastAPI()
loader = DataLoader()

@app.post("/recommend")
def recommend(payload: dict):
    sql = generate_sql(
        payload["tables"],
        payload["columns"],
        payload["relationships"]
    )

    df = loader.execute_sql(sql)

    metadata = payload["metadata"]
    chart = recommend_chart(metadata, {})

    return {
        "sql": sql,
        "chart": chart,
        "columns": list(df.columns)
    }
