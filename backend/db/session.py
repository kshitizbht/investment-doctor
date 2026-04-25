import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

_password = os.getenv("MYSQL_PASSWORD", "")
_userinfo = f"root:{_password}" if _password else "root"
DATABASE_URL = f"mysql+pymysql://{_userinfo}@127.0.0.1:3306/investment_doctor"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
