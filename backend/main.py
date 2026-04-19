import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from database import init_db
from routers import attachments, labs, meds, members, reminders, visits, weight


app = FastAPI(title="家庭健康档案 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


@app.on_event("startup")
def startup() -> None:
    init_db()


app.include_router(members.router, prefix="/api")
app.include_router(visits.router, prefix="/api")
app.include_router(labs.router, prefix="/api")
app.include_router(meds.router, prefix="/api")
app.include_router(weight.router, prefix="/api")
app.include_router(reminders.router, prefix="/api")
app.include_router(attachments.router, prefix="/api")


@app.get("/")
def serve_index() -> FileResponse:
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


app.mount("/", StaticFiles(directory=FRONTEND_DIR), name="frontend")
