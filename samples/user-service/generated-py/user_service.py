from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Optional
from nexusrpc import service, Operation


class GetUserInput(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")
    """User ID for the user."""


class User(BaseModel):
    """A user."""

    email: Optional[str] = None
    """Email for the user."""

    user_id: Optional[str] = Field(None, serialization_alias="userId")
    """User ID for the user."""


class GetUserOutput(BaseModel):
    user: User


class SetUserInput(BaseModel):
    user: User


class SetUserOutput(BaseModel):
    user: User


class DeleteUserInput(BaseModel):
    user_id: str = Field(..., serialization_alias="userId")
    """User ID for the user."""


@service
class UserService:
    """A service for managing users."""

    get_user: Operation[GetUserInput, GetUserOutput] = Operation(name="getUser")
    """Get a user."""

    set_user: Operation[SetUserInput, SetUserOutput] = Operation(name="setUser")
    """Create or update a user."""

    delete_user: Operation[DeleteUserInput, None] = Operation(name="deleteUser")
    """Delete a user."""
