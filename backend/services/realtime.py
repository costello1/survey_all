from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any


class SurveyEventBus:
    def __init__(self) -> None:
        self._subscribers: dict[int, list[asyncio.Queue[dict[str, Any]]]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def subscribe(self, survey_id: int) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        async with self._lock:
            self._subscribers[survey_id].append(queue)
        return queue

    async def unsubscribe(self, survey_id: int, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(survey_id, [])
            if queue in subscribers:
                subscribers.remove(queue)
            if not subscribers and survey_id in self._subscribers:
                del self._subscribers[survey_id]

    async def publish(self, survey_id: int, payload: dict[str, Any]) -> None:
        async with self._lock:
            subscribers = list(self._subscribers.get(survey_id, []))
        for queue in subscribers:
            await queue.put(payload)


event_bus = SurveyEventBus()
