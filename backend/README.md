# Factor VIII Dashboard API

FastAPI owns the canonical dashboard defaults and the decay/Pareto calculations.
SQLite data is created and migrated during application startup.

## Development

From `backend/`:

```bash
uv sync --frozen
cp .env.example .env
uv run --env-file .env uvicorn app.main:create_app --factory
```

Configuration uses required `FACTOR8_`-prefixed environment variables. The
application has no runtime or canonical seed defaults in source code.
