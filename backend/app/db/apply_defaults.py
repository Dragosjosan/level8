import argparse
from typing import Any

from app.config import get_config
from app.db.connection import (
    build_engine,
    build_session_factory,
    session_scope,
)
from app.db.seed import read_database, update_database

app_config = get_config()
engine = build_engine(app_config.database_url)
session_factory = build_session_factory(engine)


def parse_arguments() -> Any:
    parser = argparse.ArgumentParser(
        description="Script that reads or updates the database seed"
    )
    parser.add_argument("--read", required=False, action="store_true")
    parser.add_argument("--update", required=False, action="store_true")
    args = parser.parse_args()
    return args


def update_seed() -> None:
    with session_scope(session_factory) as session:
        update_database(session)


def read_seed() -> None:
    with session_scope(session_factory) as session:
        read_database(session)


def main():
    args = parse_arguments()
    if args.read:
        read_seed()
    if args.update:
        update_seed()


if __name__ == "__main__":
    main()
