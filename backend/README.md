# Factor VIII Dashboard API

FastAPI owns the canonical dashboard defaults and the decay/planner calculations.
SQLite data is created and migrated during application startup.

## Development

From `backend/`:

```bash
uv sync --frozen
cp .env.example .env
uv run --env-file .env uvicorn app.main:create_app --factory
```

Runtime configuration uses required `FACTOR8_`-prefixed environment variables.
Canonical database seed values are defined in `app/db/seed.py`.

## Update seed values on the VPS

The command-line script is `app/db/apply_defaults.py`. Run it inside the
backend container so it uses the deployed environment and database volume.
From the repository root on the VPS (the directory containing `docker-compose.yml`),
after copying or pulling your updated `backend/app/db/seed.py`:

```bash
# Bring down the container
make down
# Rebuild and recreate the backend with the updated seed file.
make build

# Inspect the current seeded curves
make read-seed
# Apply the seed
make apply-seed
# And verify the result.
make read-seed
```

The last three commands also have Makefile shortcuts: `make read-seed`,
`make update-seed`, and `make read-seed`.

Updating overwrites all fields defined in `SEED_CURVES` for matching curve IDs,
including infusion dates. Other curves are left untouched. Settings from
`SEED_SETTINGS` are inserted only when missing; existing setting values are
preserved. Application startup inserts missing curves but does not update
existing ones, so rebuilding or restarting alone does not apply changed values.
The update script requires the seeded curve IDs to already exist; backend startup
creates missing seed records.
