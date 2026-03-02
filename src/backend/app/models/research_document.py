from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float
from ..db.database import Base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

class ResearchDocument(Base):
    __tablename__ = "research_documents"

    id = Column(Integer, primary_key=True)
    analysis_id = Column(Integer, ForeignKey("analyses.id"))

    source_type = Column(String(50))  # tavily, scraping, manual
    source_url = Column(Text)
    title = Column(String(255))

    relevance_score = Column(Float, nullable=True)

    raw_content = Column(Text)
    summary = Column(Text)

    embedding_id = Column(String(255))
    content_hash = Column(String(64))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis = relationship("Analysis", back_populates="research_documents")
    insight_sources = relationship("InsightSource", back_populates="research_document", cascade="all, delete-orphan")