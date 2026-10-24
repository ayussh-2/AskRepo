import logging
import re
import time
from typing import Any, Dict, List, Optional
import httpx
from google import genai
from config import settings

logger = logging.getLogger("models_service")

ICON_CDN = "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.98.0/icons"

ICONS = {
    "gemini":   f"{ICON_CDN}/gemini-color.svg",
    "groq":     f"{ICON_CDN}/groq.svg",
    "mistral":  f"{ICON_CDN}/mistral-color.svg",
    "openai":   f"{ICON_CDN}/openai.svg",
    "qwen":     f"{ICON_CDN}/qwen-color.svg",
    "meta":     f"{ICON_CDN}/meta-color.svg",
    "kimi":     f"{ICON_CDN}/kimi-color.svg",
    "deepseek": f"{ICON_CDN}/deepseek-color.svg",
}


EXCLUDE_KEYWORDS = [
    "embed", "embedding", "image", "tts", "audio", "transcribe", "live",
    "whisper", "ocr", "moderation", "guard", "safeguard", "pro",
    "clip", "robotics", "computer-use", "banana", "lyria", "aqa",
    "orpheus", "allam", "realtime", "voxtral", "deep-research",
    "fim", "vibe-cli"
]

# Gemini: only "flash-lite" models (any version)
GEMINI_FLASH_LITE_RE = re.compile(r"^gemini-(\d+(?:\.\d+)*)-flash-lite(?:-.+)?$")

# How many distinct Gemini generations to show (current + 2 previous)
GEMINI_GENERATIONS_TO_KEEP = 3

# Groq: popular model families -> (keyword, icon key)
GROQ_FAMILIES = [
    ("gpt-oss",  "openai"),            # ChatGPT / OpenAI open models
    ("openai",   "openai"),
    ("qwen",     "qwen"),
    ("llama",    "meta"),
    ("kimi",     "kimi"),
    ("deepseek", "deepseek"),
]

_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "data": None
}
CACHE_TTL_SECONDS = 600  # 10 minutes cache


def is_usable_model(name: str) -> bool:
    name_lower = name.lower()
    return not any(kw in name_lower for kw in EXCLUDE_KEYWORDS)


def parse_gemini_flash_lite_version(model_id: str) -> Optional[tuple]:
    """'gemini-2.5-flash-lite' -> (2, 5). Returns None if not a flash-lite model."""
    match = GEMINI_FLASH_LITE_RE.match(model_id.lower())
    if not match:
        return None
    return tuple(int(p) for p in match.group(1).split("."))


# Backward compatibility alias
parse_gemini_flash_version = parse_gemini_flash_lite_version


def get_groq_family(model_id: str) -> Optional[str]:
    mid = model_id.lower()
    for keyword, icon_key in GROQ_FAMILIES:
        if keyword in mid:
            return ICONS[icon_key]
    return None


def validate_model_rules(model_id: Optional[str], provider: Optional[str] = None) -> tuple[bool, str]:
    """
    Validates whether a model_id is valid according to the filtering rules in models.py.
    Returns (is_valid, error_reason).
    """
    if not model_id or model_id.strip() == "" or model_id.lower() == "auto":
        return True, ""

    clean_id = model_id.strip()
    if clean_id.startswith("models/"):
        clean_id = clean_id.replace("models/", "")

    # 1. Base rule: must not contain any excluded keyword
    if not is_usable_model(clean_id):
        matched_kw = [kw for kw in EXCLUDE_KEYWORDS if kw in clean_id.lower()]
        return False, f"Model '{model_id}' contains excluded keyword(s): {', '.join(matched_kw)}"

    prov = provider.lower().strip() if provider and provider.lower().strip() != "auto" else None

    if prov == "gemini":
        if parse_gemini_flash_lite_version(clean_id) is None:
            return False, f"Model '{model_id}' is not a valid Gemini Flash-Lite model (only flash-lite models are allowed)."
        return True, ""

    elif prov == "mistral":
        return False, "Mistral provider is currently disabled."

    elif prov == "groq":
        if not get_groq_family(clean_id):
            return False, f"Model '{model_id}' does not belong to any supported Groq model families: {[f[0] for f in GROQ_FAMILIES]}."
        return True, ""

    elif prov is None:
        # Check if valid under ANY supported provider (Mistral disabled)
        is_gemini = parse_gemini_flash_lite_version(clean_id) is not None
        is_groq = get_groq_family(clean_id) is not None

        if not (is_gemini or is_groq):
            return False, f"Model '{model_id}' does not conform to rules for any supported provider (Gemini Flash-Lite or Groq families)."
        return True, ""

    else:
        return False, f"Unknown provider '{provider}'."


def get_default_model_for_provider(provider: str) -> Optional[str]:
    """
    Returns the first dynamically available model for a provider from get_available_models().
    """
    models_data = get_available_models()
    for prov in models_data.get("providers", []):
        if prov.get("id") == provider:
            models = prov.get("models", [])
            if models:
                return models[0]["id"]
    return None


# ---------------------------------------------------------------------------
# Formatters
# ---------------------------------------------------------------------------
def format_gemini_model(model_id: str) -> Dict[str, str]:
    # e.g. "gemini-3-flash-preview" -> "Gemini 3 Flash Preview"
    clean_id = model_id.replace("models/", "")
    parts = clean_id.split("-")
    clean_name = " ".join(p.capitalize() for p in parts)

    return {
        "id": clean_id,
        "name": clean_name,
        "provider": "gemini",
        "icon": ICONS["gemini"],
    }


def format_groq_model(model_id: str, icon: str) -> Dict[str, str]:
    clean_name = model_id.split("/")[-1].replace("-", " ").title()

    return {
        "id": model_id,
        "name": clean_name,
        "provider": "groq",
        "icon": icon,  # the model family's own logo, not the generic Groq one
    }


def format_mistral_model(model_id: str) -> Dict[str, str]:
    clean_name = model_id.replace("-", " ").title()

    return {
        "id": model_id,
        "name": clean_name,
        "provider": "mistral",
        "icon": ICONS["mistral"],
    }


# ---------------------------------------------------------------------------
# Fetchers
# ---------------------------------------------------------------------------
def fetch_gemini_models() -> List[Dict[str, str]]:
    if not settings.gemini_api_key:
        return []
    try:
        client = genai.Client(api_key=settings.gemini_api_key)
        raw_models = client.models.list()

        candidates = []  # (version_tuple, model_id)
        for m in raw_models:
            model_id = m.name.replace("models/", "")
            if not is_usable_model(model_id):
                continue
            version = parse_gemini_flash_lite_version(model_id)
            if version is None:
                continue
            candidates.append((version, model_id))

        # Keep only the newest N distinct versions that actually exist
        versions = sorted({v for v, _ in candidates}, reverse=True)
        allowed = set(versions[:GEMINI_GENERATIONS_TO_KEEP])

        # Newest first, then alphabetical within a version
        candidates = [c for c in candidates if c[0] in allowed]
        candidates.sort(key=lambda c: (tuple(-x for x in c[0]), c[1]))

        return [format_gemini_model(model_id) for _, model_id in candidates]
    except Exception as e:
        logger.warning(f"[Models Service] Failed to fetch Gemini models: {e}")
        return []


def fetch_groq_models() -> List[Dict[str, str]]:
    if not settings.groq_api_key:
        return []
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"}
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            result = []
            for item in data:
                m_id = item.get("id", "")
                if not is_usable_model(m_id):
                    continue
                family = get_groq_family(m_id)
                if family:
                    result.append(format_groq_model(m_id, family))
            return result
    except Exception as e:
        logger.warning(f"[Models Service] Failed to fetch Groq models: {e}")
        return []


def fetch_mistral_models() -> List[Dict[str, str]]:
    if not settings.mistral_api_key:
        return []
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://api.mistral.ai/v1/models",
                headers={"Authorization": f"Bearer {settings.mistral_api_key}"}
            )
            resp.raise_for_status()
            data = resp.json().get("data", [])
            result = []
            for item in data:
                m_id = item.get("id", "")
                if is_usable_model(m_id):
                    result.append(format_mistral_model(m_id))
            return result
    except Exception as e:
        logger.warning(f"[Models Service] Failed to fetch Mistral models: {e}")
        return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def get_available_models(force_refresh: bool = False) -> Dict[str, Any]:
    global _CACHE
    now = time.time()
    if not force_refresh and _CACHE["data"] and (now - _CACHE["timestamp"] < CACHE_TTL_SECONDS):
        return _CACHE["data"]

    gemini_models = fetch_gemini_models()
    groq_models = fetch_groq_models()
    # Mistral is temporarily disabled from the model list

    providers = []
    if gemini_models:
        providers.append({
            "id": "gemini",
            "name": "Google Gemini",
            "icon": ICONS["gemini"],
            "models": gemini_models
        })
    if groq_models:
        providers.append({
            "id": "groq",
            "name": "Groq LPU",
            "icon": ICONS["groq"],
            "models": groq_models
        })

    default_provider = "auto"
    default_model = "auto"
    if providers and providers[0].get("models") and len(providers[0]["models"]) > 0:
        default_provider = providers[0]["id"]
        default_model = providers[0]["models"][0]["id"]

    data = {
        "providers": providers,
        "default": {
            "provider": default_provider,
            "model": default_model
        }
    }

    _CACHE["timestamp"] = now
    _CACHE["data"] = data
    return data