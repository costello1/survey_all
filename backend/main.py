from __future__ import annotations

import asyncio
import io
import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from pathlib import Path

import qrcode
import qrcode.image.svg
from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response, StreamingResponse

from .auth import create_admin_token, require_admin, security, verify_admin_token
from .config import get_settings
from .database import (
    create_response,
    create_survey,
    delete_survey,
    duplicate_survey,
    get_export_file_path,
    get_public_survey,
    get_survey_analytics,
    get_survey_by_id,
    get_word_cloud_data,
    initialize_database,
    list_surveys,
    set_survey_status,
    update_survey,
    validate_submission,
)
from .schemas import (
    AdminLoginRequest,
    AdminLoginResponse,
    PublicSurveyResponse,
    SimpleMessageResponse,
    SurveyAnalyticsResponse,
    SurveyCreateRequest,
    SurveyDetailResponse,
    SurveyListItem,
    SurveySubmissionRequest,
    SurveyUpdateRequest,
    WordCloudResponse,
)
from .services.exporter import sync_survey_exports
from .services.realtime import event_bus


app = FastAPI(title="Survey Platform API", version="1.0.0")
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def admin_user(credentials=Depends(security)) -> str:
    return require_admin(credentials)


def admin_event_user(
    credentials=Depends(security),
    token: str | None = Query(default=None),
) -> str:
    if token:
        return verify_admin_token(token)
    return require_admin(credentials)


@app.on_event("startup")
def on_startup() -> None:
    initialize_database()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)


def _assert_question_shape(payload: SurveyCreateRequest) -> None:
    for question in payload.questions:
        if question.type in {"single_choice", "multiple_choice"} and len(question.options) < 2:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' requires at least two options.",
            )
        if question.type in {"open_text", "single_word"} and question.options:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Question '{question.prompt}' cannot define options.",
            )


def _create_qr_svg(url: str) -> str:
    image = qrcode.make(url, image_factory=qrcode.image.svg.SvgPathImage, box_size=8, border=2)
    buffer = io.BytesIO()
    image.save(buffer)
    return buffer.getvalue().decode("utf-8")


def _load_survey_or_404(survey_id: int) -> dict:
    survey = get_survey_by_id(survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    return survey


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/admin/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest) -> AdminLoginResponse:
    if payload.username != settings.admin_username or payload.password != settings.admin_password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")
    return AdminLoginResponse(token=create_admin_token(payload.username), username=payload.username)


@app.get("/api/admin/me")
def admin_me(_: str = Depends(admin_user)) -> dict[str, str]:
    return {"username": settings.admin_username}


@app.get("/api/admin/surveys", response_model=list[SurveyListItem])
def admin_list_surveys(_: str = Depends(admin_user)) -> list[SurveyListItem]:
    return [SurveyListItem.model_validate(item) for item in list_surveys()]


@app.post("/api/admin/surveys", response_model=SurveyDetailResponse, status_code=status.HTTP_201_CREATED)
def admin_create_survey(payload: SurveyCreateRequest, _: str = Depends(admin_user)) -> SurveyDetailResponse:
    _assert_question_shape(payload)
    survey = create_survey(
        title=payload.title,
        description=payload.description,
        questions=[question.model_dump() for question in payload.questions],
    )
    sync_survey_exports(survey["id"])
    return SurveyDetailResponse.model_validate(survey)


@app.get("/api/admin/surveys/{survey_id}", response_model=SurveyDetailResponse)
def admin_get_survey(survey_id: int, _: str = Depends(admin_user)) -> SurveyDetailResponse:
    return SurveyDetailResponse.model_validate(_load_survey_or_404(survey_id))


@app.put("/api/admin/surveys/{survey_id}", response_model=SurveyDetailResponse)
def admin_update_survey(
    survey_id: int,
    payload: SurveyUpdateRequest,
    _: str = Depends(admin_user),
) -> SurveyDetailResponse:
    _assert_question_shape(payload)
    try:
        survey = update_survey(
            survey_id=survey_id,
            title=payload.title,
            description=payload.description,
            questions=[question.model_dump() for question in payload.questions],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc

    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")

    sync_survey_exports(survey_id)
    return SurveyDetailResponse.model_validate(survey)


@app.post("/api/admin/surveys/{survey_id}/duplicate", response_model=SurveyDetailResponse, status_code=status.HTTP_201_CREATED)
def admin_duplicate_survey(survey_id: int, _: str = Depends(admin_user)) -> SurveyDetailResponse:
    survey = duplicate_survey(survey_id)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    sync_survey_exports(survey["id"])
    return SurveyDetailResponse.model_validate(survey)


@app.post("/api/admin/surveys/{survey_id}/archive", response_model=SurveyDetailResponse)
def admin_archive_survey(survey_id: int, _: str = Depends(admin_user)) -> SurveyDetailResponse:
    survey = set_survey_status(survey_id, "archived")
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    sync_survey_exports(survey_id)
    return SurveyDetailResponse.model_validate(survey)


@app.post("/api/admin/surveys/{survey_id}/activate", response_model=SurveyDetailResponse)
def admin_activate_survey(survey_id: int, _: str = Depends(admin_user)) -> SurveyDetailResponse:
    survey = set_survey_status(survey_id, "active")
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    sync_survey_exports(survey_id)
    return SurveyDetailResponse.model_validate(survey)


@app.delete("/api/admin/surveys/{survey_id}", response_model=SimpleMessageResponse)
def admin_delete_survey(survey_id: int, _: str = Depends(admin_user)) -> SimpleMessageResponse:
    if not delete_survey(survey_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    return SimpleMessageResponse(message="Survey deleted successfully.")


@app.get("/api/admin/surveys/{survey_id}/qr")
def admin_get_survey_qr(survey_id: int, _: str = Depends(admin_user)) -> Response:
    survey = _load_survey_or_404(survey_id)
    return Response(content=_create_qr_svg(survey["public_url"]), media_type="image/svg+xml")


@app.get("/api/admin/surveys/{survey_id}/exports/{filename}")
def admin_download_export(survey_id: int, filename: str, _: str = Depends(admin_event_user)) -> FileResponse:
    _load_survey_or_404(survey_id)
    sync_survey_exports(survey_id)
    file_path = get_export_file_path(survey_id, filename)
    if file_path is None or not file_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Export file not found.")
    return FileResponse(path=file_path, filename=Path(filename).name)


@app.get("/api/admin/surveys/{survey_id}/analytics", response_model=SurveyAnalyticsResponse)
def admin_get_analytics(survey_id: int, _: str = Depends(admin_user)) -> SurveyAnalyticsResponse:
    analytics = get_survey_analytics(survey_id)
    if analytics is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    return SurveyAnalyticsResponse.model_validate(analytics)


@app.get("/api/admin/surveys/{survey_id}/word-cloud", response_model=WordCloudResponse)
def admin_get_word_cloud(
    survey_id: int,
    question_id: int | None = Query(default=None),
    _: str = Depends(admin_user),
) -> WordCloudResponse:
    data = get_word_cloud_data(survey_id, question_id=question_id)
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    return WordCloudResponse.model_validate(data)


@app.get("/api/admin/surveys/{survey_id}/events")
async def admin_survey_events(survey_id: int, _: str = Depends(admin_event_user)) -> StreamingResponse:
    if get_survey_by_id(survey_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")

    async def event_stream() -> AsyncGenerator[str, None]:
        queue = await event_bus.subscribe(survey_id)
        try:
            yield f"data: {json.dumps({'type': 'connected', 'timestamp': datetime.now(timezone.utc).isoformat()})}\n\n"
            while True:
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    keepalive = {"type": "keepalive", "timestamp": datetime.now(timezone.utc).isoformat()}
                    yield f"data: {json.dumps(keepalive)}\n\n"
                    continue
                yield f"data: {json.dumps(payload)}\n\n"
        finally:
            await event_bus.unsubscribe(survey_id, queue)

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.get("/api/public/surveys/{public_token}", response_model=PublicSurveyResponse)
def public_get_survey(public_token: str) -> PublicSurveyResponse:
    survey = get_public_survey(public_token)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")
    return PublicSurveyResponse.model_validate(survey)


@app.post("/api/public/surveys/{public_token}/responses", response_model=SimpleMessageResponse, status_code=status.HTTP_201_CREATED)
async def public_submit_survey(public_token: str, payload: SurveySubmissionRequest) -> SimpleMessageResponse:
    survey = get_public_survey(public_token)
    if survey is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Survey not found.")

    try:
        normalized_answers = validate_submission(survey, [answer.model_dump() for answer in payload.answers])
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    create_response(survey["id"], normalized_answers)
    sync_survey_exports(survey["id"])
    await event_bus.publish(
        survey["id"],
        {
            "type": "response_submitted",
            "survey_id": survey["id"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )
    return SimpleMessageResponse(message="Thank you")
