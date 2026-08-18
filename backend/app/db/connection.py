from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, create_engine, make_url
from sqlalchemy.orm import Session, sessionmaker

from app.config import BACKEND_ROOT

SessionFactory = sessionmaker[Session]


def _prepare_database_directory(database_url: str) -> None:
    url = make_url(database_url)
    if url.get_backend_name() == "sqlite" and url.database not in (None, ":memory:"):
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)


def build_engine(database_url: str) -> Engine:
    _prepare_database_directory(database_url)
    return create_engine(database_url)


def build_session_factory(engine: Engine) -> SessionFactory:
    return sessionmaker(bind=engine, expire_on_commit=False)


@contextmanager
def session_scope(session_factory: SessionFactory) -> Iterator[Session]:
    with session_factory() as session:
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise


def migrate_database(database_url: str) -> None:
    _prepare_database_directory(database_url)
    config = Config(BACKEND_ROOT / "alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url)
    command.upgrade(config, "head")
