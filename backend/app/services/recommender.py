def recommend_chart(metadata):
    # Exemplo simples: baseia-se no tipo das colunas
    if metadata["x_type"] == "numeric" and metadata["y_type"] == "numeric":
        return "scatter"

    if metadata["x_type"] == "categorical" and metadata["y_type"] == "numeric":
        return "bar"

    return "line"
