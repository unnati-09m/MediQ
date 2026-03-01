"""
redis_client.py – Async Redis client and ZSET queue helpers
"""
from typing import Optional, List, Tuple
import redis.asyncio as aioredis
from config import settings

# Module-level client (initialised in main.py lifespan)
redis_client: Optional[aioredis.Redis] = None

QUEUE_KEY = "mediq:queue"           # Sorted set of patient IDs by priority score
TOKEN_COUNTER_KEY = "mediq:token"   # Daily auto-incrementing token counter


async def init_redis() -> aioredis.Redis:
    """Connect to Redis and return the client."""
    global redis_client
    redis_client = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    await redis_client.ping()
    return redis_client


async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.aclose()
        redis_client = None


def get_redis() -> aioredis.Redis:
    """FastAPI dependency — returns the global Redis client."""
    if redis_client is None:
        raise RuntimeError("Redis is not initialised. Call init_redis() first.")
    return redis_client


# ─────────────────────── Priority Queue Operations ────────────────────────────

async def add_to_queue(patient_id: int, priority_score: float) -> None:
    """
    Add/update a patient in the Redis sorted set.
    We store -priority_score so that ZRANGE (ascending) returns highest priority first.
    """
    r = get_redis()
    await r.zadd(QUEUE_KEY, {str(patient_id): -priority_score})


async def remove_from_queue(patient_id: int) -> None:
    r = get_redis()
    await r.zrem(QUEUE_KEY, str(patient_id))


async def get_queue_ordered() -> List[Tuple[str, float]]:
    """
    Return list of (patient_id_str, negative_score) ordered by priority (highest first).
    """
    r = get_redis()
    result = await r.zrange(QUEUE_KEY, 0, -1, withscores=True)
    return result


async def get_queue_position(patient_id: int) -> int:
    """Return 1-based position of the patient in the priority queue."""
    r = get_redis()
    rank = await r.zrank(QUEUE_KEY, str(patient_id))
    if rank is None:
        return -1
    return rank + 1  # 1-indexed


async def update_score(patient_id: int, priority_score: float) -> None:
    """Update the priority score for an existing patient."""
    await add_to_queue(patient_id, priority_score)


async def queue_length() -> int:
    r = get_redis()
    return await r.zcard(QUEUE_KEY)


# ────────────────────────── Token Counter Helpers ─────────────────────────────

async def get_next_token() -> int:
    """Atomically increment and return the daily token counter."""
    r = get_redis()
    token = await r.incr(TOKEN_COUNTER_KEY)
    return token


async def reset_token_counter() -> None:
    """Reset token counter to 0 (called at midnight by Celery beat)."""
    r = get_redis()
    await r.set(TOKEN_COUNTER_KEY, 0)


async def clear_queue() -> None:
    """Clear the entire queue (used for daily reset)."""
    r = get_redis()
    await r.delete(QUEUE_KEY)
