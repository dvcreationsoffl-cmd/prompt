from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.database import engine, migrate_db
from backend.routers import announcements, attendance, auth, events, feedback, registrations, reports

# Automatically apply database schema upgrades
migrate_db(engine)

app = FastAPI(title="College Event Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(events.router)
app.include_router(registrations.router)
app.include_router(attendance.router)
app.include_router(reports.router)
app.include_router(feedback.router)
app.include_router(announcements.router)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    first = exc.errors()[0]
    loc = first.get("loc", ["field"])[-1]
    msg = first.get("msg", "Invalid input.")
    return JSONResponse(status_code=422, content={"detail": f"{loc}: {msg}"})


FRONTEND_DIR = Path(__file__).resolve().parent.parent / "Frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
