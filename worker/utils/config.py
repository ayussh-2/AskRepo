from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost/dbname"
    ollama_base_url: str = "http://localhost:11434"
    embedding_model: str = "embeddinggemma"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
