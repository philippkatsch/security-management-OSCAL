import os
import aiosqlite
import uuid
from datetime import datetime, timezone
from typing import Optional

from .models import CREATE_TABLES_SQL

DB_PATH = os.path.join("data", "reposol_auth.db")

async def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(CREATE_TABLES_SQL)
        await db.commit()

async def get_db():
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    try:
        yield db
    finally:
        await db.close()

async def log_audit_event(
    workspace_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user: Optional[dict] = None,
    details: Optional[str] = None
):
    async with aiosqlite.connect(DB_PATH) as db:
        log_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()
        user_id = user.get("user_id") if user else None
        user_email = user.get("email") if user else None
        
        await db.execute(
            """
            INSERT INTO audit_log 
            (id, user_id, user_email, workspace_id, action, resource_type, resource_id, timestamp, details)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (log_id, user_id, user_email, workspace_id, action, resource_type, resource_id, timestamp, details)
        )
        await db.commit()
