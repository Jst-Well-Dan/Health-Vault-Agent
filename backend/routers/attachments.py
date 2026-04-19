from typing import Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse

from database import BASE_DIR, get_conn
from routers.common import require_row, row_to_dict, rows_to_dicts


router = APIRouter(tags=["attachments"])
DATA_DIR = (BASE_DIR / "data").resolve()


def _resolve_attachment_path(file_path: str | None) -> Path:
    if not file_path:
        raise HTTPException(status_code=404, detail="附件路径未记录")

    raw = Path(file_path)
    candidate = raw if raw.is_absolute() else BASE_DIR / raw
    resolved = candidate.resolve()

    if DATA_DIR not in [resolved, *resolved.parents]:
        raise HTTPException(status_code=403, detail="附件路径不在允许目录内")
    if not resolved.is_file():
        raise HTTPException(status_code=404, detail="附件文件不存在")
    return resolved


def _attachment(attachment_id: int) -> dict:
    with get_conn() as conn:
        return row_to_dict(require_row(
            conn.execute("SELECT * FROM attachments WHERE id = ?", (attachment_id,)).fetchone(),
            "附件不存在",
        ))


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


@router.get("/attachments/{attachment_id}/file")
def attachment_file(attachment_id: int, download: bool = False) -> FileResponse:
    attachment = _attachment(attachment_id)
    path = _resolve_attachment_path(attachment.get("file_path"))
    disposition = "attachment" if download else "inline"
    return FileResponse(
        path,
        filename=attachment.get("filename") or path.name,
        content_disposition_type=disposition,
    )


@router.get("/attachments/{attachment_id}/text")
def attachment_text(attachment_id: int) -> PlainTextResponse:
    attachment = _attachment(attachment_id)
    path = _resolve_attachment_path(attachment.get("file_path"))
    if path.suffix.lower() not in {".md", ".txt", ".csv", ".json"}:
        raise HTTPException(status_code=415, detail="该附件不是可文本预览的文件")
    return PlainTextResponse(path.read_text(encoding="utf-8"))
