from __future__ import annotations

import json
import re
import secrets
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import get_settings


def get_connection() -> sqlite3.Connection:
    settings = get_settings()
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(settings.database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS surveys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                slug TEXT NOT NULL UNIQUE,
                public_token TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                storage_path TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                survey_id INTEGER NOT NULL,
                position INTEGER NOT NULL,
                prompt TEXT NOT NULL,
                type TEXT NOT NULL,
                required INTEGER NOT NULL DEFAULT 1,
                options_json TEXT NOT NULL DEFAULT '[]',
                FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                survey_id INTEGER NOT NULL,
                submitted_at TEXT NOT NULL,
                FOREIGN KEY (survey_id) REFERENCES surveys (id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                response_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                value_json TEXT NOT NULL,
                FOREIGN KEY (response_id) REFERENCES responses (id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_questions_survey_id ON questions (survey_id);
            CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON responses (survey_id);
            CREATE INDEX IF NOT EXISTS idx_answers_response_id ON answers (response_id);
            CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers (question_id);
            """
        )


def slugify(value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return cleaned or "survey"


def _public_url(slug: str) -> str:
    return f"{get_settings().public_app_url.rstrip('/')}/{slug}"


def _make_storage_path(slug: str, created_at: str) -> str:
    timestamp = (
        created_at.replace("-", "")
        .replace(":", "")
        .replace("T", "_")
        .replace("+00:00", "Z")
        .replace(".", "")
    )
    path = get_settings().storage_dir / f"{slug}_{timestamp}"
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


def _ensure_unique_slug(connection: sqlite3.Connection, base_slug: str) -> str:
    slug = base_slug
    counter = 2
    while connection.execute("SELECT 1 FROM surveys WHERE slug = ?", (slug,)).fetchone():
        slug = f"{base_slug}-{counter}"
        counter += 1
    return slug


def _serialize_question(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "prompt": row["prompt"],
        "type": row["type"],
        "required": bool(row["required"]),
        "options": json.loads(row["options_json"] or "[]"),
        "position": row["position"],
    }


def _get_questions(connection: sqlite3.Connection, survey_id: int) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT id, prompt, type, required, options_json, position
        FROM questions
        WHERE survey_id = ?
        ORDER BY position ASC, id ASC
        """,
        (survey_id,),
    ).fetchall()
    return [_serialize_question(row) for row in rows]


def list_surveys() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                s.id,
                s.title,
                s.description,
                s.slug,
                s.created_at,
                s.status,
                s.public_token,
                COUNT(r.id) AS response_count
            FROM surveys s
            LEFT JOIN responses r ON r.survey_id = s.id
            GROUP BY s.id
            ORDER BY s.created_at DESC
            """
        ).fetchall()
        surveys = []
        for row in rows:
            survey = dict(row)
            survey["public_url"] = _public_url(survey["slug"])
            survey["can_edit_questions"] = survey["response_count"] == 0
            surveys.append(survey)
        return surveys


def get_survey_by_id(survey_id: int) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT
                s.id,
                s.title,
                s.description,
                s.slug,
                s.public_token,
                s.created_at,
                s.status,
                s.storage_path,
                COUNT(r.id) AS response_count
            FROM surveys s
            LEFT JOIN responses r ON r.survey_id = s.id
            WHERE s.id = ?
            GROUP BY s.id
            """,
            (survey_id,),
        ).fetchone()
        if row is None:
            return None

        survey = dict(row)
        survey["public_url"] = _public_url(survey["slug"])
        survey["can_edit_questions"] = survey["response_count"] == 0
        survey["questions"] = _get_questions(connection, survey_id)
        return survey


def get_public_survey(slug_or_token: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, title, description, slug, public_token
            FROM surveys
            WHERE (slug = ? OR public_token = ?) AND status = 'active'
            """,
            (slug_or_token, slug_or_token),
        ).fetchone()
        if row is None:
            return None

        survey = dict(row)
        survey["questions"] = _get_questions(connection, row["id"])
        return survey


def create_survey(title: str, description: str | None, questions: list[dict[str, Any]]) -> dict[str, Any]:
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        slug = _ensure_unique_slug(connection, slugify(title))
        public_token = secrets.token_urlsafe(10)
        storage_path = _make_storage_path(slug, created_at)

        cursor = connection.execute(
            """
            INSERT INTO surveys (title, description, slug, public_token, created_at, status, storage_path)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (title.strip(), description.strip() if description else None, slug, public_token, created_at, "active", storage_path),
        )
        survey_id = cursor.lastrowid

        for position, question in enumerate(questions, start=1):
            connection.execute(
                """
                INSERT INTO questions (survey_id, position, prompt, type, required, options_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    survey_id,
                    position,
                    question["prompt"].strip(),
                    question["type"],
                    1 if question.get("required", True) else 0,
                    json.dumps(question.get("options", [])),
                ),
            )

    survey = get_survey_by_id(survey_id)
    if survey is None:
        raise RuntimeError("Survey creation failed.")
    return survey


def update_survey(survey_id: int, title: str, description: str | None, questions: list[dict[str, Any]]) -> dict[str, Any] | None:
    with get_connection() as connection:
        survey_row = connection.execute(
            """
            SELECT id, response_count FROM (
                SELECT s.id, COUNT(r.id) AS response_count
                FROM surveys s
                LEFT JOIN responses r ON r.survey_id = s.id
                WHERE s.id = ?
                GROUP BY s.id
            )
            """,
            (survey_id,),
        ).fetchone()
        if survey_row is None:
            return None

        connection.execute(
            """
            UPDATE surveys
            SET title = ?, description = ?
            WHERE id = ?
            """,
            (title.strip(), description.strip() if description else None, survey_id),
        )

        if survey_row["response_count"] == 0:
            connection.execute("DELETE FROM questions WHERE survey_id = ?", (survey_id,))

            for position, question in enumerate(questions, start=1):
                connection.execute(
                    """
                    INSERT INTO questions (survey_id, position, prompt, type, required, options_json)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        survey_id,
                        position,
                        question["prompt"].strip(),
                        question["type"],
                        1 if question.get("required", True) else 0,
                        json.dumps(question.get("options", [])),
                    ),
                )

    return get_survey_by_id(survey_id)


def duplicate_survey(survey_id: int) -> dict[str, Any] | None:
    survey = get_survey_by_id(survey_id)
    if survey is None:
        return None

    duplicate_title = f"{survey['title']} Copy"
    questions = [
        {
            "prompt": question["prompt"],
            "type": question["type"],
            "required": question["required"],
            "options": question["options"],
        }
        for question in survey["questions"]
    ]
    return create_survey(duplicate_title, survey["description"], questions)


def set_survey_status(survey_id: int, status: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE surveys
            SET status = ?
            WHERE id = ?
            """,
            (status, survey_id),
        )
        if cursor.rowcount == 0:
            return None
    return get_survey_by_id(survey_id)


def delete_survey(survey_id: int) -> bool:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM surveys WHERE id = ?", (survey_id,))
        return cursor.rowcount > 0


def get_export_file_path(survey_id: int, filename: str) -> Path | None:
    if filename not in {"survey.json", "responses.json", "responses.csv"}:
        return None

    survey = get_survey_by_id(survey_id)
    if survey is None:
        return None

    return Path(survey["storage_path"]) / filename


def get_response_records(survey_id: int) -> list[dict[str, Any]]:
    with get_connection() as connection:
        questions = _get_questions(connection, survey_id)

        response_rows = connection.execute(
            """
            SELECT id, submitted_at
            FROM responses
            WHERE survey_id = ?
            ORDER BY submitted_at DESC, id DESC
            """,
            (survey_id,),
        ).fetchall()

        answer_rows = connection.execute(
            """
            SELECT a.response_id, a.question_id, a.value_json
            FROM answers a
            INNER JOIN responses r ON r.id = a.response_id
            WHERE r.survey_id = ?
            ORDER BY a.question_id ASC
            """,
            (survey_id,),
        ).fetchall()

    answers_by_response: dict[int, dict[int, Any]] = defaultdict(dict)
    for row in answer_rows:
        answers_by_response[row["response_id"]][row["question_id"]] = json.loads(row["value_json"])

    records: list[dict[str, Any]] = []
    for response_row in response_rows:
        answer_map = answers_by_response.get(response_row["id"], {})
        answers = []
        flat_answers: dict[str, str] = {}
        for question in questions:
            value = answer_map.get(question["id"])
            if value is None:
                flat_answers[question["prompt"]] = ""
                continue
            display_value = ", ".join(value) if isinstance(value, list) else str(value)
            flat_answers[question["prompt"]] = display_value
            answers.append(
                {
                    "question_id": question["id"],
                    "prompt": question["prompt"],
                    "type": question["type"],
                    "value": value,
                }
            )

        records.append(
            {
                "response_id": response_row["id"],
                "submitted_at": response_row["submitted_at"],
                "answers": answers,
                "flat_answers": flat_answers,
            }
        )
    return records


def validate_submission(survey: dict[str, Any], answers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    question_lookup = {question["id"]: question for question in survey["questions"]}
    submitted_lookup: dict[int, Any] = {}

    for answer in answers:
        question_id = int(answer["question_id"])
        if question_id not in question_lookup:
            raise ValueError("The submission contains an unknown question.")
        if question_id in submitted_lookup:
            raise ValueError("Each question can be answered only once.")
        submitted_lookup[question_id] = answer.get("value")

    normalized_answers: list[dict[str, Any]] = []
    for question in survey["questions"]:
        value = submitted_lookup.get(question["id"])
        if value in (None, "", []):
            if question["required"]:
                raise ValueError(f"Question '{question['prompt']}' is required.")
            continue

        question_type = question["type"]
        if question_type == "open_text":
            if not isinstance(value, str):
                raise ValueError(f"Question '{question['prompt']}' expects text.")
            normalized = value.strip()
            if question["required"] and not normalized:
                raise ValueError(f"Question '{question['prompt']}' is required.")
            if not normalized:
                continue

        elif question_type == "single_word":
            if not isinstance(value, str):
                raise ValueError(f"Question '{question['prompt']}' expects a single word.")
            normalized = value.strip()
            if not normalized or len(normalized.split()) != 1:
                raise ValueError(f"Question '{question['prompt']}' accepts one word only.")

        elif question_type == "single_choice":
            if not isinstance(value, str):
                raise ValueError(f"Question '{question['prompt']}' expects one selected option.")
            normalized = value.strip()
            if normalized not in question["options"]:
                raise ValueError(f"Question '{question['prompt']}' contains an invalid option.")

        elif question_type == "multiple_choice":
            if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                raise ValueError(f"Question '{question['prompt']}' expects multiple selected options.")
            normalized = [item.strip() for item in value if item.strip()]
            if question["required"] and not normalized:
                raise ValueError(f"Question '{question['prompt']}' requires at least one option.")
            invalid = [item for item in normalized if item not in question["options"]]
            if invalid:
                raise ValueError(f"Question '{question['prompt']}' contains an invalid option.")
            if not normalized:
                continue

        else:
            raise ValueError("Unsupported question type.")

        normalized_answers.append({"question_id": question["id"], "value": normalized})

    return normalized_answers


def create_response(survey_id: int, answers: list[dict[str, Any]]) -> int:
    submitted_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO responses (survey_id, submitted_at)
            VALUES (?, ?)
            """,
            (survey_id, submitted_at),
        )
        response_id = cursor.lastrowid

        for answer in answers:
            connection.execute(
                """
                INSERT INTO answers (response_id, question_id, value_json)
                VALUES (?, ?, ?)
                """,
                (response_id, answer["question_id"], json.dumps(answer["value"])),
            )

    return response_id


def get_survey_analytics(survey_id: int) -> dict[str, Any] | None:
    survey = get_survey_by_id(survey_id)
    if survey is None:
        return None

    records = get_response_records(survey_id)
    answers_by_question: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        for answer in record["answers"]:
            answers_by_question[answer["question_id"]].append(
                {
                    "response_id": record["response_id"],
                    "submitted_at": record["submitted_at"],
                    "value": answer["value"],
                }
            )

    questions: list[dict[str, Any]] = []
    for question in survey["questions"]:
        question_answers = answers_by_question.get(question["id"], [])
        entry: dict[str, Any] = {
            "id": question["id"],
            "prompt": question["prompt"],
            "type": question["type"],
            "options": question["options"],
            "total_answers": len(question_answers),
            "choice_counts": [],
            "text_responses": [],
            "word_counts": [],
        }

        if question["type"] in {"single_choice", "multiple_choice"}:
            counter = Counter()
            for answer in question_answers:
                value = answer["value"]
                counter.update(value if isinstance(value, list) else [value])
            entry["choice_counts"] = [{"label": option, "count": counter.get(option, 0)} for option in question["options"]]
            if question["type"] == "multiple_choice":
                entry["word_counts"] = [
                    {"word": option, "count": counter.get(option, 0)}
                    for option in question["options"]
                    if counter.get(option, 0) > 0
                ]

        elif question["type"] == "open_text":
            entry["text_responses"] = [
                {
                    "response_id": answer["response_id"],
                    "submitted_at": answer["submitted_at"],
                    "value": str(answer["value"]),
                }
                for answer in question_answers
            ]

        elif question["type"] == "single_word":
            counter = Counter()
            for answer in question_answers:
                counter.update([str(answer["value"]).strip().lower()])
            entry["word_counts"] = [
                {"word": word, "count": count}
                for word, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
            ]

        questions.append(entry)

    return {
        "survey_id": survey["id"],
        "survey_title": survey["title"],
        "response_count": survey["response_count"],
        "questions": questions,
    }


def get_word_cloud_data(survey_id: int, question_id: int | None = None) -> dict[str, Any] | None:
    survey = get_survey_by_id(survey_id)
    if survey is None:
        return None

    word_cloud_questions = [
        question for question in survey["questions"] if question["type"] in {"single_word", "multiple_choice"}
    ]
    selected_question = None
    if question_id is not None:
        selected_question = next((question for question in word_cloud_questions if question["id"] == question_id), None)
    if selected_question is None and word_cloud_questions:
        selected_question = word_cloud_questions[0]

    words: list[dict[str, Any]] = []
    analytics = get_survey_analytics(survey_id)
    if analytics and selected_question is not None:
        selected_analytics = next(
            (question for question in analytics["questions"] if question["id"] == selected_question["id"]),
            None,
        )
        if selected_analytics is not None:
            words = selected_analytics["word_counts"]

    return {
        "survey_id": survey["id"],
        "survey_title": survey["title"],
        "available_questions": word_cloud_questions,
        "selected_question_id": selected_question["id"] if selected_question else None,
        "words": words,
    }
