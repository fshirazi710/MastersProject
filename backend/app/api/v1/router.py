from fastapi import APIRouter
from app.api.v1.endpoints import secret_holders, elections, health

api_router = APIRouter()

api_router.include_router(
    secret_holders.router,
    prefix="/secret-holders",
    tags=["secret-holders"]
)

api_router.include_router(
    elections.router,
    prefix="/elections",
    tags=["elections"]
)

api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"]
) 