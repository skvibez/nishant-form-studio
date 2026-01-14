from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, String, Integer, JSON, DateTime, ForeignKey, Text, Enum as SQLEnum
import os
import enum
from datetime import datetime, timezone
import uuid

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql+asyncpg://localhost/pms_forms')

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

class VersionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"

class Template(Base):
    __tablename__ = "templates"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    key = Column(String, unique=True, nullable=False, index=True)
    active_version_id = Column(String, ForeignKey('template_versions.id'), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class TemplateVersion(Base):
    __tablename__ = "template_versions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey('templates.id'), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    file_url = Column(Text, nullable=False)
    dimensions = Column(JSON, nullable=False)
    field_schema = Column(JSON, nullable=False, default=list)
    status = Column(SQLEnum(VersionStatus), default=VersionStatus.DRAFT, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class Submission(Base):
    __tablename__ = "submissions"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = Column(String, ForeignKey('templates.id'), nullable=False, index=True)
    version_id = Column(String, ForeignKey('template_versions.id'), nullable=False, index=True)
    payload = Column(JSON, nullable=False)
    output_url = Column(Text, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()