"""Upload documents to AWS S3, or fall back to on-disk storage if AWS is unset.

Writing locally means the API can be exercised end-to-end before the user
provisions S3 credentials. The local URL uses `/local-files/...` so the
FastAPI app can mount a StaticFiles route over it later if desired.
"""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote

from config import settings

_LOCAL_ROOT = Path(__file__).resolve().parent.parent / "uploads"


def _have_aws() -> bool:
    return bool(settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY)


def _s3_client():
    import boto3

    return boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
        endpoint_url=f"https://s3.{settings.AWS_REGION}.amazonaws.com",
    )


async def upload_file(
    file_bytes: bytes,
    filename: str,
    user_id: str,
    content_type: str = "application/octet-stream",
) -> str:
    """Return a URL at which the uploaded file can be referenced."""
    key = f"documents/{user_id}/{filename}"

    if _have_aws():
        client = _s3_client()
        client.put_object(
            Bucket=settings.AWS_S3_BUCKET,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"

    # Local fallback — good enough for dev / when no AWS account yet
    dest = _LOCAL_ROOT / user_id
    dest.mkdir(parents=True, exist_ok=True)
    out_path = dest / filename
    out_path.write_bytes(file_bytes)
    rel = f"{user_id}/{quote(filename)}"
    return f"/local-files/{rel}"


async def upload_pdf(file_bytes: bytes, filename: str, user_id: str) -> str:
    return await upload_file(file_bytes, filename, user_id, "application/pdf")


def get_presigned_url(key: str, expiry_s: int = 3600) -> str:
    if not _have_aws():
        return f"/local-files/{key}"
    client = _s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_S3_BUCKET, "Key": key},
        ExpiresIn=expiry_s,
    )


def presign_file_url(file_url: str) -> str:
    """If file_url is an S3 URL, return a presigned URL; otherwise return as-is."""
    if not file_url:
        return file_url
    prefix = ".amazonaws.com/"
    if prefix in file_url:
        if not _have_aws():
            # AWS keys not configured — return original URL as-is
            return file_url
        key = file_url.split(prefix, 1)[1]
        return get_presigned_url(key)
    return file_url
