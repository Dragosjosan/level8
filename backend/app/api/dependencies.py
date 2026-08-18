from collections.abc import Iterator
from typing import Annotated, cast

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.db.connection import SessionFactory


def get_session(request: Request) -> Iterator[Session]:
    session_factory = cast(SessionFactory, request.app.state.session_factory)
    with session_factory() as session:
        yield session


DatabaseSession = Annotated[Session, Depends(get_session)]
