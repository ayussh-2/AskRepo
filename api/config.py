from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    database_url: str = "postgresql://user:password@localhost/dbname"
    redis_url: str = "redis://localhost:6379/0"
    session_ttl: int = 86400
    gemini_llm_model: str = "gemini-3.1-flash-lite"
    modal_embed_url: str = "https://your-workspace--askrepo-embed-embed.modal.run"
    modal_embed_token: str = ""
    embedding_model: str = "embeddinggemma"

    # GitLab Trigger settings
    gitlab_project_id: str = ""
    gitlab_trigger_token: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

settings = Settings()
