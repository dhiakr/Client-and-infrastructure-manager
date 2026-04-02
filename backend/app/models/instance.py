from sqlalchemy import Enum as SqlEnum
from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import InstanceStatus, InstanceType


class OdooInstance(Base, TimestampMixin):
    __tablename__ = "instances"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[InstanceType] = mapped_column(SqlEnum(InstanceType), nullable=False)
    status: Mapped[InstanceStatus] = mapped_column(SqlEnum(InstanceStatus), nullable=False)
    url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    project = relationship("Project", back_populates="instances")
