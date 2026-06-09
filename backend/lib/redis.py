import redis
import json
from typing import List, Dict
from utils.config import settings

redis_client = redis.from_url(
    settings.redis_url,
    decode_responses=True
)

SESSION_TTL = settings.session_ttl

def get_session_key(session_id: str) -> str:
    return f"chat_session:{session_id}"

def get_chat_history(session_id: str) -> List[Dict[str, str]]:
    key = get_session_key(session_id)
    messages_json = redis_client.lrange(key, 0, -1)
    return [json.loads(m) for m in messages_json]

def add_chat_message(session_id: str, role: str, content: str):
    key = get_session_key(session_id)
    message_data = {"role": role, "content": content}
    redis_client.rpush(key, json.dumps(message_data))
    redis_client.expire(key, SESSION_TTL)

def save_all_history(session_id: str, history: List[Dict[str, str]]):
    key = get_session_key(session_id)

    redis_client.delete(key)
    if history:
        redis_client.rpush(key, *[json.dumps(m) for m in history])
        redis_client.expire(key, SESSION_TTL)