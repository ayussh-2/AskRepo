import httpx
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from config import settings

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    if token == "mock_google_id_token":
        if settings.env == "development":
            return {
                "sub": "mock_user_123456789",
                "email": "mock@example.com",
                "iss": "accounts.google.com"
            }
        else:
            raise HTTPException(status_code=401, detail="Development authentication token is not permitted in production mode.")
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": token}
            )
            if response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid Google authentication token")
            
            user_info = response.json()
            
            # Verify issuer
            iss = user_info.get("iss", "")
            if iss not in ["accounts.google.com", "https://accounts.google.com"]:
                raise HTTPException(status_code=401, detail="Invalid token issuer")
            
            return user_info
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Google authentication service unavailable: {e}")
