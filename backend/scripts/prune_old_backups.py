import argparse
from datetime import datetime, timedelta
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[2]
BACKUP_DIR = PROJECT_DIR / "data" / "backups"
BACKUP_SUFFIXES = {".db", ".db-shm", ".db-wal"}


def _backup_files(backup_dir: Path) -> list[Path]:
    if not backup_dir.exists():
        return []
    return [
        path
        for path in backup_dir.iterdir()
        if path.is_file() and path.suffix.lower() in BACKUP_SUFFIXES
    ]


def _is_safe_backup_path(path: Path, backup_dir: Path) -> bool:
    try:
        path.resolve().relative_to(backup_dir.resolve())
    except ValueError:
        return False
    return path.is_file() and path.suffix.lower() in BACKUP_SUFFIXES


def prune_old_backups(days: int, write: bool) -> dict:
    if days < 1:
        raise ValueError("days must be at least 1")

    cutoff = datetime.now() - timedelta(days=days)
    candidates = []
    for path in _backup_files(BACKUP_DIR):
        modified_at = datetime.fromtimestamp(path.stat().st_mtime)
        if modified_at < cutoff:
            candidates.append((path, modified_at))

    deleted = []
    if write:
        for path, modified_at in candidates:
            if not _is_safe_backup_path(path, BACKUP_DIR):
                raise ValueError(f"unsafe backup path: {path}")
            path.unlink()
            deleted.append({"path": str(path), "modified_at": modified_at.isoformat(timespec="seconds")})

    return {
        "ok": True,
        "mode": "write" if write else "dry-run",
        "backup_dir": str(BACKUP_DIR),
        "days": days,
        "cutoff": cutoff.isoformat(timespec="seconds"),
        "matched": [
            {"path": str(path), "modified_at": modified_at.isoformat(timespec="seconds")}
            for path, modified_at in candidates
        ],
        "deleted": deleted,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Delete old SQLite backup files from data/backups.")
    parser.add_argument("--days", type=int, default=7, help="Delete backup files older than this many days.")
    parser.add_argument("--write", action="store_true", help="Actually delete matching files. Omit for dry-run.")
    args = parser.parse_args()

    import json

    print(json.dumps(prune_old_backups(args.days, args.write), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
