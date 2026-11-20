from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship

from .base import Base


def utcnow():
    return datetime.now(timezone.utc)


def generate_study_id() -> str:
    return f"OSGA-{uuid.uuid4().hex[:8].upper()}"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    full_name = Column(String(128), nullable=True)
    role = Column(String(32), default="researcher", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)

    assessments = relationship("Assessment", back_populates="user", cascade="all, delete-orphan")


class Assessment(Base):
    __tablename__ = "assessments"

    id = Column(String(32), primary_key=True, default=generate_study_id)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(128), nullable=True)
    patient_sex = Column(String(16), nullable=False)  # "male" or "female"
    chronological_age_months = Column(Float, nullable=True)
    reference_bone_age_months = Column(Float, nullable=True)
    image_filename = Column(String(256), nullable=True)
    image_original_width = Column(Integer, nullable=True)
    image_original_height = Column(Integer, nullable=True)
    status = Column(String(32), default="created", nullable=False)  # created, uploaded, completed, failed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", back_populates="assessments")
    result = relationship("AssessmentResult", back_populates="assessment", uselist=False, cascade="all, delete-orphan")


class AssessmentResult(Base):
    __tablename__ = "assessment_results"

    id = Column(Integer, primary_key=True, index=True)
    assessment_id = Column(String(32), ForeignKey("assessments.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    result_source = Column(String(32), default="real_inference", nullable=False)  # "real_inference" | "demonstration"
    
    # Model metadata
    model_name = Column(String(64), nullable=False)
    model_version = Column(String(32), nullable=False)
    checkpoint_id = Column(String(128), nullable=True)
    img_size = Column(Integer, default=384, nullable=False)
    
    # Prediction output
    bone_age_months = Column(Float, nullable=False)
    bone_age_formatted = Column(String(32), nullable=False)
    most_probable_age_months = Column(Float, nullable=False)
    difference_from_chronological_months = Column(Float, nullable=True)
    difference_from_reference_months = Column(Float, nullable=True)
    
    # Uncertainty
    uncertainty_method = Column(String(64), default="ordinal_distribution_std", nullable=False)
    uncertainty_std_months = Column(Float, nullable=False)
    uncertainty_variance = Column(Float, nullable=False)
    interval_95_min = Column(Float, nullable=False)
    interval_95_max = Column(Float, nullable=False)
    needs_review = Column(Boolean, nullable=True)
    calibrated = Column(Boolean, default=False, nullable=False)
    calibration_threshold = Column(Float, nullable=True)
    
    # JSON structures for deep dive pages
    distribution_json = Column(JSON, nullable=False)  # 228 floats
    landmarks_json = Column(JSON, nullable=False)     # list of {node_id, name, x_norm, y_norm, x_orig_px, y_orig_px}
    node_weights_json = Column(JSON, nullable=False)   # dict of {name: weight}
    regions_json = Column(JSON, nullable=True)        # list of {node_id, name, box_px}
    graph_json = Column(JSON, nullable=True)          # {nodes, edges, attention}
    film_json = Column(JSON, nullable=True)           # {gamma_summary, beta_summary, pre_norm, post_norm}
    timing_ms = Column(Float, nullable=False, default=0.0)
    limitations_json = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=utcnow, nullable=False)

    assessment = relationship("Assessment", back_populates="result")


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    event_type = Column(String(64), nullable=False)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=utcnow, nullable=False)
