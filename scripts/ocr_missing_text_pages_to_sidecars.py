"""OCR only image-heavy STEM textbook pages that lack embedded text."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import fitz
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR

from extract_stem_textbooks_to_db import discover_sources, is_fliphtml_header_only_text


ROOT = Path("downloads/gurubesar-kssm-textbooks")


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    sources = discover_sources(ROOT, [4, 5])
    targets = []
    for source in sources:
        for pdf_path in source.files:
            targets.extend(find_missing_pages(pdf_path))

    if not targets:
        print("No missing-text pages found.")
        return 0

    print(f"OCR targets: {len(targets)} pages")
    ocr = RapidOCR()
    started = time.time()

    by_pdf: dict[Path, list[int]] = {}
    for pdf_path, page_number in targets:
        by_pdf.setdefault(pdf_path, []).append(page_number)

    done = 0
    for pdf_path, page_numbers in by_pdf.items():
        sidecar_path = pdf_path.with_suffix(".ocr.json")
        sidecar = read_sidecar(sidecar_path, pdf_path)
        pages_by_number = {
            int(item["page_number"]): item
            for item in sidecar.get("pages", [])
            if item.get("page_number") is not None
        }

        with fitz.open(pdf_path) as doc:
            for page_number in page_numbers:
                if page_number in pages_by_number and pages_by_number[page_number].get("text"):
                    done += 1
                    continue

                page = doc.load_page(page_number - 1)
                pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0), alpha=False)
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                result, elapsed = ocr(np.array(image))
                lines = ocr_lines(result)
                pages_by_number[page_number] = {
                    "page_number": page_number,
                    "text": "\n".join(line["text"] for line in lines),
                    "line_count": len(lines),
                    "mean_confidence": mean([line["score"] for line in lines]),
                    "elapsed": elapsed,
                }
                done += 1
                print(f"OCR {done}/{len(targets)} {pdf_path.name} page {page_number}")

        sidecar["pages"] = [pages_by_number[key] for key in sorted(pages_by_number)]
        sidecar_path.write_text(json.dumps(sidecar, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"OCR complete in {time.time() - started:.1f}s")
    return 0


def find_missing_pages(pdf_path: Path) -> list[tuple[Path, int]]:
    sidecar_pages, _ = load_sidecar_pages(pdf_path.with_suffix(".ocr.json"))
    missing = []
    with fitz.open(pdf_path) as doc:
        for page_index in range(doc.page_count):
            page_number = page_index + 1
            if sidecar_pages.get(page_number):
                continue
            page = doc.load_page(page_index)
            text = (page.get_text("text") or "").strip()
            image_count = len(page.get_images(full=False))
            if (len(text) < 20 or is_fliphtml_header_only_text(text)) and image_count > 0:
                missing.append((pdf_path, page_number))
    return missing


def read_sidecar(path: Path, pdf_path: Path) -> dict:
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {
        "source_pdf": str(pdf_path.resolve()),
        "method": "rapidocr_onnxruntime",
        "zoom": 2.0,
        "pages": [],
    }


def load_sidecar_pages(path: Path) -> tuple[dict[int, str], dict | None]:
    if not path.exists():
        return {}, None
    data = json.loads(path.read_text(encoding="utf-8"))
    pages = {}
    for item in data.get("pages", []):
        try:
            page_number = int(item.get("page_number"))
        except (TypeError, ValueError):
            continue
        pages[page_number] = str(item.get("text") or "")
    return pages, data


def ocr_lines(result) -> list[dict]:
    if not result:
        return []
    lines = []
    for box, text, score in result:
        y = min(point[1] for point in box)
        x = min(point[0] for point in box)
        clean = " ".join(str(text).split())
        if clean:
            lines.append({"x": x, "y": y, "text": clean, "score": float(score or 0)})
    lines.sort(key=lambda item: (round(item["y"] / 12), item["x"]))
    return lines


def mean(values: list[float]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 4)


if __name__ == "__main__":
    raise SystemExit(main())
