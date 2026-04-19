from typing import Optional

from fastapi import APIRouter

from database import get_conn
from routers.common import rows_to_dicts


router = APIRouter(tags=["attachments"])


@router.get("/attachments")
def list_attachments(member: str) -> list[dict]:
    with get_conn() as conn:
        return rows_to_dicts(
            conn.execute(
                "SELECT * FROM attachments WHERE member_key = ? ORDER BY date DESC, id DESC",
                (member,),
            ).fetchall()
        )


@router.get("/attachments/recent")
def recent_attachments(limit: int = 8) -> list[dict]:
    limit = max(1, min(limit, 50))
    with get_conn() as conn:
        return rows_to_dicts(
            conn.execute(
                "SELECT * FROM attachments ORDER BY created_at DESC, id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        )
