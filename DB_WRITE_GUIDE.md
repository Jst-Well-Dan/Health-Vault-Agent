# Database Write Guide

This project stores personal and family health records in SQLite. Treat the real database as user data, not disposable development state.

## Database Paths

- Real database: `data/health.db`
- Mock database: `data/mock/health_mock.db`
- Backups: `data/backups/`

The backend chooses the database in `backend/database.py`:

- Default: `data/health.db`
- Mock mode: set `HEALTH_MOCK_MODE=1`
- Custom path: set `HEALTH_DB_PATH`

`HEALTH_DB_PATH` takes priority over the default real and mock paths.

## Agent Write Rules

- Use the project skill at `skills/health-db-writer` for database write/import tasks.
- Do not write directly to `data/health.db` with ad hoc SQL unless the user explicitly asks.
- Prefer import scripts under `backend/scripts/`.
- Use `--dry-run` before any write.
- Before writing to the real database, create a timestamped backup under `data/backups/`.
- Do not delete, rebuild, reset, or bulk-update the real database without explicit user confirmation.
- Do not change existing records unless the user asks for an update rather than a new import.
- After writing, query or report the inserted IDs and affected row counts.

## Supported Import Flow

For a visit with optional labs, meds, and attachments:

```powershell
python backend/scripts/import_visit_json.py --file data/imports/templates/visit_import.example.json --dry-run
python backend/scripts/import_visit_json.py --file path\to\visit.json --write
```

Use mock mode for experiments:

```powershell
$env:HEALTH_MOCK_MODE='1'
python backend/scripts/import_visit_json.py --file path\to\visit.json --write
```

## Payload Rules

Top-level fields:

- `visit`: required object
- `labs`: optional list
- `meds`: optional list
- `attachments`: optional list

Required `visit` fields:

- `member_key`: must already exist in `members`
- `date`: `YYYY-MM-DD`

Recommended `visit` fields:

- `type`: primary record category used by the frontend, for example `体检`, `就医`, `疫苗`, or `复查`.

Common conventions:

- Use `YYYY-MM-DD` for dates.
- Do not rely on `attachments.tag` for visit/report page classification; use `visit.type`.
- `severity` can only be `严重`, `一般`, `轻微`, or omitted.
- `diagnosis` must be a list of strings.
- Lab values are stored as text because medical reports often include symbols and mixed formats.
- Attachment paths should be project-relative paths, for example `data/reports/...`.
- `source_file` should point to the markdown or source report used for the import when available.

Detailed extraction guidance from the earlier project docs has been incorporated into `skills/health-db-writer/references/database-write.md`.

## Verification Checklist

After a write:

1. Confirm the script returned `ok: true`.
2. Note the returned `visit_id`.
3. Check the reported counts for labs, meds, and attachments.
4. If the frontend is running, open the member detail page and confirm the new visit appears under the correct member.
