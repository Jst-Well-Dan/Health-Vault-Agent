import argparse
import os
from pathlib import Path
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("HEALTH_MOCK_MODE", "1")

from database import DB_PATH  # noqa: E402
from mock_data import seed_mock_data  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the public demo dataset.")
    parser.add_argument("--reset", action="store_true", help="Clear existing rows before seeding.")
    args = parser.parse_args()

    seed_mock_data(reset=args.reset)
    print(f"Seeded mock data into {DB_PATH}")


if __name__ == "__main__":
    main()
