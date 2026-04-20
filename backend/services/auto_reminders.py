from __future__ import annotations

import calendar
import json
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from database import get_conn


BASE_DIR = Path(__file__).resolve().parent.parent
RULES_PATH = BASE_DIR / "config" / "reminder_rules.json"


def load_rules() -> list[dict[str, Any]]:
    with RULES_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)
    return data if isinstance(data, list) else []


def preview_auto_reminders(member: str | None = None, today: date | None = None) -> list[dict[str, Any]]:
    current_date = today or date.today()
    rules = [rule for rule in load_rules() if rule.get("enabled", True)]

    with get_conn() as conn:
        members = _load_members(conn, member)
        existing_keys = _load_existing_auto_keys(conn)
        items: list[dict[str, Any]] = []
        for member_row in members:
            for rule in rules:
                item = _build_candidate(conn, member_row, rule, current_date)
                if item and item["auto_key"] not in existing_keys:
                    items.append(item)

    return sorted(items, key=lambda item: (item["date"], item["member_key"], item["rule_key"]))


def sync_auto_reminders(member: str | None = None, today: date | None = None) -> list[dict[str, Any]]:
    items = preview_auto_reminders(member=member, today=today)
    if not items:
        return []

    inserted: list[dict[str, Any]] = []
    with get_conn() as conn:
        for item in items:
            cur = conn.execute(
                """
                INSERT OR IGNORE INTO reminders
                  (member_key, date, title, kind, priority, done, notes, source, rule_key, auto_key)
                VALUES (?, ?, ?, ?, ?, 0, ?, 'auto', ?, ?)
                """,
                (
                    item["member_key"],
                    item["date"],
                    item["title"],
                    item["kind"],
                    item["priority"],
                    item.get("notes"),
                    item["rule_key"],
                    item["auto_key"],
                ),
            )
            if cur.rowcount:
                row = conn.execute("SELECT * FROM reminders WHERE auto_key = ?", (item["auto_key"],)).fetchone()
                if row:
                    inserted.append(dict(row))
    return inserted


def _load_members(conn: Any, member: str | None) -> list[dict[str, Any]]:
    if member:
        rows = conn.execute("SELECT * FROM members WHERE key = ?", (member,)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM members ORDER BY sort_order, created_at, key").fetchall()
    return [dict(row) for row in rows]


def _load_existing_auto_keys(conn: Any) -> set[str]:
    rows = conn.execute(
        "SELECT auto_key FROM reminders WHERE auto_key IS NOT NULL"
    ).fetchall()
    return {row["auto_key"] for row in rows}


def _build_candidate(
    conn: Any,
    member: dict[str, Any],
    rule: dict[str, Any],
    current_date: date,
) -> dict[str, Any] | None:
    if not rule.get("key"):
        return None
    if not _applies_to_member(rule, member):
        return None

    anchor = rule.get("anchor") if isinstance(rule.get("anchor"), dict) else {}
    source = anchor.get("source")
    fallback = anchor.get("fallback")
    anchor_date = _anchor_date(conn, member, source, current_date)
    if anchor_date is None and fallback:
        anchor_date = _anchor_date(conn, member, fallback, current_date)
    if anchor_date is None:
        return None

    due_date = _next_due_date(anchor_date, rule.get("interval"), current_date)
    if due_date is None:
        return None

    return _reminder_from_rule(member["key"], rule, due_date)


def skip_auto_reminder(reminder_id: int) -> dict[str, Any] | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM reminders WHERE id = ?", (reminder_id,)).fetchone()
        if not row:
            return None

        current = dict(row)
        if current.get("source") != "auto" or not current.get("rule_key"):
            raise ValueError("只能跳过自动提醒")

        rule = _rule_by_key(str(current["rule_key"]))
        if not rule:
            raise ValueError("自动提醒规则不存在")

        current_date = _parse_date(current.get("date"))
        if current_date is None:
            raise ValueError("提醒日期无效")

        interval = rule.get("interval") if isinstance(rule.get("interval"), dict) else {}
        try:
            interval_value = int(interval.get("value", 0))
        except (TypeError, ValueError) as exc:
            raise ValueError("自动提醒周期无效") from exc
        next_date = _add_interval(current_date, interval.get("unit"), interval_value)
        if next_date is None:
            raise ValueError("自动提醒周期无效")

        next_item = _reminder_from_rule(current["member_key"], rule, next_date)
        conn.execute(
            "UPDATE reminders SET done = 1, done_at = datetime('now','localtime') WHERE id = ?",
            (reminder_id,),
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO reminders
              (member_key, date, title, kind, priority, done, notes, source, rule_key, auto_key)
            VALUES (?, ?, ?, ?, ?, 0, ?, 'auto', ?, ?)
            """,
            (
                next_item["member_key"],
                next_item["date"],
                next_item["title"],
                next_item["kind"],
                next_item["priority"],
                next_item.get("notes"),
                next_item["rule_key"],
                next_item["auto_key"],
            ),
        )
        next_row = conn.execute("SELECT * FROM reminders WHERE auto_key = ?", (next_item["auto_key"],)).fetchone()
        return dict(next_row) if next_row else None


def _rule_by_key(rule_key: str) -> dict[str, Any] | None:
    for rule in load_rules():
        if rule.get("enabled", True) and str(rule.get("key")) == rule_key:
            return rule
    return None


def _reminder_from_rule(member_key: str, rule: dict[str, Any], due_date: date) -> dict[str, Any]:
    rule_key = str(rule["key"])
    auto_key = f"{member_key}:{rule_key}:{due_date.isoformat()}"
    return {
        "member_key": member_key,
        "date": due_date.isoformat(),
        "title": str(rule.get("title") or rule_key),
        "kind": str(rule.get("kind") or "auto"),
        "priority": str(rule.get("priority") or "normal"),
        "notes": rule.get("notes"),
        "source": "auto",
        "rule_key": rule_key,
        "auto_key": auto_key,
    }


def _applies_to_member(rule: dict[str, Any], member: dict[str, Any]) -> bool:
    applies_to = rule.get("applies_to")
    if not isinstance(applies_to, dict):
        return True

    species = applies_to.get("species")
    if species and member.get("species") not in species:
        return False

    member_keys = applies_to.get("member_keys")
    if member_keys and member.get("key") not in member_keys:
        return False

    return True


def _anchor_date(conn: Any, member: dict[str, Any], source: str | None, current_date: date) -> date | None:
    member_key = member["key"]
    if source == "today":
        return current_date
    if source in {"birth_date", "home_date", "created_at", "member_created_at"}:
        field = "created_at" if source == "member_created_at" else source
        return _parse_date(member.get(field))
    if source == "last_visit":
        return _latest_date(conn, "visits", member_key)
    if source == "last_weight":
        return _latest_date(conn, "weight_log", member_key)
    if source == "last_lab":
        return _latest_date(conn, "lab_results", member_key)
    return None


def _latest_date(conn: Any, table: str, member_key: str) -> date | None:
    row = conn.execute(
        f"SELECT date FROM {table} WHERE member_key = ? ORDER BY date DESC, id DESC LIMIT 1",
        (member_key,),
    ).fetchone()
    return _parse_date(row["date"]) if row else None


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    text = str(value)[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _next_due_date(anchor_date: date, interval: Any, current_date: date) -> date | None:
    if not isinstance(interval, dict):
        return None
    unit = interval.get("unit")
    try:
        value = int(interval.get("value", 0))
    except (TypeError, ValueError):
        return None
    if value <= 0:
        return None

    due_date = _add_interval(anchor_date, unit, value)
    if due_date is None:
        return None

    while True:
        next_date = _add_interval(due_date, unit, value)
        if next_date is None or next_date <= due_date or next_date > current_date:
            break
        due_date = next_date
    return due_date


def _add_interval(source_date: date, unit: str, value: int) -> date | None:
    if unit == "day":
        return source_date + timedelta(days=value)
    if unit == "week":
        return source_date + timedelta(weeks=value)
    if unit == "month":
        return _add_months(source_date, value)
    if unit == "year":
        return _add_months(source_date, value * 12)
    return None


def _add_months(source_date: date, months: int) -> date:
    month_index = source_date.month - 1 + months
    year = source_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(source_date.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)
