import redis
import json
from typing import List, Dict, Optional
from config import settings

redis_client = redis.from_url(
    settings.redis_url,
    decode_responses=True,
    socket_timeout=5.0,
    socket_connect_timeout=5.0,
    retry_on_timeout=True,
    health_check_interval=30
)

SESSION_TTL = settings.session_ttl

def get_session_key(user_id: str, repo_name: str) -> str:
    clean_user = user_id.replace(":", "_")
    clean_repo = repo_name.lower().replace("/", ":")
    return f"chat_session:{clean_user}:{clean_repo}"

def get_chat_history(user_id: str, repo_name: str) -> List[Dict[str, str]]:
    key = get_session_key(user_id, repo_name)
    messages_json = redis_client.lrange(key, 0, -1)
    return [json.loads(m) for m in messages_json]

def add_chat_message(user_id: str, repo_name: str, role: str, content: str):
    key = get_session_key(user_id, repo_name)
    message_data = {"role": role, "content": content}
    redis_client.rpush(key, json.dumps(message_data))
    redis_client.expire(key, SESSION_TTL)

def save_all_history(user_id: str, repo_name: str, history: List[Dict[str, str]]):
    key = get_session_key(user_id, repo_name)
    redis_client.delete(key)
    if history:
        redis_client.rpush(key, *[json.dumps(m) for m in history])
        redis_client.expire(key, SESSION_TTL)

def clear_chat_history(user_id: str, repo_name: str):
    key = get_session_key(user_id, repo_name)
    redis_client.delete(key)
