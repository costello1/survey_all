from __future__ import annotations

import csv
import json
from datetime import datetime, timezone
from pathlib import Path

from ..database import get_response_records, get_survey_by_id


def sync_survey_exports(survey_id: int) -> None:
    survey = get_survey_by_id(survey_id)
    if survey is None:
        return

    records = get_response_records(survey_id)
    export_dir = Path(survey["storage_path"])
    export_dir.mkdir(parents=True, exist_ok=True)

    survey_payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "survey": survey,
    }
    (export_dir / "survey.json").write_text(json.dumps(survey_payload, indent=2), encoding="utf-8")

    responses_payload = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "survey_id": survey["id"],
        "survey_title": survey["title"],
        "responses": [
            {
                "response_id": record["response_id"],
                "submitted_at": record["submitted_at"],
                "answers": record["answers"],
            }
            for record in records
        ],
    }
    (export_dir / "responses.json").write_text(json.dumps(responses_payload, indent=2), encoding="utf-8")

    fieldnames = ["response_id", "submitted_at", *[question["prompt"] for question in survey["questions"]]]
    with (export_dir / "responses.csv").open("w", encoding="utf-8", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            row = {
                "response_id": record["response_id"],
                "submitted_at": record["submitted_at"],
                **record["flat_answers"],
            }
            writer.writerow(row)
