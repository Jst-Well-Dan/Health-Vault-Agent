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
        "breed": None,
        "home_date": None,
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
        "birth_date": "2020-08-18",
        "sex": "妹妹",
        "blood_type": None,
        "role": "妹妹",
        "species": "cat",
        "breed": "英国短毛猫",
        "home_date": "2020-12-11",
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
        "birth_date": "2025-04-12",
        "sex": "妹妹",
        "blood_type": None,
        "role": "妹妹",
        "species": "cat",
        "breed": "德文卷毛猫",
        "home_date": "2025-08-08",
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
                   species, breed, home_date, chip_id, doctor, allergies, chronic, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                    item["breed"],
                    item["home_date"],
                    item["chip_id"],
                    item["doctor"],
                    json.dumps(item["allergies"], ensure_ascii=False),
                    json.dumps(item["chronic"], ensure_ascii=False),
                    item["notes"],
                ),
            )
            conn.execute(
                """
                UPDATE members
                SET name = ?,
                    full_name = ?,
                    initial = ?,
                    birth_date = ?,
                    sex = ?,
                    blood_type = ?,
                    role = ?,
                    species = ?,
                    breed = ?,
                    home_date = ?,
                    allergies = ?,
                    chronic = ?,
                    updated_at = datetime('now','localtime')
                WHERE key = ?
                """,
                (
                    item["name"],
                    item["full_name"],
                    item["initial"],
                    item["birth_date"],
                    item["sex"],
                    item["blood_type"],
                    item["role"],
                    item["species"],
                    item["breed"],
                    item["home_date"],
                    json.dumps(item["allergies"], ensure_ascii=False),
                    json.dumps(item["chronic"], ensure_ascii=False),
                    item["key"],
                ),
            )
    print(f"Seeded {len(MEMBERS)} members into {BACKEND_DIR.parent / 'data' / 'health.db'}")


if __name__ == "__main__":
    main()
