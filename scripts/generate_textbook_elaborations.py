#!/usr/bin/env python3
"""Generate student-friendly elaborations + quiz questions from textbook JSON.

Each form-level run reads completed books under scripts/textbook_json/Tingkatan N,
writes one output artifact per book under downloads/elaborated/Tingkatan N/...,
and emits a compact report.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


STOPWORDS_MS = {
    "yang",
    "dan",
    "atau",
    "untuk",
    "bagi",
    "dari",
    "dalam",
    "itu",
    "ini",
    "satu",
    "apa",
    "apakah",
    "akan",
    "boleh",
    "tentang",
    "anda",
    "pelajar",
    "murid",
    "topik",
    "tajuk",
    "subtopik",
    "tujuan",
    "langkah",
    "soalan",
}

STOPWORDS_EN = {
    "the",
    "and",
    "or",
    "for",
    "with",
    "this",
    "that",
    "these",
    "those",
    "about",
    "what",
    "will",
    "can",
    "should",
    "is",
    "are",
    "to",
    "of",
    "in",
    "on",
    "at",
    "as",
    "a",
    "an",
    "it",
    "its",
    "be",
    "by",
    "from",
    "students",
    "student",
    "lesson",
    "topic",
    "chapter",
    "example",
}


NOISE_LINES = (
    "teacher",
    "guru",
    "notes",
    "nota",
    "worksheet",
    "worksheet",
    "latihan",
    "activity",
    "aktiviti",
    "kajian",
    "reflection",
    "refleksi",
    "objective",
    "tujuan",
    "learning",
    "tujuan pembelajaran",
    "form",
    "bab",
    "chapter",
    "unit",
    "theme",
)

STEM_SUBJECT_KEYWORDS = {
    "mathematics",
    "additional mathematics",
    "physics",
    "chemistry",
    "biology",
    "additional science",
    "computer science",
    "computer fundamentals",
    "computer",
    "science",
}

NON_TEACHABLE_KEYWORDS = (
    "table of contents",
    "contents",
    "syllabus",
    "foreword",
    "preamble",
    "introduction",
    "pengenalan",
    "pengantar",
    "index",
    "glossary",
    "acknowledgement",
    "borrow",
    "loan",
    "disclaimer",
)
NON_TEACHABLE_TITLE_KEYWORDS = (
    "pengenalan",
    "pengantar",
    "preamble",
    "foreword",
    "introduction",
    "objective",
    "tujuan pembelajaran",
    "table of contents",
    "contents",
    "syllabus",
    "index",
    "glossary",
    "acknowledgement",
    "appendix",
    "reference",
    "file-",
)


def normalize_space(value: str) -> str:
    value = str(value or "")
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def parse_int(value: Any) -> int:
    try:
        return int(value)
    except Exception:
        return 0


def is_stem_subject(subject: str, stream: str) -> bool:
    text = f"{subject} {stream}".lower()
    return any(keyword in text for keyword in STEM_SUBJECT_KEYWORDS)


def lesson_char_count(lesson: dict[str, Any], text: str) -> int:
    raw = lesson.get("char_count")
    if isinstance(raw, (int, float)):
        return int(raw)
    if isinstance(raw, str) and raw.isdigit():
        return int(raw)
    return len(text or "")


def split_lines(text: str) -> list[str]:
    lines = []
    previous = ""
    for raw in (text or "").splitlines():
        line = normalize_space(raw)
        if not line:
            continue
        line = re.sub(r"\[[^\]]+\]", "", line)
        if re.fullmatch(r"\d{1,4}", line):
            continue
        lowered = line.lower()
        if any(chunk in lowered for chunk in NOISE_LINES):
            continue
        if re.match(r"^(?:figure|jadual|table|diagram|gambar|photograph|chart)\b", lowered):
            continue
        if line == previous:
            continue
        previous = line
        lines.append(line)
    return lines


def extract_sentences(text: str) -> list[str]:
    blob = normalize_space(" ".join(split_lines(text)))
    if not blob:
        return []

    pieces = re.split(r"(?<=[.!?])\s+", blob)
    sentences: list[str] = []
    for item in pieces:
        sentence = normalize_space(item)
        if 45 <= len(sentence) <= 320:
            sentences.append(sentence)

    if sentences:
        return sentences[:20]

    fallback = []
    for chunk in blob.split("\n"):
        candidate = normalize_space(chunk)
        if len(candidate) > 60:
            fallback.append(candidate[:260] + "...")
        if len(fallback) >= 12:
            break
    return fallback


def topic_concept(title: str) -> str:
    title = normalize_space(title)
    title = re.sub(r"^\d+(?:\.\d+)*\s+", "", title)
    return title.strip(" -:")


def stopwords_for(lang: str) -> set[str]:
    return STOPWORDS_MS if lang == "ms" else STOPWORDS_EN


def unique(values: list[str]) -> list[str]:
    seen = set()
    out: list[str] = []
    for value in values:
        normalized = normalize_space(value).lower()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalize_space(value))
    return out


def sentence_for_term(term: str, sentences: list[str]) -> str | None:
    if not term:
        return None
    pattern = re.compile(rf"\b{re.escape(term)}\b", re.IGNORECASE)
    for sentence in sentences:
        if pattern.search(sentence):
            return sentence
    return None


def has_real_content_lines(text: str) -> bool:
    lines = split_lines(text)
    if not lines:
        return False

    meaningful = [
        line
        for line in lines
        if len(line) >= 25
        and any(ch.isalpha() for ch in line)
        and not any(keyword in line.lower() for keyword in NON_TEACHABLE_KEYWORDS)
    ]
    if meaningful:
        if len(meaningful) >= 1:
            return True

    normalized = normalize_space(" ".join(lines))
    normalized_words = normalize_space(normalized).split()
    if normalized_words and len(normalized_words) >= 70:
        return True

    return False


def has_obvious_non_teachable_title(title: str) -> bool:
    lowered = normalize_space(title).lower()
    if not lowered:
        return True
    if any(keyword in lowered for keyword in NON_TEACHABLE_TITLE_KEYWORDS):
        return True
    if re.fullmatch(r"\d+(?:[-.]\d+)*\s*$", lowered.replace(" ", "")):
        return True
    if re.fullmatch(r"file-\d+[-\w]*", lowered):
        return True
    return False


def looks_like_toc_or_caption(text: str) -> bool:
    lines = split_lines(text)
    if not lines:
        return False

    short_lines = [line for line in lines if len(line) <= 70]
    short_ratio = len(short_lines) / max(1, len(lines))
    heading_like = 0
    toc_like = 0

    for line in lines:
        if re.search(r"\b(?:bab|unit|chapter|unit|chapter|topik|seksyen|page|halaman)\b", line.lower()):
            heading_like += 1
        if re.fullmatch(r"\d{1,3}", line) or re.search(r"\d+\.\d+\b", line):
            toc_like += 1
        if len(line) <= 28 and re.fullmatch(r".*[A-Za-z]{3,}\s+\d+$", line):
            toc_like += 1

    if len(lines) >= 12 and short_ratio > 0.72:
        return True
    if heading_like >= 2 and toc_like >= 3:
        return True

    return False


def to_term_definitions(term_candidates: list[str], sentences: list[str], lang: str) -> list[dict[str, str]]:
    defs = []
    for term in unique(term_candidates)[:10]:
        short_term = normalize_space(term)
        if len(short_term) < 3:
            continue
        sentence = sentence_for_term(term, sentences)
        if sentence:
            definition = normalize_space(sentence)
            if len(definition) > 240:
                definition = definition[:238] + "..."
        else:
            if lang == "ms":
                definition = f"{term} muncul dalam topik ini dan berkaitan langsung dengan {short_term} yang diterangkan pelajarannya."
            else:
                definition = f"{term} appears in this topic and is part of the main concept covered in the lesson."
        defs.append({"term": short_term, "definition": definition})
    return defs


def build_mnemonic(term_defs: list[dict[str, str]], lang: str) -> str | None:
    terms = [item["term"] for item in term_defs if item.get("term")]
    if len(terms) < 2:
        return None
    if not any(any(ch.isdigit() for ch in term) for term in terms[:4]) and len(term_defs[0]["definition"]) < 8:
        return None

    letters = "".join(term[0].upper() for term in terms[:4] if term)
    if not letters:
        return None
    sample = ", ".join(terms[:4])
    if lang == "ms":
        return (
            f"Perhatikan rentetan istilah berikut: {sample}. "
            f"Gunakan mnemonik \"{letters}\" untuk memanggil semula urutan idea yang paling kerap muncul."
        )
    return (
        f"Use this cue from the lesson terms: {sample}. "
        f"The mnemonic \"{letters}\" helps you recall the idea order in this lesson."
    )


def build_analogy(concept: str, stream: str, subject: str, lang: str) -> str:
    low_subject = subject.lower()
    if lang == "ms":
        if stream.upper() == "STEM" or any(word in low_subject for word in ["math", "science", "biology", "chemistry", "physics", "additional"]):
            return (
                f"Bayangkan {concept} seperti mengira baki duit di kantin sekolah. "
                "Jika senarai harga, kuantiti, dan diskaun salah susun, hasil tidak betul; "
                "demikian juga dalam pelajaran ini, setiap nombor atau syarat ada peranannya."
            )
        if "history" in low_subject or "sejarah" in low_subject:
            return f"{concept} dalam {subject} macam menyusun peristiwa masa silam — jika urutan salah, hubungan sebab-akibat jadi keliru."
        return f"Bayangkan {concept} seperti jadual tugas kumpulan kokurikulum: faham konteks, peranan setiap ahli, lalu gabungkan hasil."

    if stream.upper() == "STEM" or any(word in low_subject for word in ["math", "science", "biology", "chemistry", "physics", "additional"]):
        return (
            f"Think of {concept} like balancing a school practical budget. "
            "If one input is missed, the final value changes; this topic works the same way whenever the same conditions are present."
        )
    if "history" in low_subject or "sejarah" in low_subject:
        return f"{concept} in {subject} is like building a timeline — switching the order changes the meaning of the events."
    return (
        f"Think of {concept} like running a class assignment system where each role has a specific role and output depends on following the right order."
    )


def build_common_misconceptions(concept: str, lang: str) -> list[str]:
    if lang == "ms":
        return [
            f"Ramai pelajar fikir {concept} hanya tentang istilah panjang; sebenarnya ia juga tentang bagaimana konsep ini digunakan dalam contoh sebenar.",
            f"Pelajar kadang-kadang fikir semua penerangan di sini sama, sedangkan konteks ayat dalam {concept} menentukan tafsiran.",
        ]
    return [
        f"Many students think {concept} is only one definition, but it is also shaped by examples and conditions in the lesson.",
        f"Some students assume the same term in another subject means the same thing, but this lesson shows this concept has {concept}-specific context.",
    ]


def build_why_it_matters(subject: str, lang: str) -> str:
    if lang == "ms":
        return (
            f"Topik ini penting dalam {subject} kerana ia muncul dalam kerja kelas harian seperti projek sekolah, aktiviti makmal, dan penyelesaian masalah rutin."
        )
    return (
        f"This is important in {subject} because it connects directly to school work like class projects, lab tasks, and practical problem solving."
    )


def build_study_tips(lang: str) -> list[str]:
    if lang == "ms":
        return [
            "Baca sekali, kemudian tarik satu carta ringkas untuk nyatakan hubungan sebab-akibat dalam topik ini.",
            "Tandakan ayat yang ada contoh atau kriteria, dan cuba kaitkan dengan situasi sekolah sebenar.",
            "Bina dua soalan mini dari ayat panjang dalam teks dan jawabnya tanpa melihat jawapan contoh.",
        ]
    return [
        "Read the text once, then map each key term to one concrete example in the lesson.",
        "Create a two-step process note from the lesson and test it on one real example from school.",
        "Write one comparison question from the lesson and answer it using the same terminology.",
    ]


def build_worked_example(concept: str, sentences: list[str], lang: str) -> str:
    if not sentences:
        return f"Kesimpulan ini belum ada isi jelas untuk {concept}." if lang == "ms" else f"Not enough readable text yet for {concept}."

    if lang == "ms":
        return (
            f"Contoh langkah terapan untuk {concept}:\n"
            "1. Pilih ayat paling jelas yang menyatakan definisi atau peraturan.\n"
            f"2. Guna ayat tersebut untuk membina satu formula/prosedur ringkas.\n"
            "3. Cuba jalankan langkah itu pada satu contoh kecil yang disebut dalam teks atau realiti kelas.\n"
            "4. Semak semula dengan ayat seterusnya untuk lihat sama ada syarat tambahan perlu ditambah."
        )

    return (
        f"Worked example flow for {concept}:\n"
        "1. Pick the most direct rule sentence from the lesson.\n"
        "2. Convert it into a concrete 3-step procedure.\n"
        "3. Apply the procedure to one explicit example from the lesson or a school context.\n"
        "4. Compare your result with the lesson wording to confirm any condition or exception."
    )


def build_simple_intro(concept: str, language: str, subject: str) -> str:
    if language == "ms":
        return (
            f"Topik {concept} dalam subjek {subject} fokus pada bagaimana anda faham satu idea utama dalam buku teks ini, "
            "bukan sekadar menghafal ayat. Dalam pembelajaran sekolah, tajuk ini biasanya datang dengan contoh, "
            "syarat, dan perbincangan yang perlu dihubungkan secara serentak."
        )
    return (
        f"The topic {concept} in {subject} explains a specific skill or idea from the textbook, "
        "and the learning happens by connecting the definition, conditions, and examples provided in the same lesson."
    )


def deterministic_index(*parts: str) -> int:
    text = "|".join(parts)
    return sum((i + 1) * ord(ch) for i, ch in enumerate(text)) % 4


def format_options(correct: str, distractors: list[str], seed: str, lang: str) -> tuple[list[str], str]:
    clean_correct = normalize_space(correct)
    choices = unique([clean_correct] + [normalize_space(item) for item in distractors if normalize_space(item)])
    if len(choices) < 4:
        fallback = [
            "Tidak berkaitan" if lang == "ms" else "Not related",
            "Perlu semak teks semula" if lang == "ms" else "Need to recheck the text",
            "Satu-satunya pilihan ini" if lang == "ms" else "One possible fallback",
        ]
        for item in fallback:
            if item not in choices:
                choices.append(item)
            if len(choices) >= 4:
                break

    choices = unique(choices)[:4]
    while len(choices) < 4:
        choices.append(f"Option {len(choices)+1}")

    start = deterministic_index(seed)
    rotated = choices[start:] + choices[:start]
    if clean_correct not in rotated:
        rotated[0] = clean_correct
    labels = [f"{chr(65+i)}. {rotated[i]}" for i in range(4)]
    correct_letter = chr(65 + rotated.index(clean_correct))
    return labels, correct_letter


def question_explanation(correct_text: str, lang: str) -> str:
    if lang == "ms":
        return f"Pilihan betul ialah {correct_text} kerana ia berpunca terus daripada kandungan pelajaran."
    return f"The correct answer is {correct_text}, because it is directly supported by the lesson content."


def build_quiz_questions(
    lesson_title: str,
    subject: str,
    concept: str,
    term_defs: list[dict[str, str]],
    sentences: list[str],
    lang: str,
    source_key: str,
) -> list[dict[str, Any]]:
    terms = [item["term"] for item in term_defs]
    if not terms:
        terms = [concept]

    q1 = {
        "question": "Apakah tumpuan utama pelajaran ini?" if lang == "ms" else "What is the main focus of this lesson?",
        "options": [],
        "correct_answer": "A",
        "explanation": "",
    }
    options1, correct1 = format_options(
        correct=concept,
        distractors=terms[1:4],
        seed=f"q1|{source_key}|{lesson_title}",
        lang=lang,
    )
    q1["options"] = options1
    q1["correct_answer"] = correct1
    q1["explanation"] = question_explanation(concept, lang)

    q2 = {
        "question": "Langkah pertama yang paling sesuai ialah?" if lang == "ms" else "What is the best first step?",
        "options": [],
        "correct_answer": "A",
        "explanation": "",
    }
    correct2 = (
        "Kenal pasti definisi dan istilah utama dalam penerangan awal."
        if lang == "ms"
        else "Identify the core definition and key terms in the opening explanation."
    )
    distractors2 = [
        "Baca jawapan kemudian semak semula soalan." if lang == "ms" else "Read the answer first and check the question later.",
        "Gunakan gambar latihan tanpa memahami teks." if lang == "ms" else "Use examples without understanding the text.",
        "Menyalin terus daripada nota guru." if lang == "ms" else "Copy directly from notes.",
    ]
    options2, correct2_letter = format_options(
        correct=correct2,
        distractors=distractors2,
        seed=f"q2|{source_key}|{concept}",
        lang=lang,
    )
    q2["options"] = options2
    q2["correct_answer"] = correct2_letter
    q2["explanation"] = (
        "Memulakan dengan asas konsep memastikan semua pilihan lain disaring dengan betul."
        if lang == "ms"
        else "Starting with the core concept ensures the rest of the understanding builds correctly."
    )

    q3 = {
        "question": (
            "Pernyataan mana paling konsisten dengan kandungan ini?"
            if lang == "ms"
            else "Which statement is most consistent with this lesson content?"
        ),
        "options": [],
        "correct_answer": "A",
        "explanation": "",
    }
    fallback = (
        "Konteks, istilah dan contoh perlu dibaca bersama."
        if lang == "ms"
        else "Context, terms and examples should be considered together."
    )
    options3, correct3_letter = format_options(
        correct=fallback,
        distractors=[
            "Baca satu baris sahaja sudah cukup."
            if lang == "ms"
            else "One line is enough for full understanding.",
            "Fahami kandungan selepas melihat jawapan."
            if lang == "ms"
            else "Understand the lesson only after seeing answers.",
            "Abaikan istilah penting untuk masa lebih cepat."
            if lang == "ms"
            else "Ignore key terms to save time.",
        ],
        seed=f"q3|{source_key}|{subject}",
        lang=lang,
    )
    q3["options"] = options3
    q3["correct_answer"] = correct3_letter
    q3["explanation"] = question_explanation(fallback, lang)

    q4 = {
        "question": (
            "Manakah pilihan yang paling membantu pelajar guna topik ini?"
            if lang == "ms"
            else "Which option best shows how to apply this topic?"
        ),
        "options": [],
        "correct_answer": "A",
        "explanation": "",
    }
    correct4 = (
        "Terangkan idea dengan ringkas, kemudian kaitkan dengan contoh dan langkah bukti."
        if lang == "ms"
        else "Explain the idea briefly and connect it to examples and the lesson process."
    )
    options4, correct4_letter = format_options(
        correct=correct4,
        distractors=[
            "Menghafal semua perkataan tanpa memikirkan maksud."
            if lang == "ms"
            else "Memorize every word without understanding meaning.",
            "Jatuh cepat pada pilihan jawapan pertama."
            if lang == "ms"
            else "Pick the first answer that looks familiar.",
            "Tumpu hanya pada gambar dan abaikan teks."
            if lang == "ms"
            else "Focus only on illustrations and ignore text.",
        ],
        seed=f"q4|{source_key}|{lesson_title}",
        lang=lang,
    )
    q4["options"] = options4
    q4["correct_answer"] = correct4_letter
    q4["explanation"] = (
        "Penggunaan yang betul melibatkan penerangan konsep, bukan hafalan semata-mata."
        if lang == "ms"
        else "Proper use requires explaining and applying the concept, not memorizing alone."
    )

    return [q1, q2, q3, q4]


def parse_numeric_example(text: str) -> tuple[str, float] | None:
    if not text:
        return None
    token = re.search(r"(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)", text)
    if not token:
        return None
    left_raw, op, right_raw = token.groups()
    try:
        left = float(left_raw)
        right = float(right_raw)
    except Exception:
        return None
    if op == "+":
        return (f"{left_raw} + {right_raw}", left + right)
    if op == "-":
        return (f"{left_raw} - {right_raw}", left - right)
    if op == "*":
        return (f"{left_raw} × {right_raw}", left * right)
    if op == "/":
        if right == 0:
            return None
        return (f"{left_raw} ÷ {right_raw}", left / right)
    return None


def build_definition_question(concept: str, term_defs: list[dict[str, str]], lang: str, source_key: str) -> dict[str, Any]:
    term = term_defs[0]["term"] if term_defs else concept
    if lang == "ms":
        question = f"Apakah penerangan {term} yang paling tepat dalam topik ini?"
        correct = f"{term} ialah {term_defs[0]['definition'] if term_defs else concept}."
        distractors = [
            f"{term} hanya tajuk sampingan yang tidak berkait.",
            f"{term} boleh digunakan dalam mana-mana subjek tanpa syarat.",
            f"{term} adalah satu frasa kosong tanpa contoh.",
        ]
    else:
        question = f"Which description fits {term} in this lesson?"
        correct = f"{term} is {term_defs[0]['definition'] if term_defs else concept}."
        distractors = [
            f"{term} is only a side heading with no meaning.",
            f"{term} can be used in any subject without conditions.",
            f"{term} is just memorized wording with no text context.",
        ]
    options, letter = format_options(correct=correct, distractors=distractors, seed=f"q1|{source_key}|{term}", lang=lang)
    explanation = (
        f"Ini berpandu pada penerangan {term} dalam isi pelajaran, bukan daripada tajuk umum lain."
        if lang == "ms"
        else f"This comes directly from the lesson's text around {term}, not from another topic."
    )
    return {"question": question, "options": options, "correct_answer": letter, "explanation": explanation}


def build_application_question(concept: str, terms: list[str], lang: str, source_key: str, is_stem: bool) -> dict[str, Any]:
    base = terms[0] if terms else concept
    if is_stem:
        if lang == "ms":
            question = f"Dalam topik {concept}, apakah tindakan terbaik apabila menerapkan {base}?"
            correct = f"Ikuti proses {base} dan semak syarat pelajaran terlebih dahulu."
            distractors = [
                f"Terus gunakan {base} tanpa semak syarat.",
                f"Langkau langkah asas dan teruskan jawapan.",
                f"Gunakan kaedah ingatan tanpa pengiraan.",
            ]
        else:
            question = f"For {base} in {concept}, which action is most accurate?"
            correct = f"Follow the {base} process and keep the stated lesson conditions."
            distractors = [
                f"Use {base} while skipping all stated conditions.",
                f"Skip calculations and only memorise names.",
                f"Rely on one unrelated example from another topic.",
            ]
    else:
        if lang == "ms":
            question = f"Bagaimana {base} biasanya diaplikasikan dalam topik {concept} ini?"
            correct = f"Gunakan {base} bersama teks, contoh dan bukti yang diberikan."
            distractors = [
                f"Gunakan {base} sebagai istilah umum sahaja.",
                f"Pakai {base} sama untuk semua subjek.",
                f"Abaikan konteks dan guna {base} secara rawak.",
            ]
        else:
            question = f"How is {base} typically applied in this lesson?"
            correct = f"Use {base} with the provided text context and lesson examples."
            distractors = [
                f"Use {base} as an unrelated general label.",
                f"Apply {base} identically in every subject.",
                f"Skip context and answer from memory only.",
            ]
    options, letter = format_options(correct=correct, distractors=distractors, seed=f"q2|{source_key}|{base}", lang=lang)
    explanation = (
        f"{correct} kerana topik ini memerlukan hubungan konsep, syarat, dan bukti dalam teks."
        if lang == "ms"
        else f"{correct} because the lesson requires connecting context, conditions, and examples."
    )
    return {"question": question, "options": options, "correct_answer": letter, "explanation": explanation}


def build_calculation_question(concept: str, text: str, lang: str, source_key: str) -> dict[str, Any] | None:
    parsed = parse_numeric_example(text)
    if not parsed:
        return None
    expr, value = parsed
    correct_num = int(value) if float(value).is_integer() else round(value, 2)
    correct = str(correct_num)
    if lang == "ms":
        question = f"Selesaikan pengiraan berdasarkan topik {concept}: {expr} = ?"
        explanation = f"Operasi asas pada contoh ini memberi hasil {correct}."
        distractors = [str(correct_num + 1), str(correct_num - 1), str(correct_num * 2)]
    else:
        question = f"Compute the calculation from {concept}: {expr} = ?"
        explanation = f"The arithmetic pattern in this lesson gives {correct}."
        distractors = [str(correct_num + 1), str(correct_num - 1), str(correct_num * 2)]
    options, letter = format_options(correct=correct, distractors=distractors, seed=f"q3|{source_key}|{expr}", lang=lang)
    return {"question": question, "options": options, "correct_answer": letter, "explanation": explanation}


def build_comparison_question(concept: str, terms: list[str], lang: str, source_key: str) -> dict[str, Any]:
    first = terms[0] if terms else concept
    second = terms[1] if len(terms) > 1 else concept
    if lang == "ms":
        question = f"Perbandingan mana paling tepat antara {first} dan {second}?"
        correct = f"{first} dan {second} berbeza peranan dalam topik ini."
        distractors = [
            f"{first} dan {second} boleh ditukar ganti di setiap soalan.",
            f"{first} tidak relevan dengan topik ini.",
            f"{second} tidak perlukan sebarang contoh.",
        ]
    else:
        question = f"Which comparison is most accurate for {first} and {second}?"
        correct = f"{first} and {second} serve different roles in this topic."
        distractors = [
            f"{first} and {second} can be swapped in every question.",
            f"{first} is irrelevant to this lesson.",
            f"{second} needs no supporting context.",
        ]
    options, letter = format_options(correct=correct, distractors=distractors, seed=f"q4|{source_key}|{concept}", lang=lang)
    explanation = (
        f"Jawapan ini membezakan peranan {first} dan {second} berdasarkan kandungan pelajaran."
        if lang == "ms"
        else f"This answer differentiates {first} and {second} as presented in the lesson."
    )
    return {"question": question, "options": options, "correct_answer": letter, "explanation": explanation}


def build_quiz_questions(
    lesson_title: str,
    subject: str,
    concept: str,
    term_defs: list[dict[str, str]],
    text: str,
    lang: str,
    source_key: str,
    is_stem: bool | None = None,
) -> list[dict[str, Any]]:
    terms = [item["term"] for item in term_defs]
    if not terms:
        terms = [concept]
    stem = bool(is_stem)

    q1 = build_definition_question(concept=concept, term_defs=term_defs, lang=lang, source_key=source_key)
    q2 = build_application_question(concept=concept, terms=terms, lang=lang, source_key=source_key, is_stem=stem)

    if stem:
        calc_question = build_calculation_question(concept, text, lang, source_key)
        if calc_question:
            q3 = calc_question
            q4 = build_comparison_question(concept=concept, terms=terms, lang=lang, source_key=f"{source_key}-alt")
        else:
            q3 = build_comparison_question(concept=concept, terms=terms, lang=lang, source_key=f"{source_key}-alt")
            q4 = build_application_question(concept=concept, terms=terms, lang=lang, source_key=f"{source_key}-alt2", is_stem=True)
    else:
        q3 = build_comparison_question(concept=concept, terms=terms, lang=lang, source_key=f"{source_key}-alt")
        q4 = build_comparison_question(concept=concept, terms=terms, lang=lang, source_key=f"{source_key}-alt2")

    # ensure we always return 4 questions
    return [q1, q2, q3, q4]


def build_lesson_elaboration(book: dict[str, Any], lesson: dict[str, Any], generated_at: str) -> dict[str, Any]:
    lang = (book.get("language") or "en").lower()
    lesson_title = lesson.get("title") or ""
    concept = topic_concept(lesson_title)
    text = lesson.get("text_content") or ""
    sentences = extract_sentences(text)
    lines = split_lines(text)
    raw_tokens = unique(re.findall(r"[\w\-']{3,}", f"{concept} {' '.join(lines[:60])}", flags=re.UNICODE))

    # Keep deterministic, textbook-grounded terms from title/text.
    sw = stopwords_for(lang)
    filtered = [token for token in raw_tokens if token.lower() not in sw]
    term_defs = to_term_definitions(filtered, sentences, lang)
    if not term_defs:
        term_defs = to_term_definitions([concept], sentences, lang)

    elaboration = {
        "simple_intro": build_simple_intro(concept, lang, book.get("subject", "")),
        "analogy": build_analogy(concept, book.get("stream", ""), book.get("subject", ""), lang),
        "mnemonic": build_mnemonic(term_defs, lang),
        "worked_example": build_worked_example(concept, sentences, lang),
        "common_misconceptions": build_common_misconceptions(concept, lang),
        "why_it_matters": build_why_it_matters(book.get("subject", ""), lang),
        "key_terms": term_defs[:8],
        "study_tips": " | ".join(build_study_tips(lang)),
    }

    is_stem = is_stem_subject(book.get("subject", ""), book.get("stream", ""))
    quiz_questions = build_quiz_questions(
        lesson_title=lesson_title,
        subject=book.get("subject", ""),
        concept=concept,
        term_defs=term_defs,
        text=text,
        lang=lang,
        source_key=book.get("source_key", ""),
        is_stem=is_stem,
    )

    return {
        "lesson_key": lesson.get("lesson_key", ""),
        "source_key": book.get("source_key", ""),
        "subject": book.get("subject", ""),
        "form_level": parse_int(book.get("form_level")),
        "title": lesson_title,
        "elaboration": elaboration,
        "quiz_questions": quiz_questions,
        "meta": {
            "source": "gpt-generated",
            "teacher_reviewed": False,
            "generated_at": generated_at,
        },
    }


def process_form(form_level: int, input_root: Path, output_root: Path) -> dict[str, Any]:
    generated_at = datetime.now(timezone.utc).isoformat()
    form_root = input_root / f"Tingkatan {form_level}"
    report: dict[str, Any] = {
        "form_level": form_level,
        "books_processed": 0,
        "books_skipped": 0,
        "books_skipped_detail": [],
        "books": [],
        "lessons_elaborated": 0,
        "lessons_skipped": 0,
        "lesson_skip_reasons": defaultdict(int),
        "quiz_questions_generated": 0,
        "failures": [],
        "book_skip_reasons": defaultdict(int),
    }

    if not form_root.exists():
        report["failures"].append({"source_key": "", "error": f"Missing form folder: {form_root}"})
        return report

    files = sorted(
        [path for path in form_root.rglob("*.json") if path.name.lower() != "index.json"]
    )

    for path in files:
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            report["failures"].append({"source_key": path.stem, "error": str(exc)})
            continue

        source_key = raw.get("source_key") or path.stem
        extraction_status = (raw.get("extraction_status") or "").lower()
        stream = raw.get("stream") or "Other"
        subject = raw.get("subject", "")
        lang = raw.get("language", "en")
        is_stem = is_stem_subject(subject, stream)

        if extraction_status not in {"complete"}:
            reason = extraction_status or "missing_extraction_status"
            report["books_skipped"] += 1
            report["book_skip_reasons"][reason] += 1
            report["books_skipped_detail"].append(
                {
                    "source_key": source_key,
                    "form_level": form_level,
                    "stream": stream,
                    "subject": subject,
                    "reason": reason,
                }
            )
            continue

        report["books_processed"] += 1
        lessons_out: list[dict[str, Any]] = []
        lesson_skip_counts = {
            "skipped_status": 0,
            "skipped_empty": 0,
            "skipped_low_content": 0,
            "skipped_no_teachable_content": 0,
        }

        for lesson in raw.get("lessons") or []:
            try:
                lesson_status = (lesson.get("extraction_status") or "").lower()
                if lesson_status != "complete":
                    lesson_skip_counts["skipped_status"] += 1
                    report["lessons_skipped"] += 1
                    report["lesson_skip_reasons"]["skipped_status"] += 1
                    continue

                lesson_text = lesson.get("text_content") or ""
                if not normalize_space(lesson_text):
                    lesson_skip_counts["skipped_empty"] += 1
                    report["lessons_skipped"] += 1
                    report["lesson_skip_reasons"]["skipped_empty"] += 1
                    continue

                char_count = lesson_char_count(lesson, lesson_text)
                char_threshold = 1500 if is_stem else 800
                if char_count < char_threshold:
                    lesson_skip_counts["skipped_low_content"] += 1
                    report["lessons_skipped"] += 1
                    report["lesson_skip_reasons"]["skipped_low_content"] += 1
                    continue

                lesson_title = lesson.get("title") or ""
                if has_obvious_non_teachable_title(lesson_title) or not has_real_content_lines(lesson_text) or looks_like_toc_or_caption(lesson_text):
                    lesson_skip_counts["skipped_no_teachable_content"] += 1
                    report["lessons_skipped"] += 1
                    report["lesson_skip_reasons"]["skipped_no_teachable_content"] += 1
                    continue

                elaborated = build_lesson_elaboration(raw, lesson, generated_at)
                lessons_out.append(elaborated)
                report["lessons_elaborated"] += 1
                report["quiz_questions_generated"] += 4
            except Exception as exc:
                report["failures"].append(
                    {
                        "source_key": source_key,
                        "lesson_key": lesson.get("lesson_key", ""),
                        "error": str(exc),
                    }
                )

        out_dir = output_root / f"Tingkatan {form_level}" / str(stream)
        out_dir.mkdir(parents=True, exist_ok=True)
        output_file = out_dir / f"{source_key}.elaborated.json"
        payload = {
            "source_key": source_key,
            "title": raw.get("title", ""),
            "subject": subject,
            "form_level": form_level,
            "stream": stream,
            "language": lang,
            "elaborated_count": len(lessons_out),
            "skipped_count": sum(lesson_skip_counts.values()),
            "lessons": lessons_out,
        }
        output_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

        report["books"].append(
            {
                "source_key": source_key,
                "form_level": form_level,
                "stream": stream,
                "subject": subject,
                "elaborated_count": len(lessons_out),
                "skipped_count": sum(lesson_skip_counts.values()),
                "output_file": str(output_file),
                "lesson_skip_counts": lesson_skip_counts,
            }
        )

    report["lesson_skip_reasons"] = dict(report["lesson_skip_reasons"])
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate elaborated lesson JSON for one form level.")
    parser.add_argument("--form-level", type=int, required=True)
    parser.add_argument(
        "--input-dir",
        default=str(Path("scripts") / "textbook_json"),
        help="Input textbook JSON folder",
    )
    parser.add_argument(
        "--output-dir",
        default=str(Path("downloads") / "elaborated"),
        help="Output folder for elaborated artifacts",
    )
    parser.add_argument("--report-path", default="")
    args = parser.parse_args()

    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except Exception:
        pass

    report = process_form(
        form_level=args.form_level,
        input_root=Path(args.input_dir),
        output_root=Path(args.output_dir),
    )

    if args.report_path:
        report_path = Path(args.report_path)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
