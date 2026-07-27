import time
from datetime import datetime, timezone
from sqlmodel import Session, text
from db.db import engine
from lib.redis import redis_client
from config import settings
from google import genai

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

gemini_client = genai.Client(api_key=settings.gemini_api_key)

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

def check_gemini() -> dict:
    start = time.perf_counter()
    try:
        if not settings.gemini_api_key:
            return {"status": "unhealthy", "error": "Gemini API key is not configured"}
        
        # Zero-token model metadata query to test live Google Gemini API connectivity & key authorization
        model_info = gemini_client.models.get(model=settings.gemini_llm_model)
        latency_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "status": "healthy",
            "latency_ms": latency_ms,
            "model": model_info.name.split("/")[-1] if hasattr(model_info, 'name') else settings.gemini_llm_model
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

def get_health_status() -> dict:
    pg_health = check_postgres()
    redis_health = check_redis()
    gemini_health = check_gemini()

    services = {
        "postgres": pg_health,
        "redis": redis_health,
        "gemini": gemini_health
    }

    all_healthy = all(s.get("status") == "healthy" for s in services.values())
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
