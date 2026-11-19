"""Convert the Russian Word question bank to an offline JavaScript data file."""

import argparse
import json
import re
import unicodedata
from pathlib import Path
from xml.etree import ElementTree
from zipfile import ZipFile

WORD = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ANSWER_MARKER = re.compile(r"ответ(?:ы)?\s*:", re.IGNORECASE)
SECTION_HEADING = re.compile(r"[А-ЯЁξ]")
INCOMPLETE = re.compile(
    r"\b(?:име(?:ет|ют) вид|по закону)\s+[,.]"
    r"|:\s*,\s*где\b"
    r"|\bугловой скоростью\s+рад/[сc]\b"
    r"|\bмежду векторами и\s*:"
    r"|\bкакое тело$"
    r"|^ускорение свободного падения принять\b",
    re.IGNORECASE,
)


def read_questions(source):
    with ZipFile(source) as document:
        root = ElementTree.fromstring(document.read("word/document.xml"))

    questions = {}
    records = 0
    for number, paragraph in enumerate(root.findall("w:body/w:p", WORD), start=1):
        raw = "".join(run.text or "" for run in paragraph.findall(".//w:t", WORD))
        text = " ".join(unicodedata.normalize("NFC", raw).split())
        if not text or SECTION_HEADING.fullmatch(text):
            continue

        # One delimiter in the supplied document is joined directly to the question.
        marker = ANSWER_MARKER.search(text)
        if not marker:
            raise ValueError(f"В абзаце {number} отсутствует пометка «ОТВЕТ:».")

        question = text[:marker.start()].strip()
        answer = text[marker.end():].strip()
        if not question or not answer:
            raise ValueError(f"В абзаце {number} отсутствует вопрос или ответ.")

        records += 1
        entry = questions.setdefault(question, {"question": question, "answers": []})
        if answer not in entry["answers"]:
            entry["answers"].append(answer)
        if INCOMPLETE.search(question):
            entry["incomplete"] = True

    if not questions:
        raise ValueError("В документе нет вопросов.")
    return list(questions.values()), records


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument(
        "--output", type=Path,
        default=Path(__file__).resolve().parents[1] / "dist" / "questions.js",
    )
    args = parser.parse_args()

    questions, records = read_questions(args.source)
    data = json.dumps(questions, ensure_ascii=False, indent=2)
    args.output.write_text(f"const physicsQuestions = {data};\n", encoding="utf-8")
    answer_count = sum(len(entry["answers"]) for entry in questions)
    print(f"{records} записей → {len(questions)} вопросов, {answer_count} ответов.")


if __name__ == "__main__":
    main()
