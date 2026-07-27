from sqlmodel import create_engine, Session
from config import settings

db_url = settings.database_url
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"connect_timeout": 30}
)

def get_session():
    with Session(engine) as session:
        yield session
