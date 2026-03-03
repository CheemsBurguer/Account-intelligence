import asyncio
import os
import sys

# Add project root to path to import app modules if running outside container context
# But we will run this INSIDE the container.
sys.path.append("/app")

async def force_create_test_user():
    from app.db.database import sessionLocal
    from app.crud.user import user_crud
    from app.core.security import hash_password
    from app.models.user import User
    from sqlalchemy import select
    from app.models.user_role import UserRole

    async with sessionLocal() as db:
        # Check if user exists
        existing = await user_crud.get_by_email(db, "test@hpe.com")
        if existing:
            print(f"User test@hpe.com already exists.")
            return

        # Get the 'user' role
        role_result = await db.execute(select(UserRole).where(UserRole.name == "user"))
        role = role_result.scalar_one_or_none()
        if not role:
            print("Role 'user' not found. Seeding roles...")
            role = UserRole(name="user", description="Standard user")
            db.add(role)
            await db.flush()

        user_dict = {
            "email": "test@hpe.com",
            "hashed_password": hash_password("testpass123"),
            "first_name": "Test",
            "last_name": "User",
            "region_id": 1,
            "role_id": role.id
        }
        
        # User model in app might require role_id or use default
        new_user = User(**user_dict)
        db.add(new_user)
        try:
            await db.commit()
            print("User test@hpe.com created successfully.")
        except Exception as e:
            print(f"Error creating user: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(force_create_test_user())
