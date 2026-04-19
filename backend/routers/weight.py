from fastapi import APIRouter

from database import get_conn
from models import WeightCreate
from routers.common import require_row, row_to_dict, rows_to_dicts


router = APIRouter(tags=["weight"])


@router.get("/weight")
def list_weight(member: str) -> list[dict]:
    with get_conn() as conn:
        return rows_to_dicts(
            conn.execute(
                "SELECT * FROM weight_log WHERE member_key = ? ORDER BY date ASC, id ASC",
                (member,),
            ).fetchall()
        )


@router.post("/weight")
def create_weight(payload: WeightCreate) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO weight_log (member_key, date, weight_kg, notes) VALUES (?, ?, ?, ?)",
            (payload.member_key, payload.date, payload.weight_kg, payload.notes),
        )
        return row_to_dict(conn.execute("SELECT * FROM weight_log WHERE id = ?", (cur.lastrowid,)).fetchone())


@router.delete("/weight/{weight_id}")
def delete_weight(weight_id: int) -> dict:
    with get_conn() as conn:
        require_row(conn.execute("SELECT id FROM weight_log WHERE id = ?", (weight_id,)).fetchone())
        conn.execute("DELETE FROM weight_log WHERE id = ?", (weight_id,))
    return {"ok": True}
