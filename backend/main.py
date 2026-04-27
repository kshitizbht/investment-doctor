from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import account, ask_claude, auth, insights, net_worth, simulate

app = FastAPI(title="Investment Doctor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(insights.router)
app.include_router(simulate.router)
app.include_router(net_worth.router)
app.include_router(ask_claude.router)
app.include_router(auth.router)
app.include_router(account.router)


@app.get("/health")
def health():
    return {"status": "ok"}
