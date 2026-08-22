from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.config import AppConfig, get_config
from app.db.connection import (
    build_engine,
    build_session_factory,
    migrate_database,
    session_scope,
)
from app.db.seed import seed_database


def create_app(config: AppConfig | None = None) -> FastAPI:
    app_config = config or get_config()
    engine = build_engine(app_config.database_url)
    session_factory = build_session_factory(engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        migrate_database(app_config.database_url)
        with session_scope(session_factory) as session:
            seed_database(session)
        try:
            yield
        finally:
            engine.dispose()

    app = FastAPI(title=app_config.project_name, lifespan=lifespan)
    app.state.config = app_config
    app.state.session_factory = session_factory
    app.include_router(api_router, prefix=app_config.api_prefix)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(app_config.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    return app
