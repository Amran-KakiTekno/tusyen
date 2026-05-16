"""Extract Form 4/5 STEM textbook text into Postgres.

The importer preserves traceability:
- textbook_sources/files/pages keep the raw PDF extraction.
- textbook_lessons groups pages by detected numbered subtopic headings.
- syllabus_items/lessons receive linked app-facing records.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import fitz
import psycopg2
from psycopg2.extras import Json, execute_values


ROOT = Path("downloads/gurubesar-kssm-textbooks")
SOURCE_WEBSITE = "https://gurubesar.my/himpunan-buku-teks-digital-kssm-tingkatan-1-hingga-5-2/"
SCIENCE_FORM4_ALT_URL = "https://studentportal.my/wp-content/uploads/2023/02/Buku-Teks-Sains-Tingkatan-4-1.pdf"

SUBJECT_MAP = {
    "Add Math": "Additional Mathematics",
    "Asas Kelestarian": "Asas Kelestarian",
    "Biologi": "Biology",
    "Fizik": "Physics",
    "Grafik Komunikasi Teknikal": "Technical Graphics Communication",
    "Kimia": "Chemistry",
    "Matematik": "Mathematics",
    "Pertanian": "Agriculture",
    "Reka Cipta": "Reka Cipta",
    "Sains": "Science",
    "Sains Komputer": "Computer Science",
    "Sains Rumah Tangga": "Home Science",
    "Sains Sukan": "Sports Science",
    "Sains Tambahan": "Additional Science",
}

EXCLUDED_HEADING_PREFIXES = (
    "aktiviti",
    "activity",
    "amali",
    "cabaran",
    "check",
    "contoh",
    "diagram",
    "determine",
    "draw",
    "example",
    "eksperimen",
    "experiment",
    "figure",
    "formative",
    "info",
    "intensive practice",
    "jadual",
    "kata kunci",
    "kerjaya",
    "kod",
    "latihan",
    "look",
    "mastery practice",
    "observe",
    "pak21",
    "praktis",
    "practice",
    "rajah",
    "refleksi",
    "rumusan",
    "self",
    "soalan",
    "standard",
    "state",
    "table",
)

OVERVIEW_PHRASES = (
    "apakah yang akan anda pelajari",
    "contains questions to determine",
    "what will you learn",
    "eksplorasi bab",
    "eksplorasi chapter",
    "memuatkan",
)

TWO_LEVEL_CODE = r"\d{1,2}\.\d{1,2}"
START_HEADING_RE = re.compile(rf"^(?P<code>{TWO_LEVEL_CODE})(?!\.)\s+(?P<title>.+)$")
END_HEADING_RE = re.compile(rf"^(?P<title>.+?)\s+(?P<code>{TWO_LEVEL_CODE})(?!\.)$")
CODE_ONLY_RE = re.compile(rf"^(?P<code>{TWO_LEVEL_CODE})(?!\.)$")
LEADING_STANDARD_CODES_RE = re.compile(rf"^(?:{TWO_LEVEL_CODE}(?:\.\d{{1,2}})?\s+)+")


@dataclass
class SourceSpec:
    source_key: str
    title: str
    subject: str
    form_level: int
    language: str
    local_dir: Path
    files: list[Path]
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ExtractedPage:
    file_key: str
    file_name: str
    page_number: int
    global_page_number: int
    text: str
    char_count: int
    image_count: int
    extraction_method: str
    needs_ocr: bool
    metadata: dict[str, Any]


@dataclass
class HeadingCandidate:
    code: str
    title: str
    global_page_number: int
    line_index: int
    source_line: str


@dataclass
class LessonSegment:
    lesson_key: str
    topic_code: str | None
    topic: str
    subtopic: str | None
    title: str
    lesson_type: str
    order_index: int
    pages: list[ExtractedPage]
    extraction_status: str
    heading_line: str | None = None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default=str(ROOT), help="Downloaded textbook root")
    parser.add_argument("--forms", nargs="+", type=int, default=[4, 5], choices=[4, 5])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit-sources", type=int, default=0)
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    root = Path(args.root)
    sources = discover_sources(root, args.forms)
    if args.limit_sources:
        sources = sources[: args.limit_sources]

    print(f"Discovered {len(sources)} STEM textbook sources")

    if args.dry_run:
        for source in sources:
            print(f"- {source.source_key}: {len(source.files)} file(s)")
        return 0

    conn = connect_db()
    try:
        totals = {
            "sources": 0,
            "files": 0,
            "pages": 0,
            "lessons": 0,
            "needs_ocr_pages": 0,
        }
        for source in sources:
            result = import_source(conn, source)
            for key, value in result.items():
                totals[key] += value
            conn.commit()
            print(
                f"Imported {source.source_key}: "
                f"{result['files']} files, {result['pages']} pages, "
                f"{result['lessons']} lessons, {result['needs_ocr_pages']} OCR-needed pages"
            )

        print("Import complete")
        print(json.dumps(totals, indent=2, sort_keys=True))
    finally:
        conn.close()

    return 0


def discover_sources(root: Path, forms: list[int]) -> list[SourceSpec]:
    sources: list[SourceSpec] = []
    for form in forms:
        stem_dir = root / f"Tingkatan {form}" / "STEM"
        if not stem_dir.exists():
            continue

        for book_dir in sorted(path for path in stem_dir.iterdir() if path.is_dir()):
            pdfs = sorted(path for path in book_dir.glob("*.pdf") if path.is_file())
            if not pdfs:
                continue

            base_subject = parse_subject(book_dir.name, form)
            subject = SUBJECT_MAP.get(base_subject, base_subject)
            base_title = book_dir.name.removeprefix("Buku Teks ").strip()

            if book_dir.name == "Buku Teks Sains Tingkatan 4":
                original = book_dir / "Buku Teks Sains KSSM TING 4.pdf"
                original_ocr = original.with_suffix(".ocr.json")
                if original.exists() and original_ocr.exists():
                    excluded = [path.name for path in pdfs if path != original]
                    sources.append(
                        make_source(
                            form=form,
                            title=base_title,
                            subject=subject,
                            local_dir=book_dir,
                            files=[original],
                            metadata={
                                "ocr_text_sidecar": str(original_ocr.resolve()),
                                "ocr_method": "rapidocr_onnxruntime",
                                "excluded_alternate_files": excluded,
                            },
                        )
                    )
                    continue

                alt = book_dir / "Buku-Teks-Sains-Tingkatan-4-1.alt.pdf"
                if alt.exists():
                    original = [path.name for path in pdfs if path != alt]
                    sources.append(
                        make_source(
                            form=form,
                            title=base_title,
                            subject=subject,
                            local_dir=book_dir,
                            files=[alt],
                            metadata={
                                "text_layer_replacement": True,
                                "alternate_text_source_url": SCIENCE_FORM4_ALT_URL,
                                "excluded_image_only_files": original,
                            },
                        )
                    )
                    continue

            if book_dir.name == "Buku Teks Add Math Tingkatan 4" and len(pdfs) > 1:
                for pdf in pdfs:
                    title = pdf.stem.replace("_", " ")
                    sources.append(
                        make_source(
                            form=form,
                            title=title,
                            subject=subject,
                            local_dir=book_dir,
                            files=[pdf],
                            metadata={"variant_source": True, "folder_title": base_title},
                        )
                    )
                continue

            sources.append(
                make_source(
                    form=form,
                    title=base_title,
                    subject=subject,
                    local_dir=book_dir,
                    files=pdfs,
                    metadata={},
                )
            )

    return sources


def make_source(
    *,
    form: int,
    title: str,
    subject: str,
    local_dir: Path,
    files: list[Path],
    metadata: dict[str, Any],
) -> SourceSpec:
    language = detect_language(title, files)
    source_key = slugify(f"form-{form}-stem-{subject}-{title}-{language}")
    return SourceSpec(
        source_key=source_key,
        title=title,
        subject=subject,
        form_level=form,
        language=language,
        local_dir=local_dir,
        files=files,
        metadata=metadata,
    )


def parse_subject(folder_name: str, form: int) -> str:
    subject = folder_name.removeprefix("Buku Teks ").strip()
    suffix = f" Tingkatan {form}"
    if subject.endswith(suffix):
        subject = subject[: -len(suffix)]
    return subject.strip()


def detect_language(title: str, files: list[Path]) -> str:
    probe = " ".join([title, *[path.name for path in files]]).lower()
    english_tokens = ("dlp", "physics", "biology", "additional mathematics", "form 4", "form 5")
    return "en" if any(token in probe for token in english_tokens) else "ms"


def import_source(conn, source: SourceSpec) -> dict[str, int]:
    cur = conn.cursor()
    source_id = upsert_source(cur, source)
    clear_existing_source_records(cur, source_id)

    extracted_files: list[dict[str, Any]] = []
    pages: list[ExtractedPage] = []
    global_page_number = 1

    for file_index, path in enumerate(source.files, start=1):
        file_key = f"{source.source_key}-{slugify(path.stem)}-{short_hash(str(path))}"
        file_result = extract_pdf(path, file_key, global_page_number)
        global_page_number += len(file_result["pages"])
        extracted_files.append(
            {
                "file_key": file_key,
                "path": path,
                "file_index": file_index,
                **file_result["file"],
            }
        )
        pages.extend(file_result["pages"])

    file_ids = upsert_files(cur, source_id, extracted_files)
    page_ids = upsert_pages(cur, source_id, pages, file_ids)
    lessons = build_lesson_segments(source, pages)
    imported_lessons = upsert_lessons_and_app_records(cur, source, source_id, lessons, file_ids, page_ids)

    page_count = len(pages)
    extracted_page_count = sum(1 for page in pages if page.char_count >= 20)
    needs_ocr_page_count = sum(1 for page in pages if page.needs_ocr)
    status = extraction_status(page_count, extracted_page_count, needs_ocr_page_count)

    metadata = {
        **source.metadata,
        "toc_pages": extract_toc_pages(pages),
        "lesson_detection": {
            "strategy": "numbered_subtopic_headings",
            "lesson_count": len(lessons),
        },
    }
    cur.execute(
        """
        UPDATE textbook_sources
        SET file_count = %s,
            page_count = %s,
            extracted_page_count = %s,
            needs_ocr_page_count = %s,
            extraction_status = %s,
            metadata = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (
            len(extracted_files),
            page_count,
            extracted_page_count,
            needs_ocr_page_count,
            status,
            Json(metadata),
            source_id,
        ),
    )

    return {
        "sources": 1,
        "files": len(extracted_files),
        "pages": page_count,
        "lessons": imported_lessons,
        "needs_ocr_pages": needs_ocr_page_count,
    }


def clear_existing_source_records(cur, source_id: str) -> None:
    cur.execute(
        """
        SELECT linked_lesson_id, linked_syllabus_item_id
        FROM textbook_lessons
        WHERE source_id = %s
        """,
        (source_id,),
    )
    linked_rows = cur.fetchall()
    lesson_ids = [row[0] for row in linked_rows if row[0]]
    syllabus_ids = [row[1] for row in linked_rows if row[1]]

    if lesson_ids or syllabus_ids:
        cur.execute(
            """
            DELETE FROM lesson_syllabus_links
            WHERE lesson_id = ANY(%s::uuid[])
               OR syllabus_id = ANY(%s::uuid[])
            """,
            (lesson_ids, syllabus_ids),
        )
    if lesson_ids:
        cur.execute(
            "DELETE FROM lessons WHERE id = ANY(%s::uuid[]) AND content->>'source' = 'gurubesar_kssm_textbook'",
            (lesson_ids,),
        )
    if syllabus_ids:
        cur.execute(
            "DELETE FROM syllabus_items WHERE id = ANY(%s::uuid[]) AND content->>'source' = 'gurubesar_kssm_textbook'",
            (syllabus_ids,),
        )

    cur.execute("DELETE FROM textbook_files WHERE source_id = %s", (source_id,))
    cur.execute("DELETE FROM textbook_lessons WHERE source_id = %s", (source_id,))


def upsert_source(cur, source: SourceSpec) -> str:
    cur.execute(
        """
        INSERT INTO textbook_sources
          (source_key, title, subject, form_level, stream, language, source_website, local_dir, metadata)
        VALUES (%s, %s, %s, %s, 'STEM', %s, %s, %s, %s)
        ON CONFLICT (source_key)
        DO UPDATE SET title = EXCLUDED.title,
                      subject = EXCLUDED.subject,
                      form_level = EXCLUDED.form_level,
                      stream = EXCLUDED.stream,
                      language = EXCLUDED.language,
                      source_website = EXCLUDED.source_website,
                      local_dir = EXCLUDED.local_dir,
                      metadata = EXCLUDED.metadata,
                      updated_at = NOW()
        RETURNING id
        """,
        (
            source.source_key,
            source.title,
            source.subject,
            source.form_level,
            source.language,
            SOURCE_WEBSITE,
            str(source.local_dir.resolve()),
            Json(source.metadata),
        ),
    )
    return cur.fetchone()[0]


def extract_pdf(path: Path, file_key: str, first_global_page_number: int) -> dict[str, Any]:
    stat = path.stat()
    pages: list[ExtractedPage] = []
    file_metadata: dict[str, Any] = {}
    ocr_pages, ocr_metadata = load_ocr_sidecar(path)
    if ocr_metadata:
        file_metadata["ocr_sidecar"] = ocr_metadata

    with fitz.open(path) as doc:
        toc = doc.get_toc()
        file_metadata["toc"] = [
            {"level": item[0], "title": item[1], "page": item[2]}
            for item in toc[:250]
        ]
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            text = clean_text(page.get_text("text") or "")
            extraction_method = "pymupdf_text" if text.strip() else "none"
            if len(text.strip()) < 20 and (page_index + 1) in ocr_pages:
                text = clean_text(ocr_pages[page_index + 1])
                extraction_method = "rapidocr_onnxruntime"
            char_count = len(text.strip())
            image_count = len(page.get_images(full=False))
            needs_ocr = char_count < 20 and image_count > 0
            rect = page.rect
            pages.append(
                ExtractedPage(
                    file_key=file_key,
                    file_name=path.name,
                    page_number=page_index + 1,
                    global_page_number=first_global_page_number + page_index,
                    text=text,
                    char_count=char_count,
                    image_count=image_count,
                    extraction_method=extraction_method,
                    needs_ocr=needs_ocr,
                    metadata={
                        "width": round(rect.width, 2),
                        "height": round(rect.height, 2),
                        "rotation": page.rotation,
                    },
                )
            )

    extracted_page_count = sum(1 for page in pages if page.char_count >= 20)
    needs_ocr_page_count = sum(1 for page in pages if page.needs_ocr)
    status = extraction_status(len(pages), extracted_page_count, needs_ocr_page_count)
    return {
        "file": {
            "file_name": path.name,
            "local_path": str(path.resolve()),
            "file_size_bytes": stat.st_size,
            "sha256": sha256_file(path),
            "page_count": len(pages),
            "extracted_page_count": extracted_page_count,
            "needs_ocr_page_count": needs_ocr_page_count,
            "extraction_status": status,
            "metadata": file_metadata,
        },
        "pages": pages,
    }


def upsert_files(cur, source_id: str, files: list[dict[str, Any]]) -> dict[str, str]:
    file_ids: dict[str, str] = {}
    for item in files:
        cur.execute(
            """
            INSERT INTO textbook_files
              (source_id, file_key, file_name, local_path, file_index, file_size_bytes, sha256,
               page_count, extracted_page_count, needs_ocr_page_count, extraction_status, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (file_key)
            DO UPDATE SET source_id = EXCLUDED.source_id,
                          file_name = EXCLUDED.file_name,
                          local_path = EXCLUDED.local_path,
                          file_index = EXCLUDED.file_index,
                          file_size_bytes = EXCLUDED.file_size_bytes,
                          sha256 = EXCLUDED.sha256,
                          page_count = EXCLUDED.page_count,
                          extracted_page_count = EXCLUDED.extracted_page_count,
                          needs_ocr_page_count = EXCLUDED.needs_ocr_page_count,
                          extraction_status = EXCLUDED.extraction_status,
                          metadata = EXCLUDED.metadata,
                          updated_at = NOW()
            RETURNING id
            """,
            (
                source_id,
                item["file_key"],
                item["file_name"],
                item["local_path"],
                item["file_index"],
                item["file_size_bytes"],
                item["sha256"],
                item["page_count"],
                item["extracted_page_count"],
                item["needs_ocr_page_count"],
                item["extraction_status"],
                Json(item["metadata"]),
            ),
        )
        file_ids[item["file_key"]] = cur.fetchone()[0]
    return file_ids


def upsert_pages(
    cur,
    source_id: str,
    pages: list[ExtractedPage],
    file_ids: dict[str, str],
) -> dict[tuple[str, int], str]:
    rows = [
        (
            source_id,
            file_ids[page.file_key],
            page.page_number,
            page.global_page_number,
            page.text,
            page.char_count,
            page.image_count,
            page.extraction_method,
            page.needs_ocr,
            Json(page.metadata),
        )
        for page in pages
    ]

    if rows:
        execute_values(
            cur,
            """
            INSERT INTO textbook_pages
              (source_id, file_id, page_number, global_page_number, text_content, char_count,
               image_count, extraction_method, needs_ocr, metadata)
            VALUES %s
            ON CONFLICT (file_id, page_number)
            DO UPDATE SET source_id = EXCLUDED.source_id,
                          global_page_number = EXCLUDED.global_page_number,
                          text_content = EXCLUDED.text_content,
                          char_count = EXCLUDED.char_count,
                          image_count = EXCLUDED.image_count,
                          extraction_method = EXCLUDED.extraction_method,
                          needs_ocr = EXCLUDED.needs_ocr,
                          metadata = EXCLUDED.metadata,
                          updated_at = NOW()
            """,
            rows,
            page_size=100,
        )

    cur.execute(
        """
        SELECT f.file_key, p.page_number, p.id
        FROM textbook_pages p
        JOIN textbook_files f ON f.id = p.file_id
        WHERE p.source_id = %s
        """,
        (source_id,),
    )
    return {(row[0], row[1]): row[2] for row in cur.fetchall()}


def build_lesson_segments(source: SourceSpec, pages: list[ExtractedPage]) -> list[LessonSegment]:
    toc_entries = extract_toc_entries_for_detection(pages)
    toc_page_numbers = real_toc_page_numbers_for_detection(pages)
    minimum_heading_page = max(toc_page_numbers, default=0) + 1 if toc_entries else 1
    candidates = unique_heading_candidates(
        find_heading_candidates(pages, minimum_global_page=minimum_heading_page),
        toc_entries,
    )
    candidates = filter_out_of_order_candidates(candidates)
    if not candidates:
        return fallback_lesson_segments(source, pages)

    page_by_global = {page.global_page_number: page for page in pages}
    global_numbers = [page.global_page_number for page in pages]
    lessons: list[LessonSegment] = []

    for index, candidate in enumerate(candidates):
        start_global = candidate.global_page_number
        next_global = candidates[index + 1].global_page_number if index + 1 < len(candidates) else None
        if next_global is None:
            end_global = global_numbers[-1]
        elif next_global == start_global:
            end_global = start_global
        else:
            end_global = next_global - 1

        segment_pages = [
            page_by_global[number]
            for number in global_numbers
            if start_global <= number <= end_global and number in page_by_global
        ]
        if not segment_pages:
            segment_pages = [page_by_global[start_global]]

        chapter = candidate.code.split(".")[0]
        topic = "Chapter " + chapter if source.language == "en" else "Bab " + chapter
        title = f"{candidate.code} {candidate.title}".strip()
        lesson_key = f"{slugify(candidate.code)}-{slugify(candidate.title)[:80]}-{index + 1:03d}"
        status = lesson_status(segment_pages)
        lessons.append(
            LessonSegment(
                lesson_key=lesson_key,
                topic_code=candidate.code,
                topic=topic,
                subtopic=title,
                title=title,
                lesson_type="subtopic",
                order_index=index + 1,
                pages=segment_pages,
                extraction_status=status,
                heading_line=candidate.source_line,
            )
        )

    return lessons


def find_heading_candidates(
    pages: list[ExtractedPage],
    minimum_global_page: int = 1,
) -> list[HeadingCandidate]:
    candidates: list[HeadingCandidate] = []
    for page in pages:
        if page.global_page_number < minimum_global_page:
            continue
        if page.char_count < 50 or is_overview_page(page.text) or looks_like_real_toc_page(page.text):
            continue
        lines = useful_lines(page.text)
        for index, line in enumerate(lines):
            candidate = heading_from_line(
                line,
                previous_lines=list(reversed(lines[max(0, index - 3) : index])),
                next_lines=lines[index + 1 : index + 4],
            )
            if not candidate:
                continue
            code, title = candidate
            candidates.append(
                HeadingCandidate(
                    code=code,
                    title=title,
                    global_page_number=page.global_page_number,
                    line_index=index,
                    source_line=line,
                )
            )
    return sorted(candidates, key=lambda item: (item.global_page_number, item.line_index))


def unique_heading_candidates(
    candidates: list[HeadingCandidate],
    toc_entries: dict[str, str],
) -> list[HeadingCandidate]:
    use_toc_filter = len(toc_entries) >= 5
    if use_toc_filter:
        grouped: dict[str, list[HeadingCandidate]] = {}
        for candidate in candidates:
            if candidate.code in toc_entries:
                grouped.setdefault(candidate.code, []).append(candidate)

        selected: list[HeadingCandidate] = []
        for code, title in toc_entries.items():
            matches = grouped.get(code, [])
            if not matches:
                continue
            chosen = next((item for item in matches if titles_match(item.title, title)), None)
            if chosen is None:
                chosen = next((item for item in matches if item.title.strip().lower() == "kandungan"), matches[0])
            chosen.title = title
            selected.append(chosen)
        return sorted(selected, key=lambda item: (item.global_page_number, item.line_index))

    unique: list[HeadingCandidate] = []
    seen_codes: set[str] = set()
    for candidate in candidates:
        if candidate.code in seen_codes:
            continue
        seen_codes.add(candidate.code)
        unique.append(candidate)
    return unique


def titles_match(candidate_title: str, toc_title: str) -> bool:
    candidate_tokens = set(title_tokens(candidate_title))
    toc_tokens = set(title_tokens(toc_title))
    if not candidate_tokens or not toc_tokens:
        return False
    overlap = len(candidate_tokens.intersection(toc_tokens))
    return overlap >= max(1, math.ceil(min(len(candidate_tokens), len(toc_tokens)) * 0.5))


def title_tokens(value: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if len(token) > 2 and token not in {"dan", "the", "yang", "dalam", "with", "bagi"}
    ]


def filter_out_of_order_candidates(candidates: list[HeadingCandidate]) -> list[HeadingCandidate]:
    filtered: list[HeadingCandidate] = []
    last_chapter = 0
    last_subtopic = 0

    for index, candidate in enumerate(candidates):
        chapter, subtopic = code_tuple(candidate.code)
        lookahead = [code_tuple(item.code) for item in candidates[index + 1 : index + 6]]

        if chapter < last_chapter:
            continue
        if chapter == last_chapter and subtopic < last_subtopic:
            continue
        if chapter > last_chapter + 1 and any(next_chapter <= last_chapter + 1 for next_chapter, _ in lookahead):
            continue
        if (
            chapter == last_chapter
            and subtopic > last_subtopic + 1
            and any(next_chapter == chapter and next_subtopic <= last_subtopic + 1 for next_chapter, next_subtopic in lookahead)
        ):
            continue

        filtered.append(candidate)
        last_chapter = chapter
        last_subtopic = subtopic if chapter == last_chapter else 0

    return filtered


def code_tuple(code: str) -> tuple[int, int]:
    chapter, subtopic = [int(part) for part in code.split(".")]
    return chapter, subtopic


def heading_from_line(
    line: str,
    *,
    previous_lines: list[str],
    next_lines: list[str],
) -> tuple[str, str] | None:
    normalized = normalize_heading_line(line)
    if not normalized:
        return None

    match = END_HEADING_RE.match(normalized)
    if match:
        code = match.group("code")
        title = strip_leading_standard_codes(match.group("title"))
        if valid_topic_code(code) and valid_heading_title(title):
            return code, title

    match = START_HEADING_RE.match(normalized)
    if match:
        code = match.group("code")
        title = strip_leading_standard_codes(match.group("title"))
        if valid_topic_code(code) and valid_heading_title(title):
            return code, title

    match = CODE_ONLY_RE.match(normalized)
    if match:
        code = match.group("code")
        if not valid_topic_code(code):
            return None
        for previous_line in previous_lines:
            title = strip_leading_standard_codes(normalize_heading_line(previous_line))
            if valid_heading_title(title):
                return code, title
        for next_line in next_lines:
            title = strip_leading_standard_codes(normalize_heading_line(next_line))
            if valid_heading_title(title):
                return code, title

    return None


def fallback_lesson_segments(source: SourceSpec, pages: list[ExtractedPage]) -> list[LessonSegment]:
    if not pages:
        return []

    pages_by_file: dict[str, list[ExtractedPage]] = {}
    for page in pages:
        pages_by_file.setdefault(page.file_key, []).append(page)

    lessons: list[LessonSegment] = []
    for index, (file_key, file_pages) in enumerate(pages_by_file.items(), start=1):
        first_page = file_pages[0]
        raw_title = infer_title_from_text(first_page.text) or Path(first_page.file_name).stem.replace("_", " ")
        title = truncate(raw_title, 180)
        lesson_key = f"file-{index:03d}-{slugify(title)[:80]}"
        status = lesson_status(file_pages)
        lessons.append(
            LessonSegment(
                lesson_key=lesson_key,
                topic_code=None,
                topic=source.title,
                subtopic=title,
                title=title,
                lesson_type="file",
                order_index=index,
                pages=file_pages,
                extraction_status=status,
                heading_line=None,
            )
        )
    return lessons


def upsert_lessons_and_app_records(
    cur,
    source: SourceSpec,
    source_id: str,
    lessons: list[LessonSegment],
    file_ids: dict[str, str],
    page_ids: dict[tuple[str, int], str],
) -> int:
    count = 0
    for lesson in lessons:
        text_content = lesson_text(lesson.pages)
        first_page = lesson.pages[0]
        last_page = lesson.pages[-1]
        page_refs = lesson_page_refs(lesson.pages)
        syllabus = {
            "source": "gurubesar_kssm_textbook",
            "source_key": source.source_key,
            "topic_code": lesson.topic_code,
            "topic": lesson.topic,
            "subtopic": lesson.subtopic,
            "pages": page_refs,
        }
        content = lesson_content_json(source, lesson, text_content, page_refs)
        metadata = {
            "heading_line": lesson.heading_line,
            "detector": "numbered_subtopic_heading" if lesson.topic_code else "file_fallback",
            "source_files": sorted({page.file_name for page in lesson.pages}),
        }

        linked_syllabus_id = ensure_app_syllabus_item(cur, source, lesson, syllabus)
        linked_lesson_id = ensure_app_lesson(cur, source, lesson, content)
        ensure_lesson_syllabus_link(cur, linked_lesson_id, linked_syllabus_id)

        cur.execute(
            """
            INSERT INTO textbook_lessons
              (source_id, lesson_key, subject, form_level, topic, subtopic, topic_code, title,
               lesson_type, order_index, start_file_id, end_file_id, start_page_number,
               end_page_number, start_global_page_number, end_global_page_number, page_count,
               text_content, char_count, extraction_status, syllabus, content,
               linked_syllabus_item_id, linked_lesson_id, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (source_id, lesson_key)
            DO UPDATE SET subject = EXCLUDED.subject,
                          form_level = EXCLUDED.form_level,
                          topic = EXCLUDED.topic,
                          subtopic = EXCLUDED.subtopic,
                          topic_code = EXCLUDED.topic_code,
                          title = EXCLUDED.title,
                          lesson_type = EXCLUDED.lesson_type,
                          order_index = EXCLUDED.order_index,
                          start_file_id = EXCLUDED.start_file_id,
                          end_file_id = EXCLUDED.end_file_id,
                          start_page_number = EXCLUDED.start_page_number,
                          end_page_number = EXCLUDED.end_page_number,
                          start_global_page_number = EXCLUDED.start_global_page_number,
                          end_global_page_number = EXCLUDED.end_global_page_number,
                          page_count = EXCLUDED.page_count,
                          text_content = EXCLUDED.text_content,
                          char_count = EXCLUDED.char_count,
                          extraction_status = EXCLUDED.extraction_status,
                          syllabus = EXCLUDED.syllabus,
                          content = EXCLUDED.content,
                          linked_syllabus_item_id = EXCLUDED.linked_syllabus_item_id,
                          linked_lesson_id = EXCLUDED.linked_lesson_id,
                          metadata = EXCLUDED.metadata,
                          updated_at = NOW()
            RETURNING id
            """,
            (
                source_id,
                lesson.lesson_key,
                source.subject,
                source.form_level,
                lesson.topic,
                lesson.subtopic,
                lesson.topic_code,
                lesson.title,
                lesson.lesson_type,
                lesson.order_index,
                file_ids[first_page.file_key],
                file_ids[last_page.file_key],
                first_page.page_number,
                last_page.page_number,
                first_page.global_page_number,
                last_page.global_page_number,
                len(lesson.pages),
                text_content,
                len(text_content),
                lesson.extraction_status,
                Json(syllabus),
                Json(content),
                linked_syllabus_id,
                linked_lesson_id,
                Json(metadata),
            ),
        )
        textbook_lesson_id = cur.fetchone()[0]
        sync_lesson_pages(cur, textbook_lesson_id, lesson.pages, page_ids)
        count += 1
    return count


def ensure_app_syllabus_item(cur, source: SourceSpec, lesson: LessonSegment, content: dict[str, Any]) -> str:
    topic = truncate(lesson.topic, 255)
    subtopic = truncate(lesson.subtopic or lesson.title, 255)
    cur.execute(
        """
        SELECT linked_syllabus_item_id
        FROM textbook_lessons tl
        JOIN textbook_sources ts ON ts.id = tl.source_id
        WHERE ts.source_key = %s
          AND tl.lesson_key = %s
          AND linked_syllabus_item_id IS NOT NULL
        LIMIT 1
        """,
        (source.source_key, lesson.lesson_key),
    )
    existing = cur.fetchone()
    if existing:
        syllabus_id = existing[0]
        cur.execute(
            """
            UPDATE syllabus_items
            SET subject = %s,
                form_level = %s,
                topic = %s,
                subtopic = %s,
                order_index = %s,
                content = %s,
                is_active = true,
                updated_at = NOW()
            WHERE id = %s
            """,
            (source.subject, source.form_level, topic, subtopic, lesson.order_index, Json(content), syllabus_id),
        )
        return syllabus_id

    cur.execute(
        """
        SELECT id
        FROM syllabus_items
        WHERE subject = %s
          AND form_level = %s
          AND topic = %s
          AND COALESCE(subtopic, '') = COALESCE(%s, '')
          AND content->>'source' = 'gurubesar_kssm_textbook'
        LIMIT 1
        """,
        (source.subject, source.form_level, topic, subtopic),
    )
    existing = cur.fetchone()
    if existing:
        syllabus_id = existing[0]
        cur.execute(
            """
            UPDATE syllabus_items
            SET order_index = %s,
                content = %s,
                is_active = true,
                updated_at = NOW()
            WHERE id = %s
            """,
            (lesson.order_index, Json(content), syllabus_id),
        )
        return syllabus_id

    cur.execute(
        """
        INSERT INTO syllabus_items
          (subject, form_level, topic, subtopic, order_index, content, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, true)
        RETURNING id
        """,
        (source.subject, source.form_level, topic, subtopic, lesson.order_index, Json(content)),
    )
    return cur.fetchone()[0]


def ensure_app_lesson(cur, source: SourceSpec, lesson: LessonSegment, content: dict[str, Any]) -> str:
    title = truncate(f"{source.subject} Form {source.form_level}: {lesson.title}", 255)
    estimated_minutes = estimate_minutes(lesson.pages)
    cur.execute(
        """
        SELECT linked_lesson_id
        FROM textbook_lessons tl
        JOIN textbook_sources ts ON ts.id = tl.source_id
        WHERE ts.source_key = %s
          AND tl.lesson_key = %s
          AND linked_lesson_id IS NOT NULL
        LIMIT 1
        """,
        (source.source_key, lesson.lesson_key),
    )
    existing = cur.fetchone()
    if existing:
        lesson_id = existing[0]
        cur.execute(
            """
            UPDATE lessons
            SET title = %s,
                content = %s,
                subject = %s,
                form_level = %s,
                difficulty = 'medium',
                estimated_minutes = %s,
                is_active = true,
                updated_at = NOW()
            WHERE id = %s
            """,
            (title, Json(content), source.subject, source.form_level, estimated_minutes, lesson_id),
        )
        return lesson_id

    cur.execute(
        """
        SELECT id
        FROM lessons
        WHERE title = %s
          AND content->>'source' = 'gurubesar_kssm_textbook'
        LIMIT 1
        """,
        (title,),
    )
    existing = cur.fetchone()
    if existing:
        lesson_id = existing[0]
        cur.execute(
            """
            UPDATE lessons
            SET content = %s,
                subject = %s,
                form_level = %s,
                difficulty = 'medium',
                estimated_minutes = %s,
                is_active = true,
                updated_at = NOW()
            WHERE id = %s
            """,
            (Json(content), source.subject, source.form_level, estimated_minutes, lesson_id),
        )
        return lesson_id

    cur.execute(
        """
        INSERT INTO lessons
          (title, content, subject, form_level, difficulty, estimated_minutes, is_active)
        VALUES (%s, %s, %s, %s, 'medium', %s, true)
        RETURNING id
        """,
        (title, Json(content), source.subject, source.form_level, estimated_minutes),
    )
    return cur.fetchone()[0]


def ensure_lesson_syllabus_link(cur, lesson_id: str, syllabus_id: str) -> None:
    cur.execute(
        """
        INSERT INTO lesson_syllabus_links (lesson_id, syllabus_id)
        VALUES (%s, %s)
        ON CONFLICT (lesson_id, syllabus_id) DO NOTHING
        """,
        (lesson_id, syllabus_id),
    )


def sync_lesson_pages(
    cur,
    textbook_lesson_id: str,
    pages: list[ExtractedPage],
    page_ids: dict[tuple[str, int], str],
) -> None:
    cur.execute("DELETE FROM textbook_lesson_pages WHERE lesson_id = %s", (textbook_lesson_id,))
    rows = [
        (textbook_lesson_id, page_ids[(page.file_key, page.page_number)], index)
        for index, page in enumerate(pages, start=1)
    ]
    if rows:
        execute_values(
            cur,
            """
            INSERT INTO textbook_lesson_pages (lesson_id, page_id, order_index)
            VALUES %s
            ON CONFLICT (lesson_id, page_id)
            DO UPDATE SET order_index = EXCLUDED.order_index
            """,
            rows,
        )


def lesson_content_json(
    source: SourceSpec,
    lesson: LessonSegment,
    text_content: str,
    page_refs: list[dict[str, Any]],
) -> dict[str, Any]:
    blocks = []
    for index, chunk in enumerate(chunk_text(text_content, 6000), start=1):
        blocks.append(
            {
                "type": "text",
                "title": f"Textbook excerpt {index}",
                "body": chunk,
            }
        )

    return {
        "source": "gurubesar_kssm_textbook",
        "source_key": source.source_key,
        "topic_code": lesson.topic_code,
        "summary": excerpt(text_content, 500),
        "pages": page_refs,
        "blocks": blocks,
    }


def lesson_page_refs(pages: list[ExtractedPage]) -> list[dict[str, Any]]:
    refs = []
    for page in pages:
        refs.append(
            {
                "file_name": page.file_name,
                "page_number": page.page_number,
                "global_page_number": page.global_page_number,
                "char_count": page.char_count,
                "needs_ocr": page.needs_ocr,
            }
        )
    return refs


def extract_toc_pages(pages: list[ExtractedPage]) -> list[dict[str, Any]]:
    toc_pages = []
    for page in pages:
        lowered = page.text.lower()
        if "kandungan" in lowered or "contents" in lowered:
            toc_pages.append(
                {
                    "file_name": page.file_name,
                    "page_number": page.page_number,
                    "global_page_number": page.global_page_number,
                    "text_excerpt": excerpt(page.text, 2500),
                }
            )
    return toc_pages[:20]


def extract_toc_entries_for_detection(pages: list[ExtractedPage]) -> dict[str, str]:
    entries: dict[str, str] = {}
    toc_page_numbers = set(real_toc_page_numbers_for_detection(pages))
    for page in pages:
        if page.global_page_number not in toc_page_numbers:
            continue
        lines = useful_lines(page.text)
        for index, line in enumerate(lines):
            parsed = toc_entry_from_line(line)
            if not parsed:
                parsed = toc_entry_from_code_context(line, lines[index + 1 : index + 4])
            if not parsed:
                continue
            code, title = parsed
            entries.setdefault(code, title)
    return entries


def toc_entry_from_line(line: str) -> tuple[str, str] | None:
    normalized = normalize_heading_line(line)
    if not normalized:
        return None
    normalized = re.sub(r"\s+\d{1,3}$", "", normalized).strip()

    match = START_HEADING_RE.match(normalized)
    if match:
        code = match.group("code")
        title = strip_leading_standard_codes(match.group("title"))
        if valid_topic_code(code) and valid_heading_title(title):
            return code, title

    match = END_HEADING_RE.match(normalized)
    if match:
        code = match.group("code")
        title = strip_leading_standard_codes(match.group("title"))
        if valid_topic_code(code) and valid_heading_title(title):
            return code, title

    return None


def toc_entry_from_code_context(line: str, next_lines: list[str]) -> tuple[str, str] | None:
    normalized = normalize_heading_line(line)
    match = CODE_ONLY_RE.match(normalized)
    if not match:
        return None
    code = match.group("code")
    if not valid_topic_code(code):
        return None
    for next_line in next_lines:
        title = strip_leading_standard_codes(normalize_heading_line(next_line))
        if valid_heading_title(title):
            return code, title
    return None


def lesson_text(pages: list[ExtractedPage]) -> str:
    chunks = []
    for page in pages:
        heading = f"[{page.file_name} | page {page.page_number} | global {page.global_page_number}]"
        body = page.text.strip()
        chunks.append(f"{heading}\n{body}" if body else f"{heading}\n")
    return "\n\n".join(chunks).strip()


def lesson_status(pages: list[ExtractedPage]) -> str:
    if not pages:
        return "failed"
    extracted = sum(1 for page in pages if page.char_count >= 20)
    needs_ocr = sum(1 for page in pages if page.needs_ocr)
    return extraction_status(len(pages), extracted, needs_ocr)


def extraction_status(page_count: int, extracted_page_count: int, needs_ocr_page_count: int) -> str:
    if page_count == 0:
        return "failed"
    if extracted_page_count == 0 and needs_ocr_page_count:
        return "needs_ocr"
    if needs_ocr_page_count > max(3, math.floor(page_count * 0.2)):
        return "partial"
    return "complete"


def estimate_minutes(pages: list[ExtractedPage]) -> int:
    chars = sum(page.char_count for page in pages)
    return max(10, min(90, round(chars / 900)))


def clean_text(text: str) -> str:
    text = text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    lines = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def useful_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def is_overview_page(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in OVERVIEW_PHRASES)


def looks_like_toc_page(text: str) -> bool:
    lowered = text.lower()
    if "kandungan" in lowered or "contents" in lowered:
        return True
    lines = useful_lines(text)
    code_lines = 0
    chapter_lines = 0
    for line in lines:
        normalized = normalize_heading_line(line)
        if START_HEADING_RE.match(normalized) or END_HEADING_RE.match(normalized):
            code_lines += 1
        if re.match(r"^(chapter|bab)\s+\d+", normalized, re.IGNORECASE):
            chapter_lines += 1
    return code_lines >= 5 and chapter_lines >= 2


def looks_like_real_toc_page(text: str) -> bool:
    lowered = text.lower()
    lines = useful_lines(text)
    normalized_lines = [normalize_heading_line(line) for line in lines]
    code_lines = sum(
        1
        for line in normalized_lines
        if START_HEADING_RE.match(line) or END_HEADING_RE.match(line) or CODE_ONLY_RE.match(line)
    )
    if any(("kandungan" in line.lower()) or line.lower() == "contents" for line in normalized_lines) and code_lines >= 4:
        return True
    first_lines = {line.lower() for line in normalized_lines[:8]}
    has_intro_label = bool(first_lines.intersection({"pendahuluan", "introduction", "formulae"}))
    has_front_matter_label = bool(
        set(line.lower() for line in normalized_lines[:12]).intersection(
            {"halaman judul", "halaman hak cipta dan penghargaan"}
        )
    )
    has_chapter_theme_structure = "tema" in lowered and bool(re.search(r"\b(bab|chapter)\b", lowered))
    chapter_line_count = sum(
        1 for line in normalized_lines if re.match(r"^(chapter|bab)\s+\d+", line, re.IGNORECASE)
    )
    first_content_line = next((line for line in normalized_lines if not line.isdigit()), "")
    starts_with_chapter = bool(re.match(r"^(chapter|bab)\s+\d+", first_content_line, re.IGNORECASE))
    has_book_structure = (
        has_intro_label
        or has_front_matter_label
        or has_chapter_theme_structure
        or (chapter_line_count >= 2 and starts_with_chapter)
    )
    return code_lines >= 8 and has_book_structure


def real_toc_page_numbers_for_detection(pages: list[ExtractedPage]) -> list[int]:
    toc_pages: list[int] = []
    started = False
    last_toc_page = 0
    for page in pages:
        if page.global_page_number > 25:
            continue
        is_real = looks_like_real_toc_page(page.text)
        if (
            not is_real
            and started
            and page.global_page_number <= last_toc_page + 2
            and looks_like_toc_continuation_page(page.text)
        ):
            is_real = True
        if is_real:
            toc_pages.append(page.global_page_number)
            started = True
            last_toc_page = page.global_page_number
    return toc_pages


def looks_like_toc_continuation_page(text: str) -> bool:
    lines = useful_lines(text)
    normalized_lines = [normalize_heading_line(line) for line in lines]
    code_lines = sum(
        1
        for line in normalized_lines
        if START_HEADING_RE.match(line) or END_HEADING_RE.match(line) or CODE_ONLY_RE.match(line)
    )
    has_chapter_marker = any(
        line in {"bab", "chapter"} or re.match(r"^(bab|chapter)\s+\d+", line, re.IGNORECASE)
        for line in (item.lower() for item in normalized_lines)
    )
    return code_lines >= 4 and has_chapter_marker


def normalize_heading_line(line: str) -> str:
    line = re.sub(r"\s+", " ", line).strip(" .:\t")
    line = re.sub(r"\b(\d{1,2})\s+\.\s+(\d{1,2})\b", r"\1.\2", line)
    if not line or len(line) > 180:
        return ""
    if "http://" in line.lower() or "https://" in line.lower():
        return ""
    return line


def strip_leading_standard_codes(value: str) -> str:
    value = LEADING_STANDARD_CODES_RE.sub("", value).strip()
    return value.strip(" .:-")


def valid_heading_title(title: str) -> bool:
    title = title.strip()
    if len(title) < 4 or len(title) > 140:
        return False
    if title[0].isdigit():
        return False
    lowered = title.lower().strip(" .:-")
    if any(lowered.startswith(prefix) for prefix in EXCLUDED_HEADING_PREFIXES):
        return False
    if lowered in {"bab", "chapter", "tema", "theme"}:
        return False
    first_alpha = next((char for char in title if char.isalpha()), "")
    if first_alpha and first_alpha.islower() and not title.startswith(("pH", "e-")):
        return False
    letters = sum(1 for char in title if char.isalpha())
    return letters >= 3


def valid_topic_code(code: str) -> bool:
    try:
        chapter, subtopic = [int(part) for part in code.split(".")]
    except ValueError:
        return False
    return 1 <= chapter <= 20 and 1 <= subtopic <= 20


def infer_title_from_text(text: str) -> str | None:
    for line in useful_lines(text)[:20]:
        normalized = normalize_heading_line(line)
        if valid_heading_title(normalized):
            return normalized
    return None


def chunk_text(text: str, size: int) -> list[str]:
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + size)
        if end < len(text):
            newline = text.rfind("\n", start, end)
            if newline > start + size // 2:
                end = newline
        chunks.append(text[start:end].strip())
        start = end
    return [chunk for chunk in chunks if chunk]


def excerpt(text: str, length: int) -> str:
    one_line = re.sub(r"\s+", " ", text).strip()
    if len(one_line) <= length:
        return one_line
    return one_line[: length - 1].rstrip() + "..."


def truncate(value: str | None, length: int) -> str | None:
    if value is None:
        return None
    return value if len(value) <= length else value[: length - 1].rstrip() + "..."


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "source"


def short_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:10]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_ocr_sidecar(path: Path) -> tuple[dict[int, str], dict[str, Any] | None]:
    sidecar = path.with_suffix(".ocr.json")
    if not sidecar.exists():
        return {}, None
    data = json.loads(sidecar.read_text(encoding="utf-8"))
    pages: dict[int, str] = {}
    for item in data.get("pages", []):
        try:
            page_number = int(item.get("page_number"))
        except (TypeError, ValueError):
            continue
        pages[page_number] = str(item.get("text") or "")
    metadata = {
        "path": str(sidecar.resolve()),
        "method": data.get("method", "rapidocr_onnxruntime"),
        "page_count": len(pages),
    }
    return pages, metadata


def connect_db():
    env = read_env(Path(".env"))
    database_url = env.get("DATABASE_URL") or os.environ.get("DATABASE_URL")
    if database_url:
        return psycopg2.connect(database_url)

    return psycopg2.connect(
        dbname=env.get("DB_NAME", "eduapp"),
        user=env.get("DB_USER", "tusyen-online"),
        password=env.get("DB_PASSWORD", "tusyen-online123"),
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
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


if __name__ == "__main__":
    raise SystemExit(main())
