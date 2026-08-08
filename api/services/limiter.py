import time
from fastapi import HTTPException, Depends
from lib.redis import redis_client
from services.auth import get_current_user

# Default limits: 30 requests per minute
RATE_LIMIT = 30
WINDOW = 60  # seconds

def rate_limit(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User identifier not found in token")

    key = f"rate_limit:{user_id}"
    now = time.time()
    
    # Use Redis transaction pipeline for sliding window count
    try:
        pipe = redis_client.pipeline()
        # Remove request timestamps older than current window
        pipe.zremrangebyscore(key, 0, now - WINDOW)
        # Get count of remaining timestamps in window
        pipe.zcard(key)
        # Add current timestamp
        pipe.zadd(key, {str(now): now})
        # Set TTL to clean up idle keys
        pipe.expire(key, WINDOW)
        
        # Execute pipeline
        _, current_requests, _, _ = pipe.execute()
        
        if current_requests > RATE_LIMIT:
            raise HTTPException(
                status_code=429, 
                detail=f"Rate limit exceeded. Maximum {RATE_LIMIT} requests per minute allowed."
            )
    except Exception as e:
        # Fallback if Redis fails, to prevent locking out users
        print(f"Redis Rate Limiter Error: {e}")
        pass

# Ingestion limit: 5 triggers per hour (to protect GitLab CI runner minutes)
INGEST_LIMIT = 5
INGEST_WINDOW = 3600  # 1 hour

def ingest_rate_limit(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="User identifier not found in token")

    key = f"ingest_limit:{user_id}"
    now = time.time()
    
    try:
        pipe = redis_client.pipeline()
        pipe.zremrangebyscore(key, 0, now - INGEST_WINDOW)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, INGEST_WINDOW)
        
        _, current_requests, _, _ = pipe.execute()
        
        if current_requests > INGEST_LIMIT:
            raise HTTPException(
                status_code=429, 
                detail=f"Ingestion limit exceeded. Maximum {INGEST_LIMIT} repository ingestions per hour allowed."
            )
    except Exception as e:
        print(f"Redis Ingest Limiter Error: {e}")
        pass
