import os
from pydantic_settings import BaseSettings, SettingsConfigDict

current_dir = os.path.dirname(os.path.abspath(__file__))
env_file_path = os.path.abspath(os.path.join(current_dir, ".env"))

class Settings(BaseSettings):
    gemini_api_key: str = ""
    gemini_llm_model: str = "gemini-3.1-flash-lite"

    groq_api_key: str = ""
    groq_llm_model: str = "llama-3.3-70b-versatile"

    openrouter_api_key: str = ""
    openrouter_llm_model: str = "meta-llama/llama-3.3-70b-instruct:free"

    cerebras_api_key: str = ""
    cerebras_llm_model: str = "llama-3.3-70b"

    mistral_api_key: str = ""
    mistral_llm_model: str = "mistral-small-latest"

    # Fallback order of providers (comma separated)
    llm_provider_order: str = "gemini,groq,mistral"


    database_url: str = "postgresql://user:password@localhost/dbname"
    redis_url: str = "redis://localhost:6379/0"
    session_ttl: int = 86400
    embedding_provider: str = "local" # "local" (Ollama CPU) or "modal" (Modal Serverless GPU)
    ollama_base_url: str = "http://localhost:11434"
    modal_embed_url: str = "https://your-workspace--askrepo-embed-embed.modal.run"
    modal_embed_token: str = ""
    embedding_model: str = "embeddinggemma"
    env: str = "production"


    # GitLab Trigger settings
    gitlab_project_id: str = ""
    gitlab_trigger_token: str = ""

    model_config = SettingsConfigDict(env_file=env_file_path, env_file_encoding="utf-8", extra="ignore")

settings = Settings()

