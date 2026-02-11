import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Database Configuration
    DB_HOST = os.getenv("DB_HOST", "backend-db")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME", "tcc_db")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    
    # Build DB_URL from components
    DB_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    
    MODEL_DIR = os.getenv("MODEL_DIR", "data/model/")
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")


settings = Settings()
