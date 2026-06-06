from sqlmodel import SQLModel, Field
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, Index
from typing import Optional

class RepoChunk(SQLModel, table=True):
    __tablename__ = "repo_chunks"

    id: Optional[int] = Field(default=None, primary_key=True)
    repo_name: str = Field(index=True)
    commit_sha: str
    file_path: str
    symbol_name: Optional[str] = None
    chunk_text: str
    embedding: Optional[list[float]] = Field(
        default=None, sa_column=Column(Vector(768))
    )

    class Config:
        arbitrary_types_allowed = True