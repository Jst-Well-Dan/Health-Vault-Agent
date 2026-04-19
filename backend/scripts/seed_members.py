import json
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from database import get_conn, init_db  # noqa: E402


MEMBERS = [
    {
        "key": "chunzi",
        "name": "春子",
        "full_name": "杨昭春子",
        "initial": "春",
        "birth_date": "1997-03-21",
        "sex": "女",
        "blood_type": None,
        "role": "本人",
        "species": "human",
        "chip_id": None,
        "doctor": None,
        "allergies": [],
        "chronic": ["支气管哮喘", "过敏性鼻炎"],
        "notes": None,
    },
    {
        "key": "kaixin",
        "name": "开心",
        "full_name": "开心",
        "initial": "开",
        "birth_date": "2020-09-01",
        "sex": "雌",
        "blood_type": None,
        "role": "猫咪",
        "species": "cat",
        "chip_id": None,
        "doctor": None,
        "allergies": [],
        "chronic": [],
        "notes": None,
    },
    {
        "key": "boniu",
        "name": "波妞",
        "full_name": "波妞",
        "initial": "波",
        "birth_date": "2025-05-01",
        "sex": "雌",
        "blood_type": None,
        "role": "猫咪",
        "species": "cat",
        "chip_id": None,
        "doctor": None,
        "allergies": [],
        "chronic": [],
        "notes": None,
    },
]


def main() -> None:
    init_db()
    with get_conn() as conn:
        for item in MEMBERS:
            conn.execute(
                """
                INSERT OR IGNORE INTO members
                  (key, name, full_name, initial, birth_date, sex, blood_type, role,
                   species, chip_id, doctor, allergies, chronic, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["key"],
                    item["name"],
                    item["full_name"],
                    item["initial"],
                    item["birth_date"],
                    item["sex"],
                    item["blood_type"],
                    item["role"],
                    item["species"],
                    item["chip_id"],
                    item["doctor"],
                    json.dumps(item["allergies"], ensure_ascii=False),
                    json.dumps(item["chronic"], ensure_ascii=False),
                    item["notes"],
                ),
            )
    print(f"Seeded {len(MEMBERS)} members into {BACKEND_DIR.parent / 'data' / 'health.db'}")


if __name__ == "__main__":
    main()
