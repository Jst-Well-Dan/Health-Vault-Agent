from fastapi import APIRouter
from database import get_conn

router = APIRouter(tags=["activity"])


@router.get("/activity")
def recent_activity(limit: int = 15) -> list[dict]:
    limit = max(1, min(limit, 50))
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT type, member_key, date, title, detail, created_at
            FROM (
                SELECT 'visit' as type, member_key, date,
                       COALESCE(department, hospital, '就诊') as title,
                       COALESCE(hospital, chief_complaint, '') as detail,
                       created_at
                FROM visits

                UNION ALL

                SELECT 'lab' as type, member_key, date,
                       panel as title,
                       CAST(COUNT(*) as TEXT) || ' 项检验' as detail,
                       MAX(created_at) as created_at
                FROM lab_results
                GROUP BY member_key, date, panel

                UNION ALL

                SELECT 'med' as type, member_key,
                       COALESCE(start_date, substr(created_at, 1, 10)) as date,
                       name as title,
                       TRIM(COALESCE(dose, '') || ' ' || COALESCE(freq, '')) as detail,
                       created_at
                FROM meds

                UNION ALL

                SELECT 'weight' as type, member_key, date,
                       CAST(weight_kg as TEXT) || ' kg' as title,
                       COALESCE(notes, '') as detail,
                       created_at
                FROM weight_log

                UNION ALL

                SELECT 'attachment' as type, member_key, date,
                       title as title,
                       COALESCE(tag, '') as detail,
                       created_at
                FROM attachments
            )
            ORDER BY date DESC, created_at DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]
