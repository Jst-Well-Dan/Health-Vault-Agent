from typing import Any
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter

from database import get_conn
from models import MemberUpdate
from routers.common import json_dumps, json_loads, require_row


router = APIRouter(tags=["members"])
PUBLIC_DIR = Path(__file__).resolve().parents[2] / "data" / "public"
AVATAR_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _public_url(path: Path) -> str:
    rel = path.relative_to(PUBLIC_DIR).as_posix()
    return "/public/" + quote(rel)


def _find_avatar_url(member_key: str) -> str | None:
    if not PUBLIC_DIR.exists():
        return None

    key = str(member_key or "").strip().lower()
    if not key:
        return None

    for path in sorted(PUBLIC_DIR.rglob("*")):
        if path.is_file() and path.suffix.lower() in AVATAR_EXTS and path.stem.lower() == key:
            return _public_url(path)
    return None


def _member_dict(row: Any) -> dict[str, Any]:
    item = dict(row)
    item["allergies"] = json_loads(item.get("allergies"))
    item["chronic"] = json_loads(item.get("chronic"))
    item["avatar_url"] = _find_avatar_url(item.get("key", ""))
    return item


@router.get("/members")
def list_members() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM members ORDER BY sort_order, created_at, key").fetchall()
        return [_member_dict(row) for row in rows]


@router.get("/members/{key}")
def get_member(key: str) -> dict[str, Any]:
    with get_conn() as conn:
        row = require_row(conn.execute("SELECT * FROM members WHERE key = ?", (key,)).fetchone(), "成员不存在")
        return _member_dict(row)


@router.patch("/members/{key}")
def update_member(key: str, payload: MemberUpdate) -> dict[str, Any]:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_member(key)

    allowed = {
        "name", "full_name", "initial", "birth_date", "sex", "blood_type", "role",
        "species", "sort_order", "breed", "home_date", "chip_id", "doctor", "allergies", "chronic", "notes",
    }
    updates = []
    values = []
    for field, value in data.items():
        if field not in allowed:
            continue
        if field in {"allergies", "chronic"}:
            value = json_dumps(value)
        updates.append(f"{field} = ?")
        values.append(value)
    updates.append("updated_at = datetime('now','localtime')")
    values.append(key)

    with get_conn() as conn:
        require_row(conn.execute("SELECT key FROM members WHERE key = ?", (key,)).fetchone(), "成员不存在")
        conn.execute(f"UPDATE members SET {', '.join(updates)} WHERE key = ?", values)
    return get_member(key)
