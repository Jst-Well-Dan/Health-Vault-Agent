from pathlib import Path

from database import BASE_DIR


DATA_DIR = (BASE_DIR / "data").resolve()


def project_relative_path(file_path: str | None) -> str | None:
    if not file_path:
        return None

    raw = Path(file_path)
    if not raw.is_absolute():
        return raw.as_posix()

    try:
        return raw.resolve().relative_to(BASE_DIR).as_posix()
    except ValueError:
        parts = list(raw.parts)
        if "data" in parts:
            data_index = parts.index("data")
            return Path(*parts[data_index:]).as_posix()
        return raw.as_posix()


def resolve_project_data_path(file_path: str | None) -> Path:
    if not file_path:
        raise ValueError("附件路径未记录")

    raw = Path(file_path)
    candidates: list[Path] = []

    if raw.is_absolute():
        candidates.append(raw)
        parts = list(raw.parts)
        if "data" in parts:
            data_index = parts.index("data")
            remapped = BASE_DIR.joinpath(*parts[data_index:])
            if remapped not in candidates:
                candidates.append(remapped)
    else:
        candidates.append(BASE_DIR / raw)

    for candidate in candidates:
        resolved = candidate.resolve()
        if DATA_DIR in [resolved, *resolved.parents]:
            return resolved

    raise ValueError("附件路径不在允许目录内")
