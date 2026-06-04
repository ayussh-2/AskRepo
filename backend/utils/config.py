from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    database_url: str = "postgresql://user:password@localhost/dbname"

    environment: str = "development"
    embedding_batch_size: int = 100


    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()