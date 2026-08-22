import os
from fastapi import APIRouter

router = APIRouter()


@router.get("/api/config")
async def get_config():
    """Returns application feature flags and configuration.

    The frontend fetches this on startup to discover server-side capabilities
    such as whether Master Template editing is enabled.
    """
    return {
        "masterEditEnabled": os.environ.get("ALLOW_MASTER_EDIT", "").lower() in ("true", "1"),
        "oscalVersion": "1.1.2",
    }
