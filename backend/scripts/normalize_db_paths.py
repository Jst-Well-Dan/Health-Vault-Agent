import argparse
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import DB_PATH, get_conn, init_db, is_mock_mode  # noqa: E402
from path_utils import project_relative_path  # noqa: E402


TARGETS = (
    ("attachments", "file_path"),
    ("visits", "source_file"),
    ("lab_results", "source_file"),
)


def _backup_database() -> Path | None:
    if is_mock_mode():
        return None

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    backup_dir = PROJECT_DIR / "data" / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{DB_PATH.stem}_{timestamp}{DB_PATH.suffix}"

    with sqlite3.connect(DB_PATH) as source:
        with sqlite3.connect(backup_path) as target:
            source.backup(target)

    return backup_path


def _collect_changes(conn: sqlite3.Connection) -> dict[str, list[dict]]:
    changes: dict[str, list[dict]] = {}
    for table, column in TARGETS:
        rows = conn.execute(
            f"SELECT id, {column} AS path_value FROM {table} "
            f"WHERE {column} IS NOT NULL AND TRIM({column}) <> '' "
            f"ORDER BY id"
        ).fetchall()
        table_changes = []
        for row in rows:
            before = row["path_value"]
            after = project_relative_path(before)
            if after and after != before:
                table_changes.append({
                    "id": row["id"],
                    "before": before,
                    "after": after,
                })
        changes[table] = table_changes
    return changes


def _apply_changes(conn: sqlite3.Connection, changes: dict[str, list[dict]]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for table, column in TARGETS:
        updated = 0
        for item in changes[table]:
            conn.execute(
                f"UPDATE {table} SET {column} = ? WHERE id = ?",
                (item["after"], item["id"]),
            )
            updated += 1
        counts[table] = updated
    return counts


def _summary(changes: dict[str, list[dict]]) -> dict[str, object]:
    return {
        "ok": True,
        "db_path": str(DB_PATH),
        "counts": {table: len(items) for table, items in changes.items()},
        "samples": {
            table: items[:5]
            for table, items in changes.items()
            if items
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize absolute DB file paths to project-relative paths.")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--dry-run", action="store_true", help="Preview rows that would be updated.")
    mode.add_argument("--write", action="store_true", help="Back up the database and apply updates.")
    args = parser.parse_args()

    init_db()
    with get_conn() as conn:
        changes = _collect_changes(conn)

    result = _summary(changes)
    result["mode"] = "dry-run" if args.dry_run else "write"

    if args.write:
        backup_path = _backup_database()
        with get_conn() as conn:
            updated_counts = _apply_changes(conn, changes)
        result["updated_counts"] = updated_counts
        result["backup_path"] = str(backup_path) if backup_path else None

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
