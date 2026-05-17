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
    "foto",
    "gambar",
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
TOC_ANY_CODE_RE = re.compile(r"^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?(?:\s+.+)?$")
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
            ocr_text = clean_text(ocr_pages.get(page_index + 1, ""))
            if ocr_text and should_use_ocr_text(text, ocr_text):
                text = ocr_text
                extraction_method = "rapidocr_onnxruntime"
            char_count = len(text.strip())
            image_count = len(page.get_images(full=False))
            needs_ocr = (char_count < 20 or is_fliphtml_header_only_text(text)) and image_count > 0
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
    manual_candidates = manual_heading_candidates(source, pages)
    if manual_candidates:
        candidates = manual_candidates
    else:
        toc_details = extract_toc_entries_detailed(pages)
        toc_entries = {entry["code"]: entry["title"] for entry in toc_details}
        toc_page_numbers = real_toc_page_numbers_for_detection(pages)
        minimum_heading_page = max(toc_page_numbers, default=0) + 1 if toc_entries else 1
        heading_candidates = find_heading_candidates(pages, minimum_global_page=minimum_heading_page)
        heading_candidates.extend(synthetic_heading_candidates_from_toc(pages, toc_details))
        candidates = unique_heading_candidates(
            heading_candidates,
            toc_entries,
        )
        candidates = filter_out_of_order_candidates(candidates)
        if not candidates:
            return fallback_lesson_segments(source, pages)

    return lesson_segments_from_candidates(source, pages, candidates)


def lesson_segments_from_candidates(
    source: SourceSpec,
    pages: list[ExtractedPage],
    candidates: list[HeadingCandidate],
) -> list[LessonSegment]:
    if not candidates:
        return fallback_lesson_segments(source, pages)

    candidates = sorted(candidates, key=lambda item: (item.global_page_number, item.line_index))
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


def manual_heading_candidates(source: SourceSpec, pages: list[ExtractedPage]) -> list[HeadingCandidate]:
    entries: list[tuple[str, str, int]] = []
    manual_key = ""

    if source.form_level == 4 and source.subject == "Science" and source.language == "ms":
        manual_key = "manual_verified_form4_science"
        entries = [
            ("1.1", "Peralatan Perlindungan Diri", 13),
            ("1.2", "Pembuangan Bahan Sisa", 15),
            ("1.3", "Pemadam Kebakaran", 19),
            ("2.1", "Resusitasi Kardiopulmonari (Cardiopulmonary Resuscitation, CPR)", 29),
            ("2.2", "Heimlich Manoeuvre", 34),
            ("3.1", "Suhu Badan", 43),
            ("3.2", "Kadar Denyutan Nadi", 46),
            ("3.3", "Tekanan Darah", 50),
            ("3.4", "Indeks Jisim Badan (Body Mass Index, BMI)", 52),
            ("4.1", "Kelestarian Alam Sekitar", 61),
            ("4.2", "Sektor Tenaga", 65),
            ("4.3", "Sektor Pengurusan Sisa dan Air Sisa", 69),
            ("4.4", "Sektor Pertanian dan Perhutanan", 71),
            ("4.5", "Sektor Pengangkutan", 74),
            ("4.6", "Teknologi Hijau dan Kehidupan", 77),
            ("5.1", "Pembahagian Sel", 85),
            ("5.2", "Pewarisan", 93),
            ("5.3", "Mutasi", 99),
            ("5.4", "Teknologi Kejuruteraan Genetik", 109),
            ("5.5", "Variasi", 112),
            ("6.1", "Sokongan, Pergerakan dan Pertumbuhan Haiwan", 123),
            ("6.2", "Pergerakan dan Pertumbuhan Manusia", 137),
            ("6.3", "Sokongan, Pertumbuhan dan Kestabilan dalam Tumbuhan", 142),
            ("7.1", "Sistem Endokrin Manusia", 153),
            ("7.2", "Gangguan kepada Koordinasi Badan", 161),
            ("7.3", "Minda yang Sihat", 167),
            ("8.1", "Asas Jirim", 177),
            ("8.2", "Jadual Berkala Unsur Moden", 180),
            ("8.3", "Isotop", 184),
            ("9.1", "Aloi", 193),
            ("9.2", "Kaca dan Seramik", 198),
            ("9.3", "Polimer", 201),
            ("10.1", "Perubatan Tradisional, Perubatan Moden dan Perubatan Komplementari", 213),
            ("10.2", "Radikal Bebas", 221),
            ("10.3", "Bahan Antioksidan", 223),
            ("10.4", "Produk Kesihatan", 226),
            ("11.1", "Gerakan Linear", 236),
            ("11.2", "Graf Gerakan Linear", 244),
            ("11.3", "Pecutan Graviti dan Jatuh Bebas", 248),
            ("11.4", "Jisim dan Inersia", 255),
            ("12.1", "Penggunaan Tenaga Nuklear", 265),
            ("12.2", "Penghasilan Tenaga Nuklear", 267),
            ("12.3", "Impak Penggunaan Tenaga Nuklear", 272),
            ("12.4", "Tenaga Nuklear di Malaysia", 275),
        ]
    elif source.form_level == 4 and source.subject == "Additional Science":
        manual_key = "manual_verified_form4_additional_science_spread_pdf"
        entries = [
            ("1.1", "Evidens bagi Evolusi", 8),
            ("1.2", "Teori Evolusi", 10),
            ("1.3", "Pengelasan Organisma", 14),
            ("2.1", "Komponen Abiotik dan Biotik serta Interaksi dalam Ekosistem", 17),
            ("2.2", "Proses Pengkolonian dan Proses Sesaran dalam Tumbuhan", 22),
            ("2.3", "Ekologi Populasi", 24),
            ("2.4", "Ancaman terhadap Ekosistem", 26),
            ("3.1", "Sejarah Jadual Berkala Unsur", 29),
            ("3.2", "Kumpulan 1", 32),
            ("3.3", "Kumpulan 17", 35),
            ("3.4", "Kumpulan 18", 39),
            ("3.5", "Kala 3", 42),
            ("3.6", "Unsur Peralihan", 45),
            ("4.1", "Jisim Atom Relatif, Jisim Molekul Relatif dan Jisim Formula Relatif", 50),
            ("4.2", "Konsep Mol", 52),
            ("4.3", "Formula Kimia", 55),
            ("4.4", "Konsep Mol dalam Persamaan Kimia", 58),
            ("4.5", "Larutan Piawai", 60),
            ("5.1", "Kestabilan Unsur", 64),
            ("5.2", "Ikatan Ion", 66),
            ("5.3", "Ikatan Kovalen", 68),
            ("6.1", "Penghasilan Tenaga Elektrik daripada Tindak Balas Kimia", 72),
            ("6.2", "Tindak Balas Redoks", 75),
            ("7.1", "Kuantiti Skalar dan Kuantiti Vektor", 80),
            ("7.2", "Daya", 84),
            ("7.3", "Momentum", 88),
            ("7.4", "Impuls", 92),
            ("8.1", "Keseimbangan Terma", 96),
            ("8.2", "Muatan Haba Tentu", 98),
            ("8.3", "Haba Pendam Tentu", 101),
        ]
    elif source.form_level == 5 and source.subject == "Additional Science":
        manual_key = "manual_verified_form5_additional_science_spread_pdf"
        entries = [
            ("1.1", "Penghantaran Impuls dalam Sistem Saraf", 8),
            ("1.2", "Pergerakan Otot Rangka dalam Sistem Muskuloskeletal", 12),
            ("1.3", "Mekanisme Pembekuan Darah dalam Sistem Peredaran Darah", 17),
            ("1.4", "Penghasilan Urin dalam Sistem Urinari", 18),
            ("2.1", "Garam", 23),
            ("2.2", "Analisis Kualitatif Garam", 30),
            ("3.1", "Teknologi Hijau dan Pengurusan Minyak Sawit Terpakai", 38),
            ("4.1", "Tenaga Cahaya dalam Tindak Balas Kimia", 43),
            ("4.2", "Tenaga Haba dalam Tindak Balas Kimia", 45),
            ("4.3", "Tenaga Elektrik dalam Tindak Balas Kimia", 47),
            ("5.1", "Bahan Termaju", 52),
            ("6.1", "Penghasilan Gelombang", 60),
            ("6.2", "Resonans", 66),
            ("6.3", "Sifat Gelombang", 67),
            ("6.4", "Gelombang Mekanik dan Gelombang Elektromagnet", 73),
            ("7.1", "Arus Elektrik dan Beza Keupayaan", 76),
            ("7.2", "Rintangan Elektrik", 78),
            ("7.3", "Tenaga Elektrik dan Kuasa Elektrik", 83),
            ("8.1", "Lautan", 87),
            ("8.2", "Pemetaan Lantai Lautan", 92),
            ("8.3", "Sifat Fizik Air Laut", 93),
            ("8.4", "Biologi Laut", 95),
            ("8.5", "Edaran Air Laut", 96),
            ("8.6", "Sumber Laut", 98),
            ("8.7", "Isu dan Cabaran Berkaitan Lautan", 101),
        ]
    elif source.form_level == 5 and source.subject == "Additional Mathematics":
        manual_key = "manual_verified_form5_additional_mathematics"
        entries = [
            ("1.1", "Radian", 7),
            ("1.2", "Panjang Lengkok Suatu Bulatan", 15),
            ("1.3", "Luas Sektor Suatu Bulatan", 22),
            ("1.4", "Aplikasi Sukatan Membulat", 30),
            ("2.1", "Had dan Hubungannya dengan Pembezaan", 40),
            ("2.2", "Pembezaan Peringkat Pertama", 48),
            ("2.3", "Pembezaan Peringkat Kedua", 51),
            ("2.4", "Aplikasi Pembezaan", 61),
            ("3.1", "Pengamiran sebagai Songsangan Pembezaan", 92),
            ("3.2", "Kamiran Tak Tentu", 95),
            ("3.3", "Kamiran Tentu", 99),
            ("3.4", "Aplikasi Pengamiran", 121),
            ("4.1", "Pilih Atur", 130),
            ("4.2", "Gabungan", 142),
            ("5.1", "Pemboleh Ubah Rawak", 152),
            ("5.2", "Taburan Binomial", 154),
            ("5.3", "Taburan Normal", 176),
            ("6.1", "Sudut Positif dan Sudut Negatif", 200),
            ("6.2", "Nisbah Trigonometri bagi Sebarang Sudut", 203),
            ("6.3", "Graf Fungsi Sinus, Kosinus dan Tangen", 211),
            ("6.4", "Identiti Asas", 221),
            ("6.5", "Rumus Sudut Majmuk dan Rumus Sudut Berganda", 225),
            ("6.6", "Aplikasi Fungsi Trigonometri", 235),
            ("7.1", "Model Pengaturcaraan Linear", 244),
            ("7.2", "Aplikasi Pengaturcaraan Linear", 250),
            ("8.1", "Sesaran, Halaju dan Pecutan sebagai Fungsi Masa", 262),
            ("8.2", "Pembezaan dalam Kinematik Gerakan Linear", 270),
            ("8.3", "Pengamiran dalam Kinematik Gerakan Linear", 277),
            ("8.4", "Aplikasi Kinematik Gerakan Linear", 282),
        ]
    elif source.form_level == 4 and source.subject == "Reka Cipta":
        manual_key = "manual_verified_form4_reka_cipta"
        entries = [
            ("1.0", "Pengenalan kepada Reka Cipta", 9),
            ("2.0", "Asas Reka Bentuk dalam Reka Cipta", 33),
            ("3.0", "Faktor Pemilihan Reka Bentuk dalam Reka Cipta", 61),
            ("4.0", "Pengenalpastian Masalah", 75),
            ("5.0", "Penyelidikan dan Kajian Produk", 95),
            ("6.0", "Penjanaan Idea", 105),
            ("7.0", "Model Olokan (Mock-Up)", 123),
            ("8.0", "Lukisan Kerja", 139),
        ]
    elif source.form_level == 4 and source.subject == "Sports Science":
        manual_key = "manual_verified_form4_sports_science"
        entries = [
            ("1.1", "Pengenalan Sains Sukan", 12),
            ("1.2", "Dasar Sukan Negara", 25),
            ("1.3", "Pengurusan dan Pengelolaan Pertandingan Sukan", 33),
            ("2.1", "Pengenalan Sistem Tubuh Manusia", 78),
            ("2.2", "Sokongan dan Pergerakan", 86),
            ("2.3", "Kawal Atur Sistem Tubuh Manusia", 107),
            ("2.4", "Fungsi Sistem Kardiorespiratori", 124),
            ("2.5", "Penghasilan Tenaga", 141),
            ("2.6", "Adaptasi Sistem Tubuh Manusia", 153),
            ("3.1", "Satah dan Pergerakan Asas", 174),
            ("3.2", "Jenis-jenis Gerakan", 182),
            ("3.3", "Asas Kinematik Gerakan", 189),
            ("3.4", "Asas Kinetik Gerakan", 199),
            ("3.5", "Hukum Newton", 209),
            ("3.6", "Stabiliti", 218),
            ("3.7", "Asas Kemahiran Motor Manusia", 224),
            ("3.8", "Pembelajaran Kemahiran Motor", 235),
        ]
    elif source.form_level == 5 and source.subject == "Sports Science":
        manual_key = "manual_verified_form5_sports_science"
        entries = [
            ("4.1", "Pengenalan Kecergasan", 12),
            ("4.2", "Prinsip Latihan Fizikal", 20),
            ("4.3", "Pengukuran Kecergasan Fizikal", 41),
            ("4.4", "Kaedah Latihan Fizikal", 50),
            ("5.1", "Pengenalan Pemakanan Sukan", 82),
            ("5.2", "Keperluan Tenaga dan Sumber Tenaga dalam Pemakanan Sukan", 87),
            ("5.3", "Bendalir Tubuh, Elektrolit dan Pentermokawalaturan", 92),
            ("5.4", "Bantuan Ergogenik Pemakanan", 100),
            ("5.5", "Strategi Pemakanan Sukan", 107),
            ("6.1", "Asas Psikologi dalam Sukan", 120),
            ("6.2", "Motivasi dan Penetapan Matlamat", 126),
            ("6.3", "Keagresifan dalam Sukan", 142),
            ("6.4", "Kebimbangan dan Kemahiran Psikologi Sukan", 158),
            ("6.5", "Pengenalan Sosiologi Sukan", 176),
            ("6.6", "Kesan Penglibatan dalam Sukan", 178),
            ("7.1", "Pengenalan Kecederaan Sukan", 182),
            ("7.2", "Jenis-jenis Kecederaan Sukan", 189),
            ("7.3", "Pengurusan Kecederaan Sukan", 197),
            ("7.4", "Terapi dan Rehabilitasi Sukan", 212),
            ("7.5", "Stres Haba", 220),
        ]
    elif source.form_level == 5 and source.subject == "Biology" and source.language == "ms":
        manual_key = "manual_verified_form5_biology"
        entries = [
            ("1.1", "Organisasi Tisu Tumbuhan", 4),
            ("1.2", "Tisu Meristem dan Pertumbuhan", 6),
            ("1.3", "Lengkung Pertumbuhan", 17),
            ("2.1", "Struktur Daun", 28),
            ("2.2", "Organ Utama Pertukaran Gas", 31),
            ("2.3", "Organ Utama Transpirasi", 36),
            ("2.4", "Organ Utama Fotosintesis", 40),
            ("2.5", "Titik Pampasan", 52),
            ("3.1", "Nutrien Tak Organik Utama", 60),
            ("3.2", "Organ Pengambilan Air dan Garam Mineral", 65),
            ("3.3", "Kepelbagaian dalam Nutrisi Tumbuhan", 68),
            ("4.1", "Tisu Vaskular", 76),
            ("4.2", "Pengangkutan Air dan Garam Mineral", 79),
            ("4.3", "Translokasi", 86),
            ("4.4", "Fitoremediasi", 89),
            ("5.1", "Jenis Gerak Balas", 98),
            ("5.2", "Fitohormon", 103),
            ("5.3", "Aplikasi Fitohormon dalam Pertanian", 107),
            ("6.1", "Struktur Bunga", 114),
            ("6.2", "Pembentukan Debunga dan Pundi Embrio", 116),
            ("6.3", "Pendebungaan dan Persenyawaan", 120),
            ("6.4", "Perkembangan Biji Benih dan Buah", 125),
            ("6.5", "Kepentingan Biji Benih untuk Kemandirian", 127),
            ("7.1", "Penyesuaian Tumbuhan Berdasarkan Habitat", 134),
            ("8.1", "Sistem Pengelasan dan Penamaan Organisma", 144),
            ("8.2", "Biodiversiti", 152),
            ("8.3", "Mikroorganisma dan Virus", 155),
            ("9.1", "Komuniti dan Ekosistem", 170),
            ("9.2", "Ekologi Populasi", 190),
            ("10.1", "Ancaman Alam Sekitar", 202),
            ("10.2", "Pemeliharaan, Pemuliharaan dan Pemulihan Ekosistem", 211),
            ("10.3", "Amalan dalam Melestarikan Alam Sekitar", 213),
            ("10.4", "Teknologi Hijau", 218),
            ("11.1", "Pewarisan Monohibrid", 230),
            ("11.2", "Pewarisan Dihibrid", 238),
            ("11.3", "Gen dan Alel", 240),
            ("11.4", "Pewarisan Manusia", 242),
            ("12.1", "Jenis dan Faktor Variasi", 256),
            ("12.2", "Variasi dalam Manusia", 266),
            ("12.3", "Mutasi", 269),
            ("13.1", "Kejuruteraan Genetik", 280),
            ("13.2", "Bioteknologi", 284),
        ]

    if not entries:
        return []

    page_numbers = {page.global_page_number for page in pages}
    return [
        HeadingCandidate(
            code=code,
            title=title,
            global_page_number=global_page_number,
            line_index=-2,
            source_line=manual_key,
        )
        for code, title, global_page_number in entries
        if global_page_number in page_numbers
    ]


def synthetic_heading_candidates_from_toc(
    pages: list[ExtractedPage],
    toc_details: list[dict[str, Any]],
) -> list[HeadingCandidate]:
    """Use TOC printed page numbers as fallback heading anchors."""
    if not toc_details:
        return []

    offset = infer_printed_page_offset(pages)
    if offset is None:
        return []

    page_numbers = {page.global_page_number for page in pages}
    candidates: list[HeadingCandidate] = []
    for entry in toc_details:
        printed_page = entry.get("printed_page")
        if not isinstance(printed_page, int):
            continue

        global_page = printed_page + offset
        if global_page not in page_numbers:
            continue

        candidates.append(
            HeadingCandidate(
                code=entry["code"],
                title=entry["title"],
                global_page_number=global_page,
                line_index=-1,
                source_line=f"toc:{entry.get('toc_global_page')} printed_page:{printed_page}",
            )
        )
    return candidates


def infer_printed_page_offset(pages: list[ExtractedPage]) -> int | None:
    """Infer global_page_number - printed_page from page-number lines."""
    offsets: dict[int, int] = {}
    for page in pages:
        for line in edge_lines_for_page_number(page.text):
            normalized = normalize_heading_line(line)
            if not is_plain_page_number(normalized):
                continue

            printed_page = int(normalized)
            if not 1 <= printed_page <= 500:
                continue

            offset = page.global_page_number - printed_page
            if offset < 0 or offset > 80:
                continue
            offsets[offset] = offsets.get(offset, 0) + 1
            break

    if not offsets:
        return None

    offset, count = max(offsets.items(), key=lambda item: (item[1], -item[0]))
    if count < 2:
        return None
    return offset


def edge_lines_for_page_number(text: str) -> list[str]:
    lines = useful_lines(text)
    if len(lines) <= 12:
        return lines
    return lines[:6] + lines[-6:]


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
    use_toc_filter = len(toc_entries) >= 3
    if use_toc_filter:
        grouped: dict[str, list[HeadingCandidate]] = {}
        for candidate in candidates:
            if candidate.code in toc_entries:
                grouped.setdefault(candidate.code, []).append(candidate)

        selected: list[HeadingCandidate] = []
        last_position = (0, -1)
        ordered_codes = sorted(toc_entries.keys(), key=code_tuple)
        for index, code in enumerate(ordered_codes):
            title = toc_entries[code]
            matches = [
                item
                for item in grouped.get(code, [])
                if (item.global_page_number, item.line_index) > last_position
            ]
            if not matches:
                continue

            synthetic_matches = [item for item in matches if item.source_line.startswith("toc:")]
            chosen = synthetic_matches[0] if synthetic_matches else None
            next_position = next_candidate_position_after(grouped, ordered_codes[index + 1 :], last_position)
            if chosen is None:
                chosen = next(
                    (
                        item
                        for item in matches
                        if titles_match(item.title, title)
                        and (next_position is None or (item.global_page_number, item.line_index) < next_position)
                    ),
                    None,
                )
            if chosen is None:
                chosen = next(
                    (
                        item
                        for item in matches
                        if item.title.strip().lower() == "kandungan"
                        and (next_position is None or (item.global_page_number, item.line_index) < next_position)
                    ),
                    matches[0],
                )
            chosen.title = title
            selected.append(chosen)
            last_position = (chosen.global_page_number, chosen.line_index)
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


def next_candidate_position_after(
    grouped: dict[str, list[HeadingCandidate]],
    codes: list[str],
    last_position: tuple[int, int],
) -> tuple[int, int] | None:
    positions = [
        (item.global_page_number, item.line_index)
        for code in codes
        for item in grouped.get(code, [])
        if (item.global_page_number, item.line_index) > last_position
    ]
    return min(positions) if positions else None


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
    return {entry["code"]: entry["title"] for entry in extract_toc_entries_detailed(pages)}


def extract_toc_entries_detailed(pages: list[ExtractedPage]) -> list[dict[str, Any]]:
    entries: dict[str, str] = {}
    detailed: list[dict[str, Any]] = []
    toc_page_numbers = set(real_toc_page_numbers_for_detection(pages))
    for page in pages:
        if page.global_page_number not in toc_page_numbers:
            continue
        lines = collapse_repeated_toc_lines(useful_lines(page.text))
        index = 0
        while index < len(lines):
            parsed = toc_entry_from_context(lines, index)
            if not parsed:
                index += 1
                continue
            code, title, printed_page, next_index = parsed
            index = max(next_index, index + 1)
            if code in entries:
                continue
            entries.setdefault(code, title)
            detailed.append(
                {
                    "code": code,
                    "title": title,
                    "printed_page": printed_page,
                    "toc_global_page": page.global_page_number,
                }
            )
    return detailed


def toc_entry_from_context(lines: list[str], index: int) -> tuple[str, str, int | None, int] | None:
    normalized = normalize_heading_line(lines[index])
    if not normalized:
        return None

    match = START_HEADING_RE.match(normalized)
    if match and valid_topic_code(match.group("code")):
        code = match.group("code")
        title, printed_page = split_title_page(match.group("title"))
        title_parts = [title] if title else []
        next_index = index + 1
        while printed_page is None and next_index < len(lines):
            next_line = normalize_heading_line(lines[next_index])
            if starts_new_toc_item(next_line):
                break
            inline_page = parse_toc_printed_page_line(next_line)
            if inline_page is not None:
                printed_page = inline_page
                next_index += 1
                break
            if is_plain_page_number(next_line):
                printed_page = int(next_line)
                next_index += 1
                break
            if is_toc_title_continuation(next_line):
                title_parts.append(next_line)
            next_index += 1
        if printed_page is not None:
            next_index = append_toc_title_continuations(lines, next_index, title_parts)
        title = clean_toc_title(" ".join(title_parts))
        if valid_heading_title(title):
            return code, title, printed_page, next_index
        return None

    match = CODE_ONLY_RE.match(normalized)
    if match and valid_topic_code(match.group("code")):
        code = match.group("code")
        title_parts: list[str] = []
        printed_page = None
        next_index = index + 1
        while next_index < len(lines):
            next_line = normalize_heading_line(lines[next_index])
            if starts_new_toc_item(next_line):
                break
            inline_page = parse_toc_printed_page_line(next_line)
            if inline_page is not None:
                printed_page = inline_page
                next_index += 1
                break
            if is_plain_page_number(next_line):
                printed_page = int(next_line)
                next_index += 1
                break
            if is_toc_title_continuation(next_line):
                title_parts.append(next_line)
            next_index += 1
        if printed_page is not None:
            next_index = append_toc_title_continuations(lines, next_index, title_parts)
        title = clean_toc_title(" ".join(title_parts))
        if valid_heading_title(title):
            return code, title, printed_page, next_index
        return None

    parsed = toc_entry_from_line(normalized)
    if not parsed:
        return None
    code, title = parsed
    return code, title, None, index + 1


def collapse_repeated_toc_lines(lines: list[str]) -> list[str]:
    normalized_lines = [normalize_heading_line(line) for line in lines]
    pair_collapsed: list[str] = []
    index = 0
    while index < len(lines):
        if (
            index + 3 < len(lines)
            and normalized_lines[index]
            and normalized_lines[index] == normalized_lines[index + 2]
            and normalized_lines[index + 1]
            and normalized_lines[index + 1] == normalized_lines[index + 3]
        ):
            pair_collapsed.extend([lines[index], lines[index + 1]])
            index += 4
            continue
        pair_collapsed.append(lines[index])
        index += 1

    collapsed: list[str] = []
    last = ""
    for line in pair_collapsed:
        normalized = normalize_heading_line(line)
        if normalized and normalized == last:
            continue
        collapsed.append(line)
        last = normalized
    return collapsed


def split_title_page(value: str) -> tuple[str, int | None]:
    value = strip_leading_standard_codes(value).strip()
    match = re.match(r"^(?P<title>.*?\D)\s+(?P<page>\d{1,3})$", value)
    if not match:
        return value, None
    return match.group("title").strip(), int(match.group("page"))


def starts_new_toc_item(line: str) -> bool:
    if not line:
        return False
    return bool(START_HEADING_RE.match(line) or CODE_ONLY_RE.match(line) or TOC_ANY_CODE_RE.match(line))


def is_plain_page_number(line: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}", line))


def parse_toc_printed_page_line(line: str) -> int | None:
    match = re.fullmatch(r"(?P<page>\d{1,3})(?:\s+\d{1,2})?", line)
    if not match:
        return None
    return int(match.group("page"))


def append_toc_title_continuations(lines: list[str], index: int, title_parts: list[str]) -> int:
    consumed = 0
    while index < len(lines) and consumed < 2:
        line = normalize_heading_line(lines[index])
        if starts_new_toc_item(line) or is_plain_page_number(line) or parse_toc_printed_page_line(line) is not None:
            break
        if not is_toc_title_continuation(line):
            break
        title_parts.append(line)
        index += 1
        consumed += 1
    return index


def is_toc_title_continuation(line: str) -> bool:
    if not line:
        return False
    lowered = line.lower().strip()
    if lowered in {"bab", "chapter", "tema", "theme", "kandungan", "contents"}:
        return False
    if lowered in {
        "rumusan",
        "rumusan bab",
        "refleksi",
        "refleksi kendiri",
        "latihan sumatif",
        "penilaian kendiri",
        "glosari",
        "bibliografi",
        "indeks",
        "jawapan",
    }:
        return False
    if lowered.startswith(("bab ", "chapter ", "tema ")):
        return False
    if re.fullmatch(r"[ivxlcdm]+", lowered):
        return False
    if re.fullmatch(r"\d+", lowered):
        return False
    return any(char.isalpha() for char in line)


def clean_toc_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" .\t")
    value = re.sub(
        r"\s+(?:Latihan Pengukuhan|Rumusan|Refleksi Kendiri|Latihan Sumatif)\b.*$",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" .\t")
    return value


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


def should_use_ocr_text(extracted_text: str, ocr_text: str) -> bool:
    if not ocr_text.strip():
        return False
    if len(extracted_text.strip()) < 20:
        return True
    if is_fliphtml_header_only_text(extracted_text) and len(meaningful_fliphtml_lines(ocr_text)) >= 2:
        return True
    return False


def is_fliphtml_header_only_text(text: str) -> bool:
    lowered = text.lower()
    if "fliphtml5.com" not in lowered:
        return False
    return len(" ".join(meaningful_fliphtml_lines(text))) < 80


def meaningful_fliphtml_lines(text: str) -> list[str]:
    meaningful = []
    for line in useful_lines(text):
        normalized = normalize_heading_line(line)
        lowered = normalized.lower()
        if not normalized:
            continue
        if "fliphtml5.com" in lowered:
            continue
        if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4},?\s+\d{1,2}:\d{2}\s*(?:am|pm)", lowered):
            continue
        if re.fullmatch(r"page\s+\d+\s+of\s+\d+", lowered):
            continue
        meaningful.append(normalized)
    return meaningful


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
    has_contents_label = any(is_contents_label(line) for line in normalized_lines)
    if not has_contents_label and any(
        line.lower().startswith(("aktiviti", "eksperimen", "latihan formatif", "praktis formatif"))
        for line in normalized_lines[:20]
    ):
        return False
    code_lines = sum(
        1
        for line in normalized_lines
        if START_HEADING_RE.match(line) or END_HEADING_RE.match(line) or CODE_ONLY_RE.match(line)
    )
    if has_contents_label and code_lines >= 4:
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


def is_contents_label(line: str) -> bool:
    lowered = line.lower().strip()
    return lowered in {"kandungan", "isi kandungan", "contents", "table of contents"}


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
    return code_lines >= 4 and (has_chapter_marker or code_lines >= 8)


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
        value = value.strip().strip('"').strip("'")
        values[key.strip()] = value
    return values


if __name__ == "__main__":
    raise SystemExit(main())
