"""Extract KSSM textbook lessons to JSON files.

Covers all forms (T1-T5), both STEM and Other subjects.
Output: scripts/textbook_json/<form>/<subject>.json per book,
        scripts/textbook_json/index.json summary of all books.

Each book JSON contains:
  source_key, title, subject, form_level, stream, language,
  extraction_status, lesson_count, needs_ocr_page_count,
  lessons: [{ lesson_key, topic_code, topic, subtopic, title,
               lesson_type, order_index, page_count,
               extraction_status, text_content, pages }]

Run from the repo root:
  python scripts/extract_textbooks_to_json.py
  python scripts/extract_textbooks_to_json.py --forms 4 5
  python scripts/extract_textbooks_to_json.py --forms 1 2 3 --stream Other
  python scripts/extract_textbooks_to_json.py --dry-run
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import fitz


ROOT = Path("downloads/gurubesar-kssm-textbooks")
OUT_DIR = Path("scripts/textbook_json")

SUBJECT_MAP = {
    "Add Math": "Additional Mathematics",
    "Asas Kelestarian": "Asas Kelestarian",
    "Bahasa Cina": "Chinese Language",
    "Bahasa Iban": "Iban Language",
    "Bahasa Inggeris": "English Language",
    "Bahasa Jepun": "Japanese Language",
    "Bahasa Melayu": "Malay Language",
    "Biologi": "Biology",
    "Fizik": "Physics",
    "Geografi": "Geography",
    "Grafik Komunikasi Teknikal": "Technical Graphics Communication",
    "Kimia": "Chemistry",
    "Matematik": "Mathematics",
    "Pendidikan Islam": "Islamic Education",
    "Pendidikan Moral": "Moral Education",
    "Pendidikan Muzik": "Music Education",
    "Pertanian": "Agriculture",
    "PJPK": "Physical Education",
    "Reka Bentuk Dan Teknologi": "Design and Technology",
    "Reka Cipta": "Reka Cipta",
    "Sains": "Science",
    "Sains Komputer": "Computer Science",
    "Sains Rumah Tangga": "Home Science",
    "Sains Sukan": "Sports Science",
    "Sains Tambahan": "Additional Science",
    "Sejarah": "History",
    "Asas Komputer": "Computer Fundamentals",
}

EXCLUDED_HEADING_PREFIXES = (
    "aktiviti", "activity", "amali", "cabaran", "check", "contoh",
    "diagram", "determine", "draw", "example", "eksperimen", "experiment",
    "figure", "foto", "gambar", "formative", "info", "intensive practice",
    "jadual", "kata kunci", "kerjaya", "kod", "latihan", "look",
    "mastery practice", "observe", "pak21", "praktis", "practice",
    "rajah", "refleksi", "rumusan", "self", "soalan", "standard",
    "state", "table",
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
    stream: str
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
    parser.add_argument("--root", default=str(ROOT))
    parser.add_argument("--out", default=str(OUT_DIR))
    parser.add_argument("--forms", nargs="+", type=int, default=[1, 2, 3, 4, 5],
                        choices=[1, 2, 3, 4, 5])
    parser.add_argument("--stream", choices=["STEM", "Other", "all"], default="all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit-sources", type=int, default=0)
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    root = Path(args.root)
    out_dir = Path(args.out)
    streams = ["STEM", "Other"] if args.stream == "all" else [args.stream]

    sources = discover_sources(root, args.forms, streams)
    if args.limit_sources:
        sources = sources[: args.limit_sources]

    print(f"Discovered {len(sources)} textbook sources")

    if args.dry_run:
        for source in sources:
            print(f"  {source.source_key}: {len(source.files)} file(s), stream={source.stream}")
        return 0

    out_dir.mkdir(parents=True, exist_ok=True)
    index_entries = []

    for source in sources:
        book_data = extract_source(source)
        book_out_dir = out_dir / f"Tingkatan {source.form_level}" / source.stream
        book_out_dir.mkdir(parents=True, exist_ok=True)
        out_path = book_out_dir / f"{slugify(source.subject)}-tingkatan-{source.form_level}.json"
        out_path.write_text(json.dumps(book_data, indent=2, ensure_ascii=False), encoding="utf-8")

        index_entries.append({
            "source_key": source.source_key,
            "title": source.title,
            "subject": source.subject,
            "form_level": source.form_level,
            "stream": source.stream,
            "language": source.language,
            "file": str(out_path.relative_to(out_dir)),
            "lesson_count": len(book_data["lessons"]),
            "page_count": book_data["page_count"],
            "extraction_status": book_data["extraction_status"],
            "needs_ocr_page_count": book_data["needs_ocr_page_count"],
        })

        print(
            f"  {source.source_key}: "
            f"{len(source.files)} files, {book_data['page_count']} pages, "
            f"{len(book_data['lessons'])} lessons, "
            f"{book_data['needs_ocr_page_count']} OCR-needed"
        )

    index_path = out_dir / "index.json"
    index_path.write_text(
        json.dumps(
            {"generated_at": _now_iso(), "source_count": len(index_entries), "sources": index_entries},
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    total_lessons = sum(e["lesson_count"] for e in index_entries)
    total_pages = sum(e["page_count"] for e in index_entries)
    print(f"\nDone. {len(index_entries)} books, {total_lessons} lessons, {total_pages} pages")
    print(f"Index: {index_path}")
    return 0


def _now_iso() -> str:
    import datetime
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def discover_sources(root: Path, forms: list[int], streams: list[str]) -> list[SourceSpec]:
    sources: list[SourceSpec] = []
    for form in forms:
        for stream in streams:
            stream_dir = root / f"Tingkatan {form}" / stream
            if not stream_dir.exists():
                continue
            for book_dir in sorted(p for p in stream_dir.iterdir() if p.is_dir()):
                pdfs = sorted(p for p in book_dir.glob("*.pdf") if p.is_file())
                if not pdfs:
                    continue

                base_subject = parse_subject(book_dir.name, form)
                subject = SUBJECT_MAP.get(base_subject, base_subject)
                base_title = book_dir.name.removeprefix("Buku Teks ").strip()

                # T4 Sains: image-only main PDF, use alt text-layer replacement
                if book_dir.name == "Buku Teks Sains Tingkatan 4":
                    alt = book_dir / "Buku-Teks-Sains-Tingkatan-4-1.alt.pdf"
                    original_ocr = book_dir / "Buku Teks Sains KSSM TING 4.ocr.json"
                    if alt.exists():
                        sources.append(make_source(form, stream, base_title, subject, book_dir, [alt],
                                                   {"text_layer_replacement": True}))
                        continue
                    if original_ocr.exists():
                        original = [p for p in pdfs if p.name == "Buku Teks Sains KSSM TING 4.pdf"]
                        if original:
                            sources.append(make_source(form, stream, base_title, subject, book_dir, original,
                                                       {"ocr_text_sidecar": str(original_ocr.resolve())}))
                            continue

                # Add Math T4: split into multiple chapter PDFs treated as one source
                if book_dir.name == "Buku Teks Add Math Tingkatan 4" and len(pdfs) > 1:
                    for pdf in pdfs:
                        title = pdf.stem.replace("_", " ")
                        sources.append(make_source(form, stream, title, subject, book_dir, [pdf],
                                                   {"variant_source": True}))
                    continue

                sources.append(make_source(form, stream, base_title, subject, book_dir, pdfs, {}))

    return sources


def make_source(form: int, stream: str, title: str, subject: str, local_dir: Path,
                files: list[Path], metadata: dict[str, Any]) -> SourceSpec:
    language = detect_language(title, files)
    source_key = slugify(f"form-{form}-{stream.lower()}-{subject}-{title}-{language}")
    return SourceSpec(
        source_key=source_key,
        title=title,
        subject=subject,
        form_level=form,
        stream=stream,
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
    probe = " ".join([title, *[p.name for p in files]]).lower()
    english_tokens = ("dlp", "physics", "biology", "additional mathematics", "form 4", "form 5")
    return "en" if any(t in probe for t in english_tokens) else "ms"


def extract_source(source: SourceSpec) -> dict[str, Any]:
    pages: list[ExtractedPage] = []
    global_page_number = 1

    for path in source.files:
        file_key = f"{source.source_key}-{slugify(path.stem)}-{short_hash(str(path))}"
        ocr_pages = load_ocr_sidecar(path)
        extracted = extract_pdf_pages(path, file_key, global_page_number, ocr_pages)
        global_page_number += len(extracted)
        pages.extend(extracted)

    page_count = len(pages)
    extracted_count = sum(1 for p in pages if p.char_count >= 20)
    needs_ocr_count = sum(1 for p in pages if p.needs_ocr)
    status = extraction_status(page_count, extracted_count, needs_ocr_count)

    lessons = build_lesson_segments(source, pages)

    return {
        "source_key": source.source_key,
        "title": source.title,
        "subject": source.subject,
        "form_level": source.form_level,
        "stream": source.stream,
        "language": source.language,
        "metadata": source.metadata,
        "page_count": page_count,
        "extracted_page_count": extracted_count,
        "needs_ocr_page_count": needs_ocr_count,
        "extraction_status": status,
        "lesson_count": len(lessons),
        "lessons": [lesson_to_dict(lesson) for lesson in lessons],
    }


def extract_pdf_pages(path: Path, file_key: str, first_global: int,
                      ocr_pages: dict[int, str]) -> list[ExtractedPage]:
    pages = []
    with fitz.open(str(path)) as doc:
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            text = clean_text(page.get_text("text") or "")
            method = "pymupdf_text" if text.strip() else "none"
            ocr_text = clean_text(ocr_pages.get(page_index + 1, ""))
            if ocr_text and should_use_ocr(text, ocr_text):
                text = ocr_text
                method = "rapidocr_onnxruntime"
            char_count = len(text.strip())
            image_count = len(page.get_images(full=False))
            needs_ocr = (char_count < 20 or is_fliphtml_header_only(text)) and image_count > 0
            pages.append(ExtractedPage(
                file_key=file_key,
                file_name=path.name,
                page_number=page_index + 1,
                global_page_number=first_global + page_index,
                text=text,
                char_count=char_count,
                image_count=image_count,
                extraction_method=method,
                needs_ocr=needs_ocr,
            ))
    return pages


def lesson_to_dict(lesson: LessonSegment) -> dict[str, Any]:
    text_content = build_lesson_text(lesson.pages)
    return {
        "lesson_key": lesson.lesson_key,
        "topic_code": lesson.topic_code,
        "topic": lesson.topic,
        "subtopic": lesson.subtopic,
        "title": lesson.title,
        "lesson_type": lesson.lesson_type,
        "order_index": lesson.order_index,
        "page_count": len(lesson.pages),
        "extraction_status": lesson.extraction_status,
        "estimated_minutes": estimate_minutes(lesson.pages),
        "text_content": text_content,
        "char_count": len(text_content),
        "pages": [
            {
                "file_name": p.file_name,
                "page_number": p.page_number,
                "global_page_number": p.global_page_number,
                "char_count": p.char_count,
                "needs_ocr": p.needs_ocr,
                "extraction_method": p.extraction_method,
            }
            for p in lesson.pages
        ],
    }


def build_lesson_text(pages: list[ExtractedPage]) -> str:
    chunks = []
    for page in pages:
        heading = f"[{page.file_name} p{page.page_number}]"
        body = page.text.strip()
        chunks.append(f"{heading}\n{body}" if body else heading)
    return "\n\n".join(chunks).strip()


# ── Lesson segmentation (ported from extract_stem_textbooks_to_db.py) ──────────

def build_lesson_segments(source: SourceSpec, pages: list[ExtractedPage]) -> list[LessonSegment]:
    manual = manual_heading_candidates(source, pages)
    if manual:
        return lesson_segments_from_candidates(source, pages, manual)

    toc_details = extract_toc_entries_detailed(pages)
    toc_entries = {e["code"]: e["title"] for e in toc_details}
    toc_page_numbers = real_toc_page_numbers(pages)
    minimum_page = max(toc_page_numbers, default=0) + 1 if toc_entries else 1

    candidates = find_heading_candidates(pages, minimum_global_page=minimum_page)
    candidates.extend(synthetic_heading_candidates_from_toc(pages, toc_details))
    candidates = unique_heading_candidates(candidates, toc_entries)
    candidates = filter_out_of_order_candidates(candidates)

    if not candidates:
        return fallback_lesson_segments(source, pages)

    return lesson_segments_from_candidates(source, pages, candidates)


def lesson_segments_from_candidates(source: SourceSpec, pages: list[ExtractedPage],
                                    candidates: list[HeadingCandidate]) -> list[LessonSegment]:
    if not candidates:
        return fallback_lesson_segments(source, pages)

    candidates = sorted(candidates, key=lambda c: (c.global_page_number, c.line_index))
    page_by_global = {p.global_page_number: p for p in pages}
    global_numbers = [p.global_page_number for p in pages]
    lessons = []

    for index, candidate in enumerate(candidates):
        start = candidate.global_page_number
        end = (candidates[index + 1].global_page_number - 1) if index + 1 < len(candidates) else global_numbers[-1]
        if index + 1 < len(candidates) and candidates[index + 1].global_page_number == start:
            end = start

        segment_pages = [page_by_global[n] for n in global_numbers
                         if start <= n <= end and n in page_by_global]
        if not segment_pages:
            segment_pages = [page_by_global[start]]

        chapter = candidate.code.split(".")[0]
        topic = ("Chapter " if source.language == "en" else "Bab ") + chapter
        title = f"{candidate.code} {candidate.title}".strip()
        lesson_key = f"{slugify(candidate.code)}-{slugify(candidate.title)[:80]}-{index + 1:03d}"

        lessons.append(LessonSegment(
            lesson_key=lesson_key,
            topic_code=candidate.code,
            topic=topic,
            subtopic=title,
            title=title,
            lesson_type="subtopic",
            order_index=index + 1,
            pages=segment_pages,
            extraction_status=lesson_status(segment_pages),
            heading_line=candidate.source_line,
        ))

    return lessons


def fallback_lesson_segments(source: SourceSpec, pages: list[ExtractedPage]) -> list[LessonSegment]:
    if not pages:
        return []
    pages_by_file: dict[str, list[ExtractedPage]] = {}
    for page in pages:
        pages_by_file.setdefault(page.file_key, []).append(page)

    lessons = []
    for index, (file_key, file_pages) in enumerate(pages_by_file.items(), start=1):
        first_page = file_pages[0]
        raw_title = infer_title_from_text(first_page.text) or Path(first_page.file_name).stem.replace("_", " ")
        title = truncate(raw_title, 180) or source.title
        lesson_key = f"file-{index:03d}-{slugify(title)[:80]}"
        lessons.append(LessonSegment(
            lesson_key=lesson_key,
            topic_code=None,
            topic=source.title,
            subtopic=title,
            title=title,
            lesson_type="file",
            order_index=index,
            pages=file_pages,
            extraction_status=lesson_status(file_pages),
            heading_line=None,
        ))
    return lessons


def manual_heading_candidates(source: SourceSpec, pages: list[ExtractedPage]) -> list[HeadingCandidate]:
    # fmt: off
    entries: list[tuple[str, str, int]] = []
    key = ""

    if source.form_level == 4 and source.subject == "Science" and source.language == "ms":
        key = "manual_form4_science"
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
        key = "manual_form4_additional_science"
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
        key = "manual_form5_additional_science"
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
        key = "manual_form5_additional_mathematics"
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
        key = "manual_form4_reka_cipta"
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
        key = "manual_form4_sports_science"
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
        key = "manual_form5_sports_science"
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
        key = "manual_form5_biology"
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
    # fmt: on

    if not entries:
        return []

    page_numbers = {p.global_page_number for p in pages}
    return [
        HeadingCandidate(code=code, title=title, global_page_number=gpn,
                         line_index=-2, source_line=key)
        for code, title, gpn in entries
        if gpn in page_numbers
    ]


def synthetic_heading_candidates_from_toc(pages: list[ExtractedPage],
                                          toc_details: list[dict[str, Any]]) -> list[HeadingCandidate]:
    if not toc_details:
        return []
    offset = infer_printed_page_offset(pages)
    if offset is None:
        return []
    page_numbers = {p.global_page_number for p in pages}
    candidates = []
    for entry in toc_details:
        printed_page = entry.get("printed_page")
        if not isinstance(printed_page, int):
            continue
        global_page = printed_page + offset
        if global_page not in page_numbers:
            continue
        candidates.append(HeadingCandidate(
            code=entry["code"], title=entry["title"],
            global_page_number=global_page, line_index=-1,
            source_line=f"toc:{entry.get('toc_global_page')} printed_page:{printed_page}",
        ))
    return candidates


def infer_printed_page_offset(pages: list[ExtractedPage]) -> int | None:
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
    return offset if count >= 2 else None


def edge_lines_for_page_number(text: str) -> list[str]:
    lines = useful_lines(text)
    if len(lines) <= 12:
        return lines
    return lines[:6] + lines[-6:]


def find_heading_candidates(pages: list[ExtractedPage],
                            minimum_global_page: int = 1) -> list[HeadingCandidate]:
    candidates = []
    for page in pages:
        if page.global_page_number < minimum_global_page:
            continue
        if page.char_count < 50 or is_overview_page(page.text) or looks_like_real_toc_page(page.text):
            continue
        lines = useful_lines(page.text)
        for index, line in enumerate(lines):
            candidate = heading_from_line(line,
                                          previous_lines=list(reversed(lines[max(0, index - 3):index])),
                                          next_lines=lines[index + 1:index + 4])
            if not candidate:
                continue
            code, title = candidate
            candidates.append(HeadingCandidate(
                code=code, title=title,
                global_page_number=page.global_page_number,
                line_index=index, source_line=line,
            ))
    return sorted(candidates, key=lambda c: (c.global_page_number, c.line_index))


def unique_heading_candidates(candidates: list[HeadingCandidate],
                              toc_entries: dict[str, str]) -> list[HeadingCandidate]:
    if len(toc_entries) >= 3:
        grouped: dict[str, list[HeadingCandidate]] = {}
        for c in candidates:
            if c.code in toc_entries:
                grouped.setdefault(c.code, []).append(c)

        selected = []
        last_position = (0, -1)
        ordered_codes = sorted(toc_entries.keys(), key=code_tuple)
        for index, code in enumerate(ordered_codes):
            title = toc_entries[code]
            matches = [c for c in grouped.get(code, [])
                       if (c.global_page_number, c.line_index) > last_position]
            if not matches:
                continue
            synthetic = [c for c in matches if c.source_line.startswith("toc:")]
            chosen = synthetic[0] if synthetic else None
            next_pos = next_candidate_position_after(grouped, ordered_codes[index + 1:], last_position)
            if chosen is None:
                chosen = next((c for c in matches
                               if titles_match(c.title, title)
                               and (next_pos is None or (c.global_page_number, c.line_index) < next_pos)),
                              None)
            if chosen is None:
                chosen = next((c for c in matches
                               if c.title.strip().lower() == "kandungan"
                               and (next_pos is None or (c.global_page_number, c.line_index) < next_pos)),
                              matches[0])
            chosen.title = title
            selected.append(chosen)
            last_position = (chosen.global_page_number, chosen.line_index)
        return sorted(selected, key=lambda c: (c.global_page_number, c.line_index))

    seen: set[str] = set()
    unique = []
    for c in candidates:
        if c.code not in seen:
            seen.add(c.code)
            unique.append(c)
    return unique


def titles_match(candidate_title: str, toc_title: str) -> bool:
    ct = set(title_tokens(candidate_title))
    tt = set(title_tokens(toc_title))
    if not ct or not tt:
        return False
    overlap = len(ct & tt)
    return overlap >= max(1, math.ceil(min(len(ct), len(tt)) * 0.5))


def next_candidate_position_after(grouped: dict[str, list[HeadingCandidate]],
                                   codes: list[str],
                                   last_position: tuple[int, int]) -> tuple[int, int] | None:
    positions = [(c.global_page_number, c.line_index)
                 for code in codes for c in grouped.get(code, [])
                 if (c.global_page_number, c.line_index) > last_position]
    return min(positions) if positions else None


def title_tokens(value: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9]+", value.lower())
            if len(t) > 2 and t not in {"dan", "the", "yang", "dalam", "with", "bagi"}]


def filter_out_of_order_candidates(candidates: list[HeadingCandidate]) -> list[HeadingCandidate]:
    filtered = []
    last_chapter = last_subtopic = 0
    for index, candidate in enumerate(candidates):
        chapter, subtopic = code_tuple(candidate.code)
        lookahead = [code_tuple(c.code) for c in candidates[index + 1:index + 6]]
        if chapter < last_chapter:
            continue
        if chapter == last_chapter and subtopic < last_subtopic:
            continue
        if chapter > last_chapter + 1 and any(nc <= last_chapter + 1 for nc, _ in lookahead):
            continue
        if (chapter == last_chapter and subtopic > last_subtopic + 1
                and any(nc == chapter and ns <= last_subtopic + 1 for nc, ns in lookahead)):
            continue
        filtered.append(candidate)
        last_chapter = chapter
        last_subtopic = subtopic if chapter == last_chapter else 0
    return filtered


def code_tuple(code: str) -> tuple[int, int]:
    parts = code.split(".")
    return int(parts[0]), int(parts[1]) if len(parts) > 1 else 0


def heading_from_line(line: str, *, previous_lines: list[str],
                      next_lines: list[str]) -> tuple[str, str] | None:
    normalized = normalize_heading_line(line)
    if not normalized:
        return None

    m = END_HEADING_RE.match(normalized)
    if m:
        code = m.group("code")
        title = strip_leading_standard_codes(m.group("title"))
        if valid_topic_code(code) and valid_heading_title(title):
            return code, title

    m = START_HEADING_RE.match(normalized)
    if m:
        code = m.group("code")
        title = strip_leading_standard_codes(m.group("title"))
        if valid_topic_code(code) and valid_heading_title(title):
            return code, title

    m = CODE_ONLY_RE.match(normalized)
    if m:
        code = m.group("code")
        if not valid_topic_code(code):
            return None
        for prev in previous_lines:
            title = strip_leading_standard_codes(normalize_heading_line(prev))
            if valid_heading_title(title):
                return code, title
        for nxt in next_lines:
            title = strip_leading_standard_codes(normalize_heading_line(nxt))
            if valid_heading_title(title):
                return code, title

    return None


# ── TOC parsing ────────────────────────────────────────────────────────────────

def extract_toc_entries_detailed(pages: list[ExtractedPage]) -> list[dict[str, Any]]:
    entries: dict[str, str] = {}
    detailed = []
    toc_page_numbers = set(real_toc_page_numbers(pages))
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
            entries[code] = title
            detailed.append({"code": code, "title": title,
                              "printed_page": printed_page,
                              "toc_global_page": page.global_page_number})
    return detailed


def toc_entry_from_context(lines: list[str], index: int) -> tuple[str, str, int | None, int] | None:
    normalized = normalize_heading_line(lines[index])
    if not normalized:
        return None

    m = START_HEADING_RE.match(normalized)
    if m and valid_topic_code(m.group("code")):
        code = m.group("code")
        title, printed_page = split_title_page(m.group("title"))
        title_parts = [title] if title else []
        next_index = index + 1
        while printed_page is None and next_index < len(lines):
            next_line = normalize_heading_line(lines[next_index])
            if starts_new_toc_item(next_line):
                break
            inline_page = parse_toc_printed_page(next_line)
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
            next_index = append_toc_continuations(lines, next_index, title_parts)
        title = clean_toc_title(" ".join(title_parts))
        if valid_heading_title(title):
            return code, title, printed_page, next_index
        return None

    m = CODE_ONLY_RE.match(normalized)
    if m and valid_topic_code(m.group("code")):
        code = m.group("code")
        title_parts: list[str] = []
        printed_page = None
        next_index = index + 1
        while next_index < len(lines):
            next_line = normalize_heading_line(lines[next_index])
            if starts_new_toc_item(next_line):
                break
            inline_page = parse_toc_printed_page(next_line)
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
            next_index = append_toc_continuations(lines, next_index, title_parts)
        title = clean_toc_title(" ".join(title_parts))
        if valid_heading_title(title):
            return code, title, printed_page, next_index
        return None

    normalized_stripped = re.sub(r"\s+\d{1,3}$", "", normalized).strip()
    for pattern in [END_HEADING_RE, START_HEADING_RE]:
        m = pattern.match(normalized_stripped)
        if m:
            code = m.group("code")
            title = strip_leading_standard_codes(m.group("title"))
            if valid_topic_code(code) and valid_heading_title(title):
                return code, title, None, index + 1

    return None


def collapse_repeated_toc_lines(lines: list[str]) -> list[str]:
    normalized = [normalize_heading_line(line) for line in lines]
    pair_collapsed = []
    index = 0
    while index < len(lines):
        if (index + 3 < len(lines) and normalized[index] and normalized[index] == normalized[index + 2]
                and normalized[index + 1] and normalized[index + 1] == normalized[index + 3]):
            pair_collapsed.extend([lines[index], lines[index + 1]])
            index += 4
            continue
        pair_collapsed.append(lines[index])
        index += 1

    collapsed = []
    last = ""
    for line in pair_collapsed:
        n = normalize_heading_line(line)
        if n and n == last:
            continue
        collapsed.append(line)
        last = n
    return collapsed


def split_title_page(value: str) -> tuple[str, int | None]:
    value = strip_leading_standard_codes(value).strip()
    m = re.match(r"^(?P<title>.*?\D)\s+(?P<page>\d{1,3})$", value)
    if not m:
        return value, None
    return m.group("title").strip(), int(m.group("page"))


def starts_new_toc_item(line: str) -> bool:
    if not line:
        return False
    return bool(START_HEADING_RE.match(line) or CODE_ONLY_RE.match(line) or TOC_ANY_CODE_RE.match(line))


def is_plain_page_number(line: str) -> bool:
    return bool(re.fullmatch(r"\d{1,3}", line))


def parse_toc_printed_page(line: str) -> int | None:
    m = re.fullmatch(r"(?P<page>\d{1,3})(?:\s+\d{1,2})?", line)
    if not m:
        return None
    return int(m.group("page"))


def append_toc_continuations(lines: list[str], index: int, title_parts: list[str]) -> int:
    consumed = 0
    while index < len(lines) and consumed < 2:
        line = normalize_heading_line(lines[index])
        if starts_new_toc_item(line) or is_plain_page_number(line) or parse_toc_printed_page(line) is not None:
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
    if lowered in {"rumusan", "rumusan bab", "refleksi", "refleksi kendiri",
                   "latihan sumatif", "penilaian kendiri", "glosari", "bibliografi",
                   "indeks", "jawapan"}:
        return False
    if lowered.startswith(("bab ", "chapter ", "tema ")):
        return False
    if re.fullmatch(r"[ivxlcdm]+", lowered):
        return False
    if re.fullmatch(r"\d+", lowered):
        return False
    return any(c.isalpha() for c in line)


def clean_toc_title(value: str) -> str:
    value = re.sub(r"\s+", " ", value).strip(" .\t")
    value = re.sub(r"\s+(?:Latihan Pengukuhan|Rumusan|Refleksi Kendiri|Latihan Sumatif)\b.*$",
                   "", value, flags=re.IGNORECASE).strip(" .\t")
    return value


def real_toc_page_numbers(pages: list[ExtractedPage]) -> list[int]:
    toc_pages = []
    started = False
    last_toc_page = 0
    for page in pages:
        if page.global_page_number > 25:
            continue
        is_real = looks_like_real_toc_page(page.text)
        if (not is_real and started and page.global_page_number <= last_toc_page + 2
                and looks_like_toc_continuation_page(page.text)):
            is_real = True
        if is_real:
            toc_pages.append(page.global_page_number)
            started = True
            last_toc_page = page.global_page_number
    return toc_pages


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
    code_lines = sum(1 for line in normalized_lines
                     if START_HEADING_RE.match(line) or END_HEADING_RE.match(line) or CODE_ONLY_RE.match(line))
    if has_contents_label and code_lines >= 4:
        return True
    first_lines = {line.lower() for line in normalized_lines[:8]}
    has_intro_label = bool(first_lines & {"pendahuluan", "introduction", "formulae"})
    has_front_matter = bool({line.lower() for line in normalized_lines[:12]}
                            & {"halaman judul", "halaman hak cipta dan penghargaan"})
    has_chapter_theme = "tema" in lowered and bool(re.search(r"\b(bab|chapter)\b", lowered))
    chapter_count = sum(1 for line in normalized_lines if re.match(r"^(chapter|bab)\s+\d+", line, re.IGNORECASE))
    first_content = next((line for line in normalized_lines if not line.isdigit()), "")
    starts_with_chapter = bool(re.match(r"^(chapter|bab)\s+\d+", first_content, re.IGNORECASE))
    has_book_structure = (has_intro_label or has_front_matter or has_chapter_theme
                          or (chapter_count >= 2 and starts_with_chapter))
    return code_lines >= 8 and has_book_structure


def looks_like_toc_continuation_page(text: str) -> bool:
    lines = useful_lines(text)
    normalized_lines = [normalize_heading_line(line) for line in lines]
    code_lines = sum(1 for line in normalized_lines
                     if START_HEADING_RE.match(line) or END_HEADING_RE.match(line) or CODE_ONLY_RE.match(line))
    has_chapter = any(line in {"bab", "chapter"} or re.match(r"^(bab|chapter)\s+\d+", line, re.IGNORECASE)
                      for line in (l.lower() for l in normalized_lines))
    return code_lines >= 4 and (has_chapter or code_lines >= 8)


def is_contents_label(line: str) -> bool:
    return line.lower().strip() in {"kandungan", "isi kandungan", "contents", "table of contents"}


# ── Text utilities ─────────────────────────────────────────────────────────────

def clean_text(text: str) -> str:
    text = text.replace("\x00", "").replace("\r\n", "\n").replace("\r", "\n")
    lines = []
    for line in text.split("\n"):
        line = re.sub(r"[ \t]+", " ", line).strip()
        if line:
            lines.append(line)
    return "\n".join(lines)


def should_use_ocr(extracted: str, ocr: str) -> bool:
    if not ocr.strip():
        return False
    if len(extracted.strip()) < 20:
        return True
    if is_fliphtml_header_only(extracted) and len(meaningful_fliphtml_lines(ocr)) >= 2:
        return True
    return False


def is_fliphtml_header_only(text: str) -> bool:
    if "fliphtml5.com" not in text.lower():
        return False
    return len(" ".join(meaningful_fliphtml_lines(text))) < 80


def meaningful_fliphtml_lines(text: str) -> list[str]:
    meaningful = []
    for line in useful_lines(text):
        n = normalize_heading_line(line)
        lowered = n.lower()
        if not n or "fliphtml5.com" in lowered:
            continue
        if re.fullmatch(r"\d{1,2}/\d{1,2}/\d{4},?\s+\d{1,2}:\d{2}\s*(?:am|pm)", lowered):
            continue
        if re.fullmatch(r"page\s+\d+\s+of\s+\d+", lowered):
            continue
        meaningful.append(n)
    return meaningful


def useful_lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def is_overview_page(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in OVERVIEW_PHRASES)


def normalize_heading_line(line: str) -> str:
    line = re.sub(r"\s+", " ", line).strip(" .:\t")
    line = re.sub(r"\b(\d{1,2})\s+\.\s+(\d{1,2})\b", r"\1.\2", line)
    if not line or len(line) > 180:
        return ""
    if "http://" in line.lower() or "https://" in line.lower():
        return ""
    return line


def strip_leading_standard_codes(value: str) -> str:
    return LEADING_STANDARD_CODES_RE.sub("", value).strip(" .:-")


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
    first_alpha = next((c for c in title if c.isalpha()), "")
    if first_alpha and first_alpha.islower() and not title.startswith(("pH", "e-")):
        return False
    return sum(1 for c in title if c.isalpha()) >= 3


def valid_topic_code(code: str) -> bool:
    try:
        chapter, subtopic = [int(p) for p in code.split(".")]
    except (ValueError, AttributeError):
        return False
    return 1 <= chapter <= 20 and 0 <= subtopic <= 20


def infer_title_from_text(text: str) -> str | None:
    for line in useful_lines(text)[:20]:
        n = normalize_heading_line(line)
        if valid_heading_title(n):
            return n
    return None


def extraction_status(page_count: int, extracted: int, needs_ocr: int) -> str:
    if page_count == 0:
        return "failed"
    if extracted == 0 and needs_ocr:
        return "needs_ocr"
    if needs_ocr > max(3, math.floor(page_count * 0.2)):
        return "partial"
    return "complete"


def lesson_status(pages: list[ExtractedPage]) -> str:
    if not pages:
        return "failed"
    extracted = sum(1 for p in pages if p.char_count >= 20)
    needs_ocr = sum(1 for p in pages if p.needs_ocr)
    return extraction_status(len(pages), extracted, needs_ocr)


def estimate_minutes(pages: list[ExtractedPage]) -> int:
    chars = sum(p.char_count for p in pages)
    return max(10, min(90, round(chars / 900)))


def load_ocr_sidecar(path: Path) -> dict[int, str]:
    sidecar = path.with_suffix(".ocr.json")
    if not sidecar.exists():
        return {}
    try:
        data = json.loads(sidecar.read_text(encoding="utf-8"))
    except Exception:
        return {}
    result = {}
    for item in data.get("pages", []):
        try:
            result[int(item["page_number"])] = str(item.get("text") or "")
        except (TypeError, ValueError, KeyError):
            pass
    return result


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "source"


def short_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()[:10]


def truncate(value: str | None, length: int) -> str | None:
    if value is None:
        return None
    return value if len(value) <= length else value[:length - 1].rstrip() + "..."


if __name__ == "__main__":
    raise SystemExit(main())
