"""Create a page-text OCR sidecar for an image-only PDF."""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import fitz
import numpy as np
from PIL import Image
from rapidocr_onnxruntime import RapidOCR


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", help="PDF to OCR")
    parser.add_argument("--output", help="Output JSON sidecar")
    parser.add_argument("--zoom", type=float, default=2.0)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--end-page", type=int)
    args = parser.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    pdf_path = Path(args.pdf)
    output = Path(args.output) if args.output else pdf_path.with_suffix(".ocr.json")

    existing_pages = {}
    if output.exists():
        data = json.loads(output.read_text(encoding="utf-8"))
        for item in data.get("pages", []):
            existing_pages[int(item["page_number"])] = item
    else:
        data = {
            "source_pdf": str(pdf_path.resolve()),
            "method": "rapidocr_onnxruntime",
            "zoom": args.zoom,
            "pages": [],
        }

    ocr = RapidOCR()
    started = time.time()

    with fitz.open(pdf_path) as doc:
        end_page = args.end_page or doc.page_count
        for page_number in range(args.start_page, end_page + 1):
            if page_number in existing_pages and existing_pages[page_number].get("text"):
                continue

            page = doc.load_page(page_number - 1)
            pix = page.get_pixmap(matrix=fitz.Matrix(args.zoom, args.zoom), alpha=False)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            result, elapsed = ocr(np.array(image))
            lines = ocr_lines(result)
            item = {
                "page_number": page_number,
                "text": "\n".join(line["text"] for line in lines),
                "line_count": len(lines),
                "mean_confidence": mean([line["score"] for line in lines]),
                "elapsed": elapsed,
            }
            existing_pages[page_number] = item

            if page_number % 10 == 0 or page_number == end_page:
                write_sidecar(output, data, existing_pages)
                print(f"OCR page {page_number}/{end_page} ({time.time() - started:.1f}s)")

    write_sidecar(output, data, existing_pages)
    print(f"Wrote {output} with {len(existing_pages)} pages")
    return 0


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


def write_sidecar(output: Path, data: dict, pages_by_number: dict[int, dict]) -> None:
    data["pages"] = [pages_by_number[key] for key in sorted(pages_by_number)]
    output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
