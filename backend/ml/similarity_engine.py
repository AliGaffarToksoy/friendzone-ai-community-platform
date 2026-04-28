"""
Similarity engine for finding users with similar interests.

Uses a simple Jaccard index to compare users' hobbies. In future
iterations, this could be replaced with cosine similarity on
vectorized hobbies or more sophisticated clustering algorithms.
"""

from typing import List
from backend.models.user_model import User
from backend.database.db_connection import db


def find_similar_users(user_id: int, top_n: int = 5) -> List[User]:
    """Return a list of users similar to the given user based on hobbies.

    Args:
        user_id: The ID of the target user.
        top_n: Maximum number of similar users to return.

    Returns:
        A list of User instances sorted by similarity descending.
    """
    target_user = User.query.get(user_id)
    if not target_user or not target_user.hobbies:
        return []

    target_set = set([h.lower() for h in target_user.hobbies])
    similarities: list[tuple[float, User]] = []
    # Consider only users who have completed the test and have hobbies
    candidates = User.query.filter(User.id != user_id, User.hobbies.isnot(None)).all()
    for u in candidates:
        hobbies = u.hobbies or []
        if not hobbies:
            continue
        other_set = set([h.lower() for h in hobbies])
        intersection = target_set & other_set
        union = target_set | other_set
        score = (len(intersection) / len(union)) if union else 0.0
        if score > 0:
            similarities.append((score, u))
    # Sort by similarity score descending
    similarities.sort(key=lambda x: -x[0])
    return [u for score, u in similarities[:top_n]]