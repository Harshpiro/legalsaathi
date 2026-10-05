import jwt
from fastapi import Header, HTTPException, status
from config import settings

DEV_USER_ID = "dev_user_001"


async def verify_clerk(authorization: str | None = Header(default=None)) -> str:
    """Verify a Clerk JWT and return the Clerk user_id (the `sub` claim).

    When `DEV_MODE=true` the header is ignored and a stable dev user id is
    returned — lets the API be exercised before Clerk keys are provisioned.
    """
    if settings.DEV_MODE:
        return DEV_USER_ID

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Bearer token required",
        )

    token = authorization.split(" ", 1)[1]

    if not settings.CLERK_PEM_PUBLIC_KEY:
        raise HTTPException(500, "CLERK_PEM_PUBLIC_KEY not configured")

    public_key = settings.CLERK_PEM_PUBLIC_KEY.replace("\\n", "\n")

    try:
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(401, "Token missing 'sub' claim")
    return user_id
