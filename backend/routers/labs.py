from typing import Optional

from fastapi import APIRouter

from database import get_conn
from routers.common import rows_to_dicts


router = APIRouter(tags=["labs"])


def _to_float(value: str | None) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@router.get("/labs")
def list_labs(member: str, panel: Optional[str] = None) -> list[dict]:
    where = ["member_key = ?"]
    values = [member]
    if panel:
        where.append("panel = ?")
        values.append(panel)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM lab_results WHERE {' AND '.join(where)} ORDER BY date DESC, id DESC",
            values,
        ).fetchall()
        return rows_to_dicts(rows)


@router.get("/labs/available")
def available_labs(member: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT test_name, panel, unit, COUNT(*) AS count
            FROM lab_results
            WHERE member_key = ?
            GROUP BY test_name, panel, unit
            HAVING COUNT(*) >= 2
            ORDER BY test_name
            """,
            (member,),
        ).fetchall()
        return rows_to_dicts(rows)


@router.get("/labs/trend")
def lab_trend(member: str, test_name: str) -> dict:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT date, value, unit, ref_low, ref_high, visit_id
            FROM lab_results
            WHERE member_key = ? AND test_name = ?
            ORDER BY date ASC, id ASC
            """,
            (member, test_name),
        ).fetchall()
    unit = rows[-1]["unit"] if rows else None
    ref_low = rows[-1]["ref_low"] if rows else None
    ref_high = rows[-1]["ref_high"] if rows else None
    points = [
        {"date": row["date"], "value": _to_float(row["value"]), "visit_id": row["visit_id"]}
        for row in rows
        if _to_float(row["value"]) is not None
    ]
    return {"test_name": test_name, "unit": unit, "ref_low": ref_low, "ref_high": ref_high, "points": points}
