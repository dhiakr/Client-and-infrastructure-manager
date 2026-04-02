from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ProjectAssignment(Base, TimestampMixin):
    __tablename__ = "project_assignments"
    __table_args__ = (UniqueConstraint("user_id", "project_id", name="uq_user_project_assignment"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )

    user = relationship("User", back_populates="assignments")
    project = relationship("Project", back_populates="assignments")
