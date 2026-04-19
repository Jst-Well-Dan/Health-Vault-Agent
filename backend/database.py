from pathlib import Path
import sqlite3


BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "data" / "health.db"


def get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS members (
              key         TEXT PRIMARY KEY,
              name        TEXT NOT NULL,
              full_name   TEXT,
              initial     TEXT,
              birth_date  TEXT,
              sex         TEXT,
              blood_type  TEXT,
              role        TEXT,
              species     TEXT NOT NULL DEFAULT 'human',
              chip_id     TEXT,
              doctor      TEXT,
              allergies   TEXT DEFAULT '[]',
              chronic     TEXT DEFAULT '[]',
              notes       TEXT,
              created_at  TEXT DEFAULT (datetime('now','localtime')),
              updated_at  TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS visits (
              id              INTEGER PRIMARY KEY AUTOINCREMENT,
              member_key      TEXT NOT NULL REFERENCES members(key),
              date            TEXT NOT NULL,
              hospital        TEXT,
              department      TEXT,
              doctor          TEXT,
              chief_complaint TEXT,
              diagnosis       TEXT DEFAULT '[]',
              notes           TEXT,
              source_file     TEXT,
              created_at      TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS lab_results (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              member_key  TEXT NOT NULL REFERENCES members(key),
              visit_id    INTEGER REFERENCES visits(id),
              date        TEXT NOT NULL,
              panel       TEXT NOT NULL,
              test_name   TEXT NOT NULL,
              value       TEXT,
              unit        TEXT,
              ref_low     TEXT,
              ref_high    TEXT,
              status      TEXT,
              source_file TEXT,
              created_at  TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS meds (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              member_key  TEXT NOT NULL REFERENCES members(key),
              visit_id    INTEGER REFERENCES visits(id),
              name        TEXT NOT NULL,
              dose        TEXT,
              freq        TEXT,
              route       TEXT,
              start_date  TEXT,
              end_date    TEXT,
              ongoing     INTEGER NOT NULL DEFAULT 0,
              notes       TEXT,
              created_at  TEXT DEFAULT (datetime('now','localtime')),
              updated_at  TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS weight_log (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              member_key  TEXT NOT NULL REFERENCES members(key),
              date        TEXT NOT NULL,
              weight_kg   REAL NOT NULL,
              notes       TEXT,
              created_at  TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS reminders (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              member_key  TEXT NOT NULL REFERENCES members(key),
              date        TEXT NOT NULL,
              title       TEXT NOT NULL,
              kind        TEXT NOT NULL,
              priority    TEXT NOT NULL DEFAULT 'normal',
              done        INTEGER NOT NULL DEFAULT 0,
              done_at     TEXT,
              notes       TEXT,
              created_at  TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS attachments (
              id          INTEGER PRIMARY KEY AUTOINCREMENT,
              member_key  TEXT NOT NULL REFERENCES members(key),
              visit_id    INTEGER REFERENCES visits(id),
              date        TEXT NOT NULL,
              title       TEXT NOT NULL,
              org         TEXT,
              tag         TEXT,
              filename    TEXT,
              file_path   TEXT,
              notes       TEXT,
              created_at  TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE INDEX IF NOT EXISTS idx_visits_member       ON visits(member_key, date);
            CREATE INDEX IF NOT EXISTS idx_labs_member         ON lab_results(member_key, test_name, date);
            CREATE INDEX IF NOT EXISTS idx_labs_panel          ON lab_results(member_key, panel);
            CREATE INDEX IF NOT EXISTS idx_meds_member         ON meds(member_key);
            CREATE INDEX IF NOT EXISTS idx_weight_member       ON weight_log(member_key, date);
            CREATE INDEX IF NOT EXISTS idx_reminders_member    ON reminders(member_key, date);
            CREATE INDEX IF NOT EXISTS idx_attachments_member  ON attachments(member_key, date);
            """
        )
