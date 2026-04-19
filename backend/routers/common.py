import json
from typing import Any

from fastapi import HTTPException


def row_to_dict(row: Any) -> dict[str, Any]:
    return dict(row)


def rows_to_dicts(rows: Any) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def json_loads(value: str | None) -> list[Any]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return []
    return parsed if isinstance(parsed, list) else []


def json_dumps(value: list[Any] | None) -> str:
    return json.dumps(value or [], ensure_ascii=False)


def bool_out(row: dict[str, Any], *fields: str) -> dict[str, Any]:
    for field in fields:
        if field in row:
            row[field] = bool(row[field])
    return row


def require_row(row: Any, detail: str = "记录不存在") -> Any:
    if row is None:
        raise HTTPException(status_code=404, detail=detail)
    return row
