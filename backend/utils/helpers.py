"""
Utility helper functions for API responses and personality calculation.
"""

from __future__ import annotations

from flask import jsonify
from typing import Any


def success_response(message: str = "İşlem başarılı", data: Any = None, status_code: int = 200):
    """Return a standard successful JSON response."""
    return jsonify({
        "success": True,
        "message": message,
        "data": data if data is not None else {}
    }), status_code


def error_response(message: str = "Bir hata oluştu", error: str | None = None, status_code: int = 400):
    """Return a standard error JSON response."""
    return jsonify({
        "success": False,
        "message": message,
        "error": error
    }), status_code


def compute_mbti(answers: list[int]) -> str:
    """
    Compute MBTI type from a 24-question Likert test.

    Each answer must be between 1 and 5.
    The mapping below must stay aligned with frontend/js/testHandler.js QUESTIONS order.

    Logic:
    - Each question has an axis and a positive letter.
    - If answer is above neutral, positive letter gains points.
    - If answer is below neutral, opposite letter gains points.
    - Neutral answers have little/no impact.
    """

    if len(answers) != 24:
        raise ValueError("Kişilik testi 24 cevaptan oluşmalıdır.")

    if any(answer < 1 or answer > 5 for answer in answers):
        raise ValueError("Tüm cevaplar 1 ile 5 arasında olmalıdır.")

    question_map = [
        {"axis": "EI", "positive": "E"},
        {"axis": "EI", "positive": "I"},
        {"axis": "EI", "positive": "E"},
        {"axis": "EI", "positive": "I"},
        {"axis": "EI", "positive": "E"},
        {"axis": "EI", "positive": "I"},

        {"axis": "SN", "positive": "S"},
        {"axis": "SN", "positive": "N"},
        {"axis": "SN", "positive": "S"},
        {"axis": "SN", "positive": "N"},
        {"axis": "SN", "positive": "S"},
        {"axis": "SN", "positive": "N"},

        {"axis": "TF", "positive": "T"},
        {"axis": "TF", "positive": "F"},
        {"axis": "TF", "positive": "T"},
        {"axis": "TF", "positive": "F"},
        {"axis": "TF", "positive": "T"},
        {"axis": "TF", "positive": "F"},

        {"axis": "JP", "positive": "J"},
        {"axis": "JP", "positive": "P"},
        {"axis": "JP", "positive": "J"},
        {"axis": "JP", "positive": "P"},
        {"axis": "JP", "positive": "J"},
        {"axis": "JP", "positive": "P"},
    ]

    scores = {
        "E": 0,
        "I": 0,
        "S": 0,
        "N": 0,
        "T": 0,
        "F": 0,
        "J": 0,
        "P": 0,
    }

    opposites = {
        "E": "I",
        "I": "E",
        "S": "N",
        "N": "S",
        "T": "F",
        "F": "T",
        "J": "P",
        "P": "J",
    }

    for index, answer in enumerate(answers):
        mapping = question_map[index]
        positive_letter = mapping["positive"]
        negative_letter = opposites[positive_letter]

        distance_from_neutral = answer - 3

        if distance_from_neutral > 0:
            scores[positive_letter] += distance_from_neutral
        elif distance_from_neutral < 0:
            scores[negative_letter] += abs(distance_from_neutral)

    result = ""
    result += "E" if scores["E"] >= scores["I"] else "I"
    result += "S" if scores["S"] >= scores["N"] else "N"
    result += "T" if scores["T"] >= scores["F"] else "F"
    result += "J" if scores["J"] >= scores["P"] else "P"

    return result