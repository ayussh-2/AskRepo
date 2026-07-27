from sqlmodel import create_engine, Session
from config import settings

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args={"connect_timeout": 30}
)

def get_session():
    with Session(engine) as session:
        yield session
