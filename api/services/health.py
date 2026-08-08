import time
from datetime import datetime, timezone
from sqlmodel import Session, text
from db.db import engine
from lib.redis import redis_client
from config import settings
from google import genai
from services.llm import get_active_providers

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
        return {"status": "unhealthy", "error": str(e)}

def check_redis() -> dict:
    start = time.perf_counter()
    try:
        if redis_client and redis_client.ping():
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {"status": "healthy", "latency_ms": latency_ms}
        return {"status": "unhealthy", "error": "Redis ping returned False"}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

def check_llm_providers() -> dict:
    active_providers = get_active_providers()
    provider_status = {}

    for provider in ["gemini", "groq", "mistral"]:

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
                    "model": model_info.name.split("/")[-1] if hasattr(model_info, 'name') else model
                }
            else:
                latency_ms = round((time.perf_counter() - start) * 1000, 2)
                provider_status[provider] = {
                    "configured": True,
                    "status": "healthy",
                    "latency_ms": latency_ms,
                    "model": model
                }
        except Exception as e:
            provider_status[provider] = {
                "configured": True,
                "status": "unhealthy",
                "error": str(e),
                "model": model
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
