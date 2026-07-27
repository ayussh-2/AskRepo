import os
from pydantic_settings import BaseSettings, SettingsConfigDict

current_dir = os.path.dirname(os.path.abspath(__file__))
env_file_path = os.path.abspath(os.path.join(current_dir, "..", ".env"))

class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost/dbname"
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "embeddinggemma"

    model_config = SettingsConfigDict(env_file=env_file_path, env_file_encoding="utf-8", extra="ignore")

settings = Settings()
