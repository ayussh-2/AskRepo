from typing import Any, Optional
from fastapi.responses import JSONResponse


def success_response(code: int, msg: str, data: Optional[Any] = None) -> JSONResponse:

    return JSONResponse(status_code=code, content={"success": True, "message": msg, "data": data})


def error_response(code: int, msg: str, errors: Optional[Any] = None) -> JSONResponse:

    return JSONResponse(status_code=code, content={"success": False, "message": msg, "errors": errors})