from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    STANDARD = "standard"


class InstanceType(str, Enum):
    PRODUCTION = "production"
    STAGING = "staging"
    DEVELOPMENT = "development"


class InstanceStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
