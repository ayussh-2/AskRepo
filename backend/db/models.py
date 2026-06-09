from sqlmodel import SQLModel, Field
from pgvector.sqlalchemy import Vector
from sqlalchemy import Column, Index, DateTime, func
from typing import Optional
from datetime import datetime, timezone

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


class IngestionStatus(SQLModel, table=True):
    __tablename__ = "ingestion_statuses"

    id: Optional[int] = Field(default=None, primary_key=True)
    repo_name: str = Field(index=True)
    commit_sha: str = Field(index=True)
    status: str = Field(default="pending")  # "pending", "completed", "failed"
    error_message: Optional[str] = Field(default=None, nullable=True)
    created_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now())
    )
    updated_at: Optional[datetime] = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    )

