from typing import Optional

from fastapi import APIRouter, HTTPException

from database import get_conn
from models import ReminderCreate, ReminderUpdate
from routers.common import bool_out, require_row, row_to_dict, rows_to_dicts
from services.auto_reminders import skip_auto_reminder, sync_auto_reminders


router = APIRouter(tags=["reminders"])


@router.get("/reminders")
def list_reminders(member: Optional[str] = None, include_done: bool = False) -> list[dict]:
    where = []
    values = []
    if member:
        where.append("member_key = ?")
        values.append(member)
    if not include_done:
        where.append("done = 0")

    sql = "SELECT * FROM reminders"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY date ASC, id ASC"

    with get_conn() as conn:
        rows = rows_to_dicts(conn.execute(sql, values).fetchall())
        return [bool_out(row, "done") for row in rows]


@router.post("/reminders")
def create_reminder(payload: ReminderCreate) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO reminders (member_key, date, title, kind, priority, done, done_at, notes)
            VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now','localtime') ELSE NULL END, ?)
            """,
            (
                payload.member_key,
                payload.date,
                payload.title,
                payload.kind,
                payload.priority,
                1 if payload.done else 0,
                1 if payload.done else 0,
                payload.notes,
            ),
        )
        row = row_to_dict(conn.execute("SELECT * FROM reminders WHERE id = ?", (cur.lastrowid,)).fetchone())
        return bool_out(row, "done")


@router.post("/reminders/auto/sync")
def sync_generated_reminders(member: Optional[str] = None) -> dict:
    rows = sync_auto_reminders(member=member)
    return {
        "inserted": len(rows),
        "items": [bool_out(row, "done") for row in rows],
    }


@router.post("/reminders/{reminder_id}/skip")
def skip_generated_reminder(reminder_id: int) -> dict:
    try:
        row = skip_auto_reminder(reminder_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not row:
        raise HTTPException(status_code=404, detail="提醒不存在")
    return bool_out(row_to_dict(row), "done")


@router.patch("/reminders/{reminder_id}")
def update_reminder(reminder_id: int, payload: ReminderUpdate) -> dict:
    data = payload.model_dump(exclude_unset=True)
    if data:
        updates = []
        values = []
        for field, value in data.items():
            if field == "done":
                updates.append("done = ?")
                values.append(1 if value else 0)
                updates.append("done_at = CASE WHEN ? = 1 THEN datetime('now','localtime') ELSE NULL END")
                values.append(1 if value else 0)
            else:
                updates.append(f"{field} = ?")
                values.append(value)
        values.append(reminder_id)
        with get_conn() as conn:
            require_row(conn.execute("SELECT id FROM reminders WHERE id = ?", (reminder_id,)).fetchone())
            conn.execute(f"UPDATE reminders SET {', '.join(updates)} WHERE id = ?", values)

    with get_conn() as conn:
        row = row_to_dict(require_row(conn.execute("SELECT * FROM reminders WHERE id = ?", (reminder_id,)).fetchone()))
        return bool_out(row, "done")


@router.delete("/reminders/{reminder_id}")
def delete_reminder(reminder_id: int) -> dict:
    with get_conn() as conn:
        require_row(conn.execute("SELECT id FROM reminders WHERE id = ?", (reminder_id,)).fetchone())
        conn.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
    return {"ok": True}
