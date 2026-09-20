from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging

from backend.database.sqlite import init_database
from backend.database.neo4j_client import init_neo4j
from backend.routers import (
    cases,
    graph,
    replay,
    analytics,
    correlation,
    infrastructure,
    coordination,
    evaluation,
    export,
    notes,
    briefing,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Pragya Chakshu API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router, prefix="/api")
app.include_router(graph.router, prefix="/api")
app.include_router(replay.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(correlation.router, prefix="/api")
app.include_router(infrastructure.router, prefix="/api")
app.include_router(coordination.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(export.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(briefing.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    logger.info("Initializing SQLite database...")
    init_database()
    logger.info("Initializing Neo4j...")
    init_neo4j()
    logger.info("Startup complete.")


@app.get("/health")
def health_check():
    return {"status": "healthy"}
