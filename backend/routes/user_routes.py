"""
User profile routes.

These endpoints allow retrieval and update of user profiles and finding
similar users based on hobbies.
"""

from flask import Blueprint, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from backend.database.db_connection import db
from backend.models.user_model import User
from backend.utils.helpers import success_response, error_response
from backend.ml.similarity_engine import find_similar_users


user_bp = Blueprint('user', __name__)


@user_bp.route('/profile/<int:user_id>', methods=['GET'])
@jwt_required()
def get_profile(user_id: int) -> tuple:
    """Return the profile of the specified user."""
    current_user_id = int(get_jwt_identity())
    if current_user_id != user_id:
        return error_response('Bu işlem için yetkiniz yok.', status_code=403)
    user = User.query.get(user_id)
    if not user:
        return error_response('Kullanıcı bulunamadı.', status_code=404)
    data = {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'university': user.university,
        'department': user.department,
        'year': user.year,
        'bio': user.bio,
        'personality_type': user.personality_type,
        'hobbies': user.hobbies,
        'is_active': user.is_active,
        'created_at': user.created_at.isoformat(),
        'updated_at': user.updated_at.isoformat(),
    }
    return success_response('Profil getirildi.', data)


@user_bp.route('/profile/update', methods=['POST'])
@jwt_required()
def update_profile() -> tuple:
    """Update the authenticated user's profile."""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)
    if not user:
        return error_response('Kullanıcı bulunamadı.', status_code=404)
    data = request.get_json() or {}
    # Update fields if provided
    for field in ['name', 'university', 'department', 'year', 'bio']:
        if field in data and data[field] is not None:
            setattr(user, field, data[field])
    db.session.commit()
    return success_response('Profil güncellendi.', {
        'id': user.id
    })


@user_bp.route('/similar/<int:user_id>', methods=['GET'])
@jwt_required()
def get_similar_users(user_id: int) -> tuple:
    """Return users similar to the specified user."""
    current_user_id = int(get_jwt_identity())
    if current_user_id != user_id:
        return error_response('Bu işlem için yetkiniz yok.', status_code=403)
    user = User.query.get(user_id)
    if not user:
        return error_response('Kullanıcı bulunamadı.', status_code=404)
    similar = find_similar_users(user_id)
    data = [
        {
            'id': u.id,
            'name': u.name,
            'university': u.university,
            'department': u.department,
            'personality_type': u.personality_type,
        } for u in similar
    ]
    return success_response('Benzer kullanıcılar getirildi.', data)