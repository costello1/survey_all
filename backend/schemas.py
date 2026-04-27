from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


QuestionType = Literal["open_text", "single_choice", "multiple_choice", "single_word"]


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class AdminLoginResponse(BaseModel):
    token: str
    username: str


class QuestionCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=300)
    type: QuestionType
    required: bool = True
    options: list[str] = Field(default_factory=list)

    @field_validator("options")
    @classmethod
    def normalize_options(cls, value: list[str]) -> list[str]:
        return [option.strip() for option in value if option.strip()]


class SurveyCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    questions: list[QuestionCreate] = Field(min_length=1)


class SurveyUpdateRequest(SurveyCreateRequest):
    pass


class QuestionResponse(BaseModel):
    id: int
    prompt: str
    type: QuestionType
    required: bool
    options: list[str]
    position: int


class SurveyListItem(BaseModel):
    id: int
    title: str
    description: str | None
    slug: str
    public_url: str
    created_at: datetime
    status: str
    response_count: int
    public_token: str
    can_edit_questions: bool


class SurveyDetailResponse(BaseModel):
    id: int
    title: str
    description: str | None
    slug: str
    public_token: str
    public_url: str
    created_at: datetime
    status: str
    response_count: int
    can_edit_questions: bool
    storage_path: str
    questions: list[QuestionResponse]


class PublicSurveyResponse(BaseModel):
    id: int
    title: str
    description: str | None
    public_token: str
    questions: list[QuestionResponse]


class SubmittedAnswer(BaseModel):
    question_id: int
    value: Any


class SurveySubmissionRequest(BaseModel):
    answers: list[SubmittedAnswer] = Field(default_factory=list)


class SimpleMessageResponse(BaseModel):
    message: str


class ChoiceCount(BaseModel):
    label: str
    count: int


class TextResponseItem(BaseModel):
    response_id: int
    submitted_at: datetime
    value: str


class WordCount(BaseModel):
    word: str
    count: int


class AnalyticsQuestion(BaseModel):
    id: int
    prompt: str
    type: QuestionType
    options: list[str]
    total_answers: int
    choice_counts: list[ChoiceCount] = Field(default_factory=list)
    text_responses: list[TextResponseItem] = Field(default_factory=list)
    word_counts: list[WordCount] = Field(default_factory=list)


class SurveyAnalyticsResponse(BaseModel):
    survey_id: int
    survey_title: str
    response_count: int
    questions: list[AnalyticsQuestion]


class WordCloudResponse(BaseModel):
    survey_id: int
    survey_title: str
    available_questions: list[QuestionResponse]
    selected_question_id: int | None
    words: list[WordCount]
