from fastapi import APIRouter

from app.api.routes import compute, curves, settings


api_router = APIRouter()
api_router.include_router(curves.router)
api_router.include_router(settings.router)
api_router.include_router(compute.router)
