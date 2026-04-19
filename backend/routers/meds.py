from fastapi import APIRouter

from database import get_conn
from models import MedCreate, MedUpdate
from routers.common import bool_out, require_row, row_to_dict, rows_to_dicts


router = APIRouter(tags=["meds"])


def _med(row) -> dict:
    return bool_out(dict(row), "ongoing")


@router.get("/meds")
def list_meds(member: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT * FROM meds
            WHERE member_key = ?
            ORDER BY ongoing DESC, COALESCE(start_date, '') DESC, id DESC
            """,
            (member,),
        ).fetchall()
        return [_med(row) for row in rows]


@router.post("/meds")
def create_med(payload: MedCreate) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO meds
              (member_key, visit_id, name, dose, freq, route, start_date, end_date, ongoing, category, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.member_key,
                payload.visit_id,
                payload.name,
                payload.dose,
                payload.freq,
                payload.route,
                payload.start_date,
                payload.end_date,
                1 if payload.ongoing else 0,
                payload.category,
                payload.notes,
            ),
        )
        return _med(conn.execute("SELECT * FROM meds WHERE id = ?", (cur.lastrowid,)).fetchone())


@router.patch("/meds/{med_id}")
def update_med(med_id: int, payload: MedUpdate) -> dict:
    data = payload.model_dump(exclude_unset=True)
    if data:
        updates = []
        values = []
        for field, value in data.items():
            if field == "ongoing":
                value = 1 if value else 0
            updates.append(f"{field} = ?")
            values.append(value)
        updates.append("updated_at = datetime('now','localtime')")
        values.append(med_id)
        with get_conn() as conn:
            require_row(conn.execute("SELECT id FROM meds WHERE id = ?", (med_id,)).fetchone())
            conn.execute(f"UPDATE meds SET {', '.join(updates)} WHERE id = ?", values)

    with get_conn() as conn:
        return _med(require_row(conn.execute("SELECT * FROM meds WHERE id = ?", (med_id,)).fetchone()))


@router.delete("/meds/{med_id}")
def delete_med(med_id: int) -> dict:
    with get_conn() as conn:
        require_row(conn.execute("SELECT id FROM meds WHERE id = ?", (med_id,)).fetchone())
        conn.execute("DELETE FROM meds WHERE id = ?", (med_id,))
    return {"ok": True}
