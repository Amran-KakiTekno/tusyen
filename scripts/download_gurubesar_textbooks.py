from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
from email.message import Message
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import unquote

import gdown
import requests
from bs4 import BeautifulSoup


HUB_URL = "https://gurubesar.my/himpunan-buku-teks-digital-kssm-tingkatan-1-hingga-5-2/"
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = ROOT / "downloads" / "gurubesar-kssm-textbooks"

STEM_KEYWORDS = {
    "add math",
    "asas komputer",
    "asas kelestarian",
    "biologi",
    "fizik",
    "grafik komunikasi teknikal",
    "kimia",
    "matematik",
    "pertanian",
    "reka bentuk dan teknologi",
    "reka cipta",
    "sains",
    "sains komputer",
    "sains rumah tangga",
    "sains sukan",
    "sains tambahan",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0 Safari/537.36"
    )
}


@dataclass
class Textbook:
    title: str
    subject_page: str
    drive_url: str = ""
    forms: str = ""
    subject: str = ""
    category: str = "Other"
    priority: int = 9
    output_dir: str = ""
    status: str = "pending"
    error: str = ""


def slugify(value: str) -> str:
    value = re.sub(r'[<>:"/\\|?*\x00-\x1f]', " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value.rstrip(". ")


def fetch_soup(session: requests.Session, url: str) -> BeautifulSoup:
    response = session.get(url, headers=HEADERS, timeout=45)
    response.raise_for_status()
    return BeautifulSoup(response.text, "html.parser")


def normalize_text(value: str) -> str:
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def parse_forms(title: str) -> str:
    forms = re.findall(r"Tingkatan\s+(\d)", title, flags=re.I)
    if re.search(r"Tingkatan\s+4\s+Dan\s+5", title, flags=re.I):
        forms = ["4", "5"]
    return "-".join(dict.fromkeys(forms))


def parse_subject(title: str) -> str:
    subject = re.sub(r"^Buku\s+Teks\s+", "", title, flags=re.I).strip()
    subject = re.sub(r"\s+Tingkatan\s+\d(?:\s+Dan\s+\d)?$", "", subject, flags=re.I).strip()
    return subject


def is_stem(subject: str) -> bool:
    normalized = subject.lower()
    return any(keyword == normalized or keyword in normalized for keyword in STEM_KEYWORDS)


def priority_for(forms: str, category: str) -> int:
    upper_form = any(form in {"4", "5"} for form in forms.split("-"))
    if upper_form and category == "STEM":
        return 0
    if upper_form:
        return 1
    if category == "STEM":
        return 2
    return 3


def extract_subject_links(session: requests.Session) -> list[Textbook]:
    soup = fetch_soup(session, HUB_URL)
    seen: set[str] = set()
    books: list[Textbook] = []

    for anchor in soup.find_all("a", href=True):
        title = " ".join(anchor.get_text(" ", strip=True).split())
        href = anchor["href"].strip()
        if not title.startswith("Buku Teks "):
            continue
        if "gurubesar.my/buku-teks-" not in href:
            continue
        if href in seen:
            continue

        seen.add(href)
        forms = parse_forms(title)
        subject = parse_subject(title)
        category = "STEM" if is_stem(subject) else "Other"
        book = Textbook(
            title=title,
            subject_page=href,
            forms=forms,
            subject=subject,
            category=category,
        )
        book.priority = priority_for(forms, category)
        books.append(book)

    return sorted(books, key=lambda book: (book.priority, book.forms, book.title))


def unique_links(links: Iterable[str]) -> list[str]:
    result: list[str] = []
    for link in links:
        clean = link.strip()
        if clean and clean not in result:
            result.append(clean)
    return result


def collect_drive_links(soup: BeautifulSoup) -> list[str]:
    return unique_links(
        anchor["href"].strip()
        for anchor in soup.find_all("a", href=True)
        if "drive.google.com" in anchor["href"]
    )


def form_phrases(forms: str) -> list[str]:
    return [f"tingkatan {form}" for form in forms.split("-") if form]


def collect_external_candidates(soup: BeautifulSoup, book: Textbook) -> list[str]:
    candidates: list[str] = []
    subject = normalize_text(book.subject)
    forms = form_phrases(book.forms)

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if not href.startswith("http"):
            continue
        if "gurubesar.my" in href or "drive.google.com" in href or "t.me/" in href:
            continue

        text = normalize_text(anchor.get_text(" ", strip=True))
        if not text:
            continue
        if subject and subject in text and (not forms or any(form in text for form in forms)):
            candidates.append(href)

    return unique_links(candidates)


def collect_related_external_drive_links(
    session: requests.Session, url: str, book: Textbook
) -> list[str]:
    soup = fetch_soup(session, url)
    subject = normalize_text(book.subject)
    forms = form_phrases(book.forms)
    links: list[str] = []

    for anchor in soup.find_all("a", href=True):
        href = anchor["href"].strip()
        if "drive.google.com" not in href:
            continue

        text = normalize_text(anchor.get_text(" ", strip=True))
        if not text:
            continue
        if "jawapan" in text:
            continue
        if subject and subject in text and (not forms or any(form in text for form in forms)):
            links.append(href)

    return unique_links(links)


def resolve_drive_links(session: requests.Session, books: Iterable[Textbook], delay: float) -> None:
    for index, book in enumerate(books, start=1):
        try:
            soup = fetch_soup(session, book.subject_page)
            drive_links = collect_drive_links(soup)
            if not drive_links:
                for external_url in collect_external_candidates(soup, book):
                    drive_links.extend(
                        collect_related_external_drive_links(session, external_url, book)
                    )
                    drive_links = unique_links(drive_links)
                    if drive_links:
                        break
            if not drive_links:
                book.status = "no-drive-link"
                book.error = "No Google Drive link found on subject page or related external page"
                print(f"[{index}] No Drive link: {book.title}", flush=True)
                continue
            book.drive_url = "\n".join(drive_links)
            book.status = "resolved"
            print(f"[{index}] Resolved: {book.title}", flush=True)
        except Exception as exc:
            book.status = "resolve-failed"
            book.error = str(exc)
            print(f"[{index}] Resolve failed: {book.title} :: {exc}", flush=True)
        if delay:
            time.sleep(delay)


def write_manifest(books: list[Textbook], output_root: Path) -> None:
    output_root.mkdir(parents=True, exist_ok=True)
    rows = [asdict(book) for book in books]
    (output_root / "manifest.json").write_text(
        json.dumps(rows, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    with (output_root / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()) if rows else [])
        writer.writeheader()
        writer.writerows(rows)


def item_output_dir(book: Textbook, output_root: Path) -> Path:
    form_folder = f"Tingkatan {book.forms}" if book.forms else "Unknown Tingkatan"
    stem_prefix = "STEM" if book.category == "STEM" else "Other"
    return output_root / form_folder / stem_prefix / slugify(book.title)


def has_downloaded_file(path: Path) -> bool:
    return downloaded_file_count(path) > 0


def downloaded_file_count(path: Path) -> int:
    if not path.exists():
        return 0
    return sum(
        1
        for child in path.rglob("*")
        if child.is_file() and child.stat().st_size > 1024 and not child.name.endswith(".tmp")
    )


def split_download_urls(value: str) -> list[str]:
    return [url.strip() for url in re.split(r"[\n;]+", value or "") if url.strip()]


def drive_file_id(url: str) -> str | None:
    patterns = [
        r"/file/d/([^/]+)",
        r"[?&]id=([^&]+)",
        r"/open\?id=([^&]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def filename_from_content_disposition(header: str | None, fallback: str) -> str:
    if not header:
        return fallback

    message = Message()
    message["content-disposition"] = header
    filename = message.get_param("filename", header="content-disposition")
    if not filename:
        filename_star = message.get_param("filename*", header="content-disposition")
        if filename_star:
            filename = str(filename_star).split("''", 1)[-1]
    return slugify(unquote(str(filename))) if filename else fallback


def download_drive_file_direct(url: str, target: Path) -> None:
    file_id = drive_file_id(url)
    if not file_id:
        raise RuntimeError(f"Could not extract Google Drive file id from {url}")

    direct_url = f"https://drive.usercontent.google.com/download?id={file_id}&export=download&authuser=0"
    with requests.Session() as session:
        response = session.get(direct_url, headers=HEADERS, stream=True, timeout=60)
        if "text/html" in response.headers.get("Content-Type", ""):
            warning_html = response.text
            response.close()
            warning_soup = BeautifulSoup(warning_html, "html.parser")
            form = warning_soup.find("form", id="download-form")
            if form:
                action = form.get("action") or direct_url
                params = {
                    input_tag.get("name"): input_tag.get("value", "")
                    for input_tag in form.find_all("input")
                    if input_tag.get("name")
                }
                response = session.get(
                    action,
                    params=params,
                    headers=HEADERS,
                    stream=True,
                    timeout=60,
                )

        with response:
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if "text/html" in content_type:
                raise RuntimeError("Google Drive returned an HTML page instead of a file")

            fallback = f"{file_id}.pdf"
            filename = filename_from_content_disposition(
                response.headers.get("Content-Disposition"), fallback
            )
            destination = target / filename
            expected_size = int(response.headers.get("Content-Length") or 0)
            if (
                expected_size
                and destination.exists()
                and destination.stat().st_size == expected_size
            ):
                return

            partial = destination.with_suffix(destination.suffix + ".part")
            with partial.open("wb") as handle:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    if chunk:
                        handle.write(chunk)
            partial.replace(destination)


def download_drive_file_to_directory(url: str, target: Path) -> None:
    previous_cwd = Path.cwd()
    try:
        os.chdir(target)
        try:
            result = gdown.download(
                url=url,
                output=None,
                quiet=False,
                use_cookies=False,
                resume=True,
            )
            if not result:
                raise RuntimeError("gdown returned no downloaded file")
        except Exception as gdown_error:
            print(f"gdown failed, trying direct Drive stream: {gdown_error}", flush=True)
            download_drive_file_direct(url, target)
    finally:
        os.chdir(previous_cwd)


def download_drive_folder_to_directory(url: str, target: Path) -> None:
    items = gdown.download_folder(
        url=url,
        output=str(target),
        quiet=True,
        use_cookies=False,
        skip_download=True,
    )
    if not items:
        raise RuntimeError("gdown could not list Google Drive folder contents")

    for item in items:
        local_path = Path(item.local_path)
        local_path.parent.mkdir(parents=True, exist_ok=True)
        download_drive_file_direct(
            f"https://drive.google.com/file/d/{item.id}/view",
            local_path.parent,
        )


def download_book(book: Textbook, output_root: Path, retries: int) -> None:
    download_urls = split_download_urls(book.drive_url)
    if not download_urls:
        return

    target = item_output_dir(book, output_root)
    target.mkdir(parents=True, exist_ok=True)
    book.output_dir = str(target)

    has_folder_url = any("/folders/" in url for url in download_urls)
    if not has_folder_url and downloaded_file_count(target) >= len(download_urls):
        book.status = "already-present"
        return

    for attempt in range(1, retries + 1):
        try:
            for url in download_urls:
                if "/folders/" in url:
                    download_drive_folder_to_directory(url, target)
                else:
                    download_drive_file_to_directory(url, target)
            book.status = "downloaded"
            book.error = ""
            return
        except Exception as exc:
            book.status = "download-failed"
            book.error = str(exc)
            print(
                f"Download failed ({attempt}/{retries}): {book.title} :: {exc}",
                flush=True,
            )
            if attempt < retries:
                time.sleep(3 * attempt)


def download_books(books: list[Textbook], output_root: Path, retries: int, limit: int | None) -> None:
    candidates = [book for book in books if book.drive_url]
    if limit:
        candidates = candidates[:limit]

    for index, book in enumerate(candidates, start=1):
        print(f"\n[{index}/{len(candidates)}] Downloading: {book.title}", flush=True)
        download_book(book, output_root, retries)
        write_manifest(books, output_root)


def load_manifest(path: Path) -> list[Textbook]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [Textbook(**item) for item in data]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=OUTPUT_ROOT)
    parser.add_argument("--resolve-only", action="store_true")
    parser.add_argument("--download-only", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--delay", type=float, default=0.2)
    parser.add_argument("--retries", type=int, default=2)
    args = parser.parse_args()

    output_root: Path = args.output
    manifest = output_root / "manifest.json"
    session = requests.Session()

    if args.download_only and manifest.exists():
        books = load_manifest(manifest)
    else:
        books = extract_subject_links(session)
        print(f"Found {len(books)} textbook subject pages.", flush=True)
        resolve_drive_links(session, books, args.delay)

    for book in books:
        if not book.output_dir:
            book.output_dir = str(item_output_dir(book, output_root))

    write_manifest(books, output_root)

    if not args.resolve_only:
        download_books(books, output_root, args.retries, args.limit)
        write_manifest(books, output_root)

    counts: dict[str, int] = {}
    for book in books:
        counts[book.status] = counts.get(book.status, 0) + 1
    print("\nStatus summary:", json.dumps(counts, indent=2), flush=True)
    print(f"Manifest: {output_root / 'manifest.csv'}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
