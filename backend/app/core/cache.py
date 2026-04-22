from cachetools import TTLCache
from app.core.config import settings

# A single shared TTL cache for Pandas preview results.
# Key:   "{dataset_id}"
# Value: list of dicts (the first 50 rows as JSON-serializable records)
#
# TTL: 300 seconds (5 minutes) — configured in settings
# Max: 100 entries — oldest is evicted when full (LRU behaviour)

preview_cache: TTLCache = TTLCache(
    maxsize=settings.cache_max_size,
    ttl=settings.cache_ttl_seconds,
)
refined_cache = TTLCache(maxsize=50, ttl=300)   # add this line
