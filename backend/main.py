from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import insights, simulate, upload

app = FastAPI(title="Investment Doctor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(insights.router)
app.include_router(simulate.router)
app.include_router(upload.router)


@app.get("/health")
def health():
    return {"status": "ok"}
