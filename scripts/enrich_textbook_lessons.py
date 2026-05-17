"""Create student-friendly lesson content and quizzes from imported textbooks.

The raw extraction stays in textbook_pages/textbook_lessons.text_content.
This script cleans the app-facing lessons so students see a compact study
guide instead of long PDF excerpts, then creates a few auto-generated checks.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import Json


SOURCE_TAG = "gurubesar_kssm_textbook"
ENRICHMENT_VERSION = "textbook_enrichment_v1"
QUIZ_MARKER = "[auto:textbook-enrichment:v1]"

NOISE_PREFIXES = (
    "aktiviti",
    "activity",
    "amali",
    "arahan",
    "bab ",
    "chapter ",
    "contoh",
    "diagram",
    "eksperimen",
    "eksplorasi",
    "experiment",
    "figure",
    "formatif",
    "gambar",
    "jadual",
    "jawapan",
    "kandungan",
    "kata kunci",
    "latihan",
    "nota",
    "pemerhatian",
    "perbincangan",
    "praktis",
    "praktis formatif",
    "rajah",
    "refleksi",
    "rumusan",
    "standard pembelajaran",
    "tujuan",
    "uji minda",
)

EXACT_NOISE = {
    "bab",
    "chapter",
    "kpm",
    "unit",
    "tema",
    "theme",
    "pak21",
    "stem",
}

STOPWORDS = {
    "about",
    "above",
    "after",
    "akan",
    "also",
    "anda",
    "antara",
    "apa",
    "apakah",
    "apabila",
    "adalah",
    "are",
    "atau",
    "because",
    "before",
    "bab",
    "bagai",
    "bagi",
    "bahagian",
    "bahawa",
    "bawah",
    "beberapa",
    "berdasarkan",
    "berikut",
    "boleh",
    "can",
    "dalam",
    "dan",
    "dapat",
    "dengan",
    "daripada",
    "dari",
    "each",
    "from",
    "form",
    "has",
    "have",
    "ialah",
    "ini",
    "into",
    "itu",
    "kepada",
    "lesson",
    "less",
    "melalui",
    "mempunyai",
    "more",
    "murid",
    "oleh",
    "only",
    "pada",
    "satu",
    "sebagai",
    "secara",
    "setiap",
    "such",
    "tak",
    "than",
    "that",
    "their",
    "then",
    "there",
    "they",
    "this",
    "tingkatan",
    "under",
    "untuk",
    "where",
    "when",
    "what",
    "which",
    "while",
    "will",
    "with",
    "yang",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=0, help="Only process this many lessons")
    parser.add_argument("--dry-run", action="store_true", help="Preview counts without writing")
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    conn = connect_db()
    try:
        rows = fetch_imported_lessons(conn, limit=args.limit)
        print(f"Loaded {len(rows)} imported textbook lessons")

        totals = {
            "lessons_enriched": 0,
            "questions_created": 0,
            "questions_replaced": 0,
        }
        for row in rows:
            enriched = build_enrichment(row)
            questions = build_quiz_questions(row, enriched)
            if args.dry_run:
                continue

            replaced = apply_enrichment(conn, row, enriched, questions)
            totals["lessons_enriched"] += 1
            totals["questions_created"] += len(questions)
            totals["questions_replaced"] += replaced

        if args.dry_run:
            print("Dry run complete")
        else:
            conn.commit()
            print("Enrichment complete")
            print(totals)
    finally:
        conn.close()

    return 0


def fetch_imported_lessons(conn, limit: int = 0) -> list[dict[str, Any]]:
    query = """
        SELECT
            tl.id AS textbook_lesson_id,
            tl.linked_lesson_id,
            tl.linked_syllabus_item_id,
            tl.title AS textbook_title,
            tl.topic_code,
            tl.topic,
            tl.subtopic,
            tl.subject,
            tl.form_level,
            tl.text_content,
            tl.char_count,
            tl.page_count,
            tl.start_global_page_number,
            tl.end_global_page_number,
            tl.syllabus,
            tl.content AS textbook_content,
            ts.source_key,
            ts.title AS source_title,
            ts.language,
            l.title AS app_title,
            l.content AS app_content,
            l.estimated_minutes
        FROM textbook_lessons tl
        JOIN textbook_sources ts ON ts.id = tl.source_id
        JOIN lessons l ON l.id = tl.linked_lesson_id
        WHERE tl.linked_lesson_id IS NOT NULL
          AND tl.linked_syllabus_item_id IS NOT NULL
          AND l.content->>'source' = %s
        ORDER BY ts.form_level, ts.subject, ts.language, ts.source_key, tl.order_index
    """
    params: list[Any] = [SOURCE_TAG]
    if limit > 0:
        query += " LIMIT %s"
        params.append(limit)

    with conn.cursor() as cur:
        cur.execute(query, params)
        columns = [item.name for item in cur.description]
        return [dict(zip(columns, row)) for row in cur.fetchall()]


def build_enrichment(row: dict[str, Any]) -> dict[str, Any]:
    title = clean_display_title(row["textbook_title"])
    concept = strip_topic_code(title)
    lines = clean_text_lines(row.get("text_content") or "")
    sentences = extract_sentences(lines)
    key_terms = extract_key_terms(title, lines)
    focus_sentence = pick_focus_sentence(sentences, concept)
    support_sentence = pick_support_sentence(sentences, focus_sentence)
    subject_hint = subject_guidance(row["subject"])
    goals = learning_goals(concept, key_terms, row["subject"])
    summary = make_summary(concept, focus_sentence, key_terms)
    page_label = page_range_label(row)

    blocks = [
        {
            "type": "section",
            "title": "Overview",
            "body": summary,
        },
        {
            "type": "section",
            "title": "Learning Goals",
            "body": bullet_list(goals),
        },
        {
            "type": "text",
            "title": "Core Explanation",
            "body": (
                f"Think of {concept} as the main idea to unpack. "
                f"{subject_hint} Start by identifying the definition or rule, then connect it to the examples, "
                "diagrams, activities, or calculations in the textbook. Finish by explaining the idea aloud "
                "using the key terms below."
            ),
        },
        {
            "type": "text",
            "title": "Textbook Anchor",
            "body": textbook_anchor(focus_sentence, support_sentence),
        },
        {
            "type": "text",
            "title": "Key Terms",
            "body": ", ".join(key_terms[:8]) if key_terms else concept,
        },
        {
            "type": "text",
            "title": "Study Walkthrough",
            "body": (
                "1. Read the overview page or first worked example.\n"
                "2. Underline the definition, process, formula, structure, or rule.\n"
                "3. Write one sentence that links the idea to a real example.\n"
                "4. Try the quiz without looking, then revisit the textbook pages for anything uncertain."
            ),
        },
        {
            "type": "text",
            "title": "Textbook Trace",
            "body": (
                f"Source: {row['source_title']} ({row['subject']} Form {row['form_level']}). "
                f"Pages: {page_label}. Full extracted text remains in textbook_lessons/textbook_pages."
            ),
        },
    ]

    existing_content = row.get("app_content") or {}
    pages = existing_content.get("pages") or (row.get("textbook_content") or {}).get("pages") or []

    return {
        "title": title,
        "concept": concept,
        "summary": summary,
        "blocks": blocks,
        "learning_objectives": goals,
        "key_terms": key_terms[:12],
        "focus_sentence": focus_sentence,
        "support_sentence": support_sentence,
        "pages": pages,
        "content": {
            "source": SOURCE_TAG,
            "source_key": row["source_key"],
            "topic_code": row["topic_code"],
            "summary": summary,
            "pages": pages,
            "blocks": blocks,
            "learning_objectives": goals,
            "key_terms": key_terms[:12],
            "student_friendly": True,
            "enrichment": {
                "version": ENRICHMENT_VERSION,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "textbook_lesson_id": str(row["textbook_lesson_id"]),
            },
        },
    }


def apply_enrichment(conn, row: dict[str, Any], enriched: dict[str, Any], questions: list[dict[str, Any]]) -> int:
    lesson_title = truncate(f"{row['subject']} Form {row['form_level']}: {enriched['title']}", 255)
    estimated_minutes = estimate_minutes(row.get("page_count") or 1, row.get("char_count") or 0)

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE lessons
            SET title = %s,
                content = %s,
                difficulty = %s,
                estimated_minutes = %s,
                is_active = true,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                lesson_title,
                Json(enriched["content"]),
                difficulty_for(row.get("char_count") or 0),
                estimated_minutes,
                row["linked_lesson_id"],
            ),
        )

        syllabus_content = {
            **(row.get("syllabus") or {}),
            "summary": enriched["summary"],
            "learning_objectives": enriched["learning_objectives"],
            "key_terms": enriched["key_terms"],
            "enrichment": {
                "version": ENRICHMENT_VERSION,
                "student_friendly": True,
            },
        }
        cur.execute(
            """
            UPDATE syllabus_items
            SET content = %s,
                subtopic = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                Json(syllabus_content),
                truncate(enriched["title"], 255),
                row["linked_syllabus_item_id"],
            ),
        )

        cur.execute(
            """
            UPDATE textbook_lessons
            SET content = %s,
                title = %s,
                subtopic = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                Json(enriched["content"]),
                enriched["title"],
                enriched["title"],
                row["textbook_lesson_id"],
            ),
        )

        cur.execute(
            """
            DELETE FROM quiz_questions
            WHERE lesson_id = %s
              AND explanation LIKE %s
            """,
            (row["linked_lesson_id"], f"{QUIZ_MARKER}%"),
        )
        replaced = cur.rowcount

        for index, question in enumerate(questions, start=1):
            cur.execute(
                """
                INSERT INTO quiz_questions
                  (lesson_id, question_text, question_type, options, correct_answer,
                   explanation, points, order_index, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true)
                """,
                (
                    row["linked_lesson_id"],
                    question["question_text"],
                    question["question_type"],
                    Json(question.get("options") or []),
                    Json(question["correct_answer"]),
                    question["explanation"],
                    question.get("points", 1),
                    index,
                ),
            )

    return replaced


def build_quiz_questions(row: dict[str, Any], enriched: dict[str, Any]) -> list[dict[str, Any]]:
    concept = enriched["concept"]
    key_terms = enriched["key_terms"] or [concept]
    focus = clean_option(enriched.get("focus_sentence") or enriched["summary"])
    first_term = key_terms[0]

    return [
        {
            "question_text": f"What is the main focus of this lesson on {concept}?",
            "question_type": "multiple_choice",
            "options": [
                concept,
                "Only memorising the page number",
                "Ignoring the examples and diagrams",
                "Reading the source file name only",
            ],
            "correct_answer": concept,
            "explanation": f"{QUIZ_MARKER} The lesson is organised around {concept}.",
            "points": 1,
        },
        {
            "question_text": f"Which statement is best supported by the textbook notes for {concept}?",
            "question_type": "multiple_choice",
            "options": [
                focus,
                "The lesson has no connection to examples or evidence.",
                "The page references are more important than the idea.",
                "The topic should be revised without using any key terms.",
            ],
            "correct_answer": focus,
            "explanation": f"{QUIZ_MARKER} This statement was selected from the cleaned lesson text.",
            "points": 1,
        },
    {
        "question_text": f"Fill in the blank: One important term for this lesson is ____.",
        "question_type": "fill_blank",
        "options": [],
        "correct_answer": fill_blank_answers(first_term),
        "explanation": f"{QUIZ_MARKER} Key terms help students explain the topic precisely.",
        "points": 1,
    },
        {
            "question_text": (
                f"A strong answer about {concept} should connect the definition with examples, "
                "diagrams, activities, or calculations from the textbook."
            ),
            "question_type": "true_false",
            "options": ["True", "False"],
            "correct_answer": "True",
            "explanation": f"{QUIZ_MARKER} Understanding improves when the idea is connected to evidence or examples.",
            "points": 1,
        },
    ]


def clean_text_lines(text: str) -> list[str]:
    lines: list[str] = []
    previous = ""
    for raw in text.splitlines():
        line = normalize_space(raw)
        if not line:
            continue
        if re.match(r"^\[.+\|\s*page\s+\d+\s*\|\s*global\s+\d+\]$", line, re.IGNORECASE):
            continue
        if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM)", line, re.IGNORECASE):
            continue
        if re.fullmatch(r"Page\s+\d+\s+of\s+\d+", line, re.IGNORECASE):
            continue
        lowered = line.lower().strip(" .:-")
        if lowered in EXACT_NOISE:
            continue
        if any(lowered.startswith(prefix) for prefix in NOISE_PREFIXES):
            continue
        if re.fullmatch(r"\d{1,4}", lowered) or re.fullmatch(r"[ivxlcdm]+", lowered):
            continue
        if "http://" in lowered or "https://" in lowered:
            continue
        if len(line) < 4:
            continue
        alnum_ratio = sum(char.isalnum() for char in line) / max(1, len(line))
        if alnum_ratio < 0.45:
            continue
        if line == previous:
            continue
        lines.append(line)
        previous = line
    return lines


def extract_sentences(lines: list[str]) -> list[str]:
    blob = normalize_space(" ".join(lines))
    candidates = re.split(r"(?<=[.!?])\s+", blob)
    sentences = [clean_sentence(item) for item in candidates if useful_sentence(item)]

    if len(sentences) >= 3:
        return sentences[:20]

    fallback: list[str] = []
    chunk: list[str] = []
    for line in lines:
        chunk.append(line)
        if len(" ".join(chunk)) > 180:
            fallback.append(clean_sentence(" ".join(chunk)))
            chunk = []
    if chunk:
        fallback.append(clean_sentence(" ".join(chunk)))
    return [item for item in fallback if useful_sentence(item)][:20]


def extract_key_terms(title: str, lines: list[str]) -> list[str]:
    first_seen: dict[str, str] = {}
    tokens = re.findall(r"[^\W\d_][\w-]{3,}", " ".join([title, *lines[:120]]), flags=re.UNICODE)
    counts: Counter[str] = Counter()
    for token in tokens:
        cleaned = token.strip("-_")
        normalized = cleaned.lower()
        if len(normalized) < 4 or normalized in STOPWORDS:
            continue
        if normalized.startswith(("http", "www")):
            continue
        first_seen.setdefault(normalized, cleaned)
        counts[normalized] += 1

    title_terms = []
    for token in re.findall(r"[^\W\d_][\w-]{2,}", strip_topic_code(title), flags=re.UNICODE):
        normalized = token.lower()
        if normalized not in STOPWORDS:
            title_terms.append(first_seen.get(normalized, token))

    frequent_terms = [first_seen[key] for key, _ in counts.most_common(16)]
    return unique_answers([*title_terms, *frequent_terms])[:12]


def pick_focus_sentence(sentences: list[str], concept: str) -> str:
    if not sentences:
        return f"This lesson introduces {concept} and the key ideas students need for the topic."
    concept_tokens = {item.lower() for item in re.findall(r"[^\W\d_][\w-]{3,}", concept, flags=re.UNICODE)}
    scored = []
    for sentence in sentences:
        tokens = {item.lower() for item in re.findall(r"[^\W\d_][\w-]{3,}", sentence, flags=re.UNICODE)}
        overlap = len(concept_tokens.intersection(tokens))
        scored.append((overlap, min(len(sentence), 240), sentence))
    scored.sort(key=lambda item: (-item[0], -item[1]))
    return truncate(scored[0][2], 280)


def pick_support_sentence(sentences: list[str], focus_sentence: str) -> str:
    for sentence in sentences:
        if sentence != focus_sentence and 60 <= len(sentence) <= 260:
            return truncate(sentence, 260)
    return ""


def make_summary(concept: str, focus_sentence: str, key_terms: list[str]) -> str:
    term_text = ", ".join(key_terms[:4]) if key_terms else concept
    return (
        f"This lesson helps students understand {concept}. "
        f"Students should focus on the key terms {term_text}, then connect them to the textbook examples. "
        f"Textbook focus: {truncate(focus_sentence, 260)}"
    )


def textbook_anchor(focus_sentence: str, support_sentence: str) -> str:
    if support_sentence:
        return f"Start from this cleaned textbook idea: {focus_sentence}\n\nA second useful clue is: {support_sentence}"
    return f"Start from this cleaned textbook idea: {focus_sentence}"


def learning_goals(concept: str, key_terms: list[str], subject: str) -> list[str]:
    term_text = ", ".join(key_terms[:3]) if key_terms else concept
    return [
        f"State the main idea of {concept} in your own words.",
        f"Use key terms such as {term_text} accurately.",
        f"Connect the idea to at least one textbook example, diagram, activity, or calculation.",
        f"Answer a short quiz question about {concept} without looking back at the notes.",
    ]


def subject_guidance(subject: str) -> str:
    lowered = subject.lower()
    if "mathematics" in lowered:
        return "For mathematics, watch the symbols, the worked steps, and how each answer is checked."
    if "computer" in lowered:
        return "For computer science, trace the input, process, output, and any rule or algorithm."
    if "graphics" in lowered or "reka" in lowered:
        return "For design or graphics, notice the purpose, constraints, labels, and sequence of construction."
    if "biology" in lowered or "science" in lowered or "chemistry" in lowered or "physics" in lowered:
        return "For science, link each structure, process, cause, or measurement to the evidence shown."
    return "Look for the definition, the important examples, and the reason the idea matters."


def clean_display_title(value: str) -> str:
    title = normalize_space(value)
    title = re.sub(
        r"\s+(?:Latihan Pengukuhan|Rumusan|Refleksi Kendiri|Latihan Sumatif)\b.*$",
        "",
        title,
        flags=re.IGNORECASE,
    )
    if len(title) > 25:
        title = re.sub(r"\s+\d{1,3}$", "", title)
    return truncate(title.strip(" .:-"), 180)


def strip_topic_code(title: str) -> str:
    return re.sub(r"^\d{1,2}\.\d{1,2}\s+", "", title).strip() or title


def clean_sentence(value: str) -> str:
    sentence = normalize_space(value)
    sentence = re.sub(
        r"\b(element|unsur)\s+([a-z])\s+([A-Z])\b",
        r"\1 \2 in \3",
        sentence,
        flags=re.IGNORECASE,
    )
    sentence = re.sub(
        r"\b([a-z])\s+([A-Z])(?=\s+(?:is|are|ialah|dipetakan|mapped))",
        r"\1 in \2",
        sentence,
    )
    return sentence.strip(" ;:-")


def useful_sentence(value: str) -> bool:
    sentence = clean_sentence(value)
    if not 45 <= len(sentence) <= 320:
        return False
    lowered = sentence.lower()
    if any(lowered.startswith(prefix) for prefix in NOISE_PREFIXES):
        return False
    letters = sum(char.isalpha() for char in sentence)
    return letters >= 25


def clean_option(value: str) -> str:
    value = clean_sentence(value)
    if len(value) < 20:
        return value
    return truncate(value, 180)


def page_range_label(row: dict[str, Any]) -> str:
    start = row.get("start_global_page_number")
    end = row.get("end_global_page_number")
    if start and end and start != end:
        return f"global pages {start}-{end}"
    if start:
        return f"global page {start}"
    return "see linked textbook pages"


def estimate_minutes(page_count: int, char_count: int) -> int:
    by_pages = 8 + max(1, page_count) * 2
    by_chars = max(10, round(max(1, char_count) / 1400))
    return max(10, min(45, max(by_pages, by_chars)))


def difficulty_for(char_count: int) -> str:
    if char_count > 28000:
        return "hard"
    if char_count < 5000:
        return "easy"
    return "medium"


def bullet_list(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def unique_answers(items: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for item in items:
        text = normalize_space(str(item)).strip(" .:-")
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        unique.append(text)
    return unique


def fill_blank_answers(first_term: str) -> list[str]:
    answers = [first_term, first_term.lower()]
    if first_term.endswith("s") and len(first_term) > 4:
        answers.append(first_term[:-1])
        answers.append(first_term[:-1].lower())
    return unique_answers(answers)


def normalize_space(value: str) -> str:
    cleaned = str(value).replace("\x00", " ")
    cleaned = "".join(
        " " if 0xE000 <= ord(char) <= 0xF8FF else char
        for char in cleaned
    )
    return re.sub(r"\s+", " ", cleaned).strip()


def truncate(value: str, length: int) -> str:
    return value if len(value) <= length else value[: length - 1].rstrip() + "..."


def connect_db():
    env = read_env(Path(".env"))
    database_url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)

    db_password = env.get("DB_PASSWORD") or os.environ.get("DB_PASSWORD")
    if not db_password:
        raise RuntimeError("DATABASE_URL or DB_PASSWORD must be set")

    return psycopg2.connect(
        dbname=env.get("DB_NAME", "eduapp"),
        user=env.get("DB_USER", "eduuser"),
        password=db_password,
        host=env.get("DB_HOST", "localhost"),
        port=env.get("DB_PORT", "5432"),
    )


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


if __name__ == "__main__":
    raise SystemExit(main())
