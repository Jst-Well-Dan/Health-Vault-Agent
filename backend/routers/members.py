from typing import Any

from fastapi import APIRouter

from database import get_conn
from models import MemberUpdate
from routers.common import json_dumps, json_loads, require_row


router = APIRouter(tags=["members"])


def _member_dict(row: Any) -> dict[str, Any]:
    item = dict(row)
    item["allergies"] = json_loads(item.get("allergies"))
    item["chronic"] = json_loads(item.get("chronic"))
    return item


def _latest_kpis(conn, member_key: str) -> list[dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT l.test_name, l.value, l.unit, l.date, l.status
        FROM lab_results l
        JOIN (
          SELECT test_name, MAX(date) AS max_date
          FROM lab_results
          WHERE member_key = ?
          GROUP BY test_name
        ) latest ON latest.test_name = l.test_name AND latest.max_date = l.date
        WHERE l.member_key = ?
        ORDER BY l.date DESC, l.id DESC
        LIMIT 3
        """,
        (member_key, member_key),
    ).fetchall()
    return [dict(row) for row in rows]


def _next_reminder(conn, member_key: str) -> dict[str, Any] | None:
    row = conn.execute(
        """
        SELECT id, date, title, kind
        FROM reminders
        WHERE member_key = ? AND done = 0 AND date >= date('now','localtime')
        ORDER BY date ASC, id ASC
        LIMIT 1
        """,
        (member_key,),
    ).fetchone()
    return dict(row) if row else None


@router.get("/members")
def list_members() -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM members ORDER BY created_at, key").fetchall()
        items = []
        for row in rows:
            item = _member_dict(row)
            item["latest_kpis"] = _latest_kpis(conn, item["key"])
            item["next_reminder"] = _next_reminder(conn, item["key"])
            items.append(item)
        return items


@router.get("/members/{key}")
def get_member(key: str) -> dict[str, Any]:
    with get_conn() as conn:
        row = require_row(conn.execute("SELECT * FROM members WHERE key = ?", (key,)).fetchone(), "成员不存在")
        item = _member_dict(row)
        item["latest_kpis"] = _latest_kpis(conn, key)
        item["next_reminder"] = _next_reminder(conn, key)
        return item


@router.patch("/members/{key}")
def update_member(key: str, payload: MemberUpdate) -> dict[str, Any]:
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return get_member(key)

    allowed = {
        "name", "full_name", "initial", "birth_date", "sex", "blood_type", "role",
        "species", "chip_id", "doctor", "allergies", "chronic", "notes",
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
