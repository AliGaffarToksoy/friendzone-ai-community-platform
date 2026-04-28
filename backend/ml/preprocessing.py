"""
Preprocessing utilities for machine learning components.

Currently contains helper functions to vectorize categorical data such
as hobbies for similarity computations. Future versions may include
normalization and feature scaling.
"""

from typing import List
from sklearn.feature_extraction.text import CountVectorizer


def vectorize_hobbies(hobby_lists: List[List[str]]):
    """Vectorize lists of hobbies into a sparse matrix using count vectorizer.

    Args:
        hobby_lists: A list where each element is a list of hobbies for a user.

    Returns:
        A tuple of (matrix, vectorizer) where `matrix` is the term-document
        matrix and `vectorizer` is the fitted CountVectorizer instance.
    """
    # Join hobbies into a single string per user
    documents = [' '.join(h).lower() for h in hobby_lists]
    vectorizer = CountVectorizer()
    matrix = vectorizer.fit_transform(documents)
    return matrix, vectorizer