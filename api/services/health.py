import time
from datetime import datetime, timezone
from sqlmodel import Session, text
from db.db import engine
from lib.redis import redis_client
from config import settings
from google import genai
from services.llm import get_active_providers
import httpx

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

def check_postgres() -> dict:
    start = time.perf_counter()
    try:
        with Session(engine) as session:
            session.exec(text("SELECT 1"))
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {"status": "healthy", "latency_ms": latency_ms}
    except Exception as e:
        print(f"[Health] Postgres check failed: {e}")
        return {"status": "unhealthy", "error": "Connection failed"}

def check_redis() -> dict:
    start = time.perf_counter()
    try:
        if redis_client and redis_client.ping():
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {"status": "healthy", "latency_ms": latency_ms}
        return {"status": "unhealthy", "error": "Redis ping returned False"}
    except Exception as e:
        print(f"[Health] Redis check failed: {e}")
        return {"status": "unhealthy", "error": "Connection failed"}

def check_llm_providers() -> dict:
    active_providers = get_active_providers()
    provider_status = {}

    PROVIDER_CONFIGS = {
        "gemini": {
            "check": "gemini",
        },
        "groq": {
            "base_url": "https://api.groq.com/openai/v1",
            "key": settings.groq_api_key,
        },
        "mistral": {
            "base_url": "https://api.mistral.ai/v1",
            "key": settings.mistral_api_key,
        },
    }

    for provider in ["gemini", "groq"]:
        key = getattr(settings, f"{provider}_api_key", "")
        model = getattr(settings, f"{provider}_llm_model", "")
        if not key:
            provider_status[provider] = {"configured": False, "status": "not_configured"}
            continue

        start = time.perf_counter()
        try:
            if provider == "gemini":
                gemini_client = genai.Client(api_key=settings.gemini_api_key)
                model_info = gemini_client.models.get(model=model)
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                provider_status[provider] = {
                    "configured": True,
                    "status": "healthy",
                    "latency_ms": latency_ms,
                }
            else:
                # Actually ping the /models endpoint to verify connectivity
                cfg = PROVIDER_CONFIGS[provider]
                with httpx.Client(timeout=10.0) as http_client:
                    resp = http_client.get(
                        f"{cfg['base_url']}/models",
                        headers={"Authorization": f"Bearer {cfg['key']}"}
                    )
                    resp.raise_for_status()
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                provider_status[provider] = {
                    "configured": True,
                    "status": "healthy",
                    "latency_ms": latency_ms,
                }
        except Exception as e:
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            print(f"[Health] LLM provider '{provider}' check failed: {e}")
            provider_status[provider] = {
                "configured": True,
                "status": "unhealthy",
                "latency_ms": latency_ms,
                "error": "Connection failed",
            }

    return {
        "active_order": active_providers,
        "providers": provider_status
    }

def get_health_status() -> dict:
    pg_health = check_postgres()
    redis_health = check_redis()
    llm_health = check_llm_providers()

    services = {
        "postgres": pg_health,
        "redis": redis_health,
        "llm": llm_health
    }

    all_healthy = pg_health.get("status") == "healthy" and redis_health.get("status") == "healthy" and len(llm_health.get("active_order", [])) > 0
    overall_status = "healthy" if all_healthy else "degraded"


    if HAS_PSUTIL:
        mem = psutil.virtual_memory()
        system_metrics = {
            "cpu_percent": psutil.cpu_percent(interval=None),
            "memory": {
                "percent_used": mem.percent,
                "used_mb": round(mem.used / (1024 * 1024), 2),
                "total_mb": round(mem.total / (1024 * 1024), 2)
            }
        }
    else:
        system_metrics = {
            "cpu_percent": "N/A (psutil not installed)",
            "memory": "N/A (psutil not installed)"
        }

    return {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system": system_metrics,
        "services": services
    }
