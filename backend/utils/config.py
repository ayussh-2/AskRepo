from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    database_url: str = "postgresql://user:password@localhost/dbname"
    gemini_llm_model:str="gemini-3.5-flash"

    environment: str = "development"
    embedding_model:str= "nomic-embed-text"
    ollama_base_url:str="http://localhost:11434"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()