"""
Admin panel API routes.

These routes provide administrative statistics and data exports. Access
is protected via basic authentication using the credentials defined in
the application's configuration.
"""

from datetime import datetime, timedelta
from functools import wraps
from collections import Counter
from flask import Blueprint, request, current_app
from backend.database.db_connection import db
from backend.models.user_model import User
from backend.models.community_model import Community, CommunityMember
from backend.models.chat_model import ChatMessage
from backend.utils.helpers import success_response, error_response


admin_bp = Blueprint('admin', __name__)


def admin_required(func):
    """Decorator to enforce basic authentication for admin routes."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        if request.method == 'OPTIONS':
            return '', 204

        auth = request.authorization

        if not auth:
            return error_response('Yetkisiz erişim.', status_code=401)

        username = auth.username
        password = auth.password

        expected_username = current_app.config.get('ADMIN_USERNAME', 'admin')
        expected_password = current_app.config.get('ADMIN_PASSWORD', 'admin123')

        if username != expected_username or password != expected_password:
            return error_response('Yetkisiz erişim.', status_code=401)

        return func(*args, **kwargs)

    return wrapper


@admin_bp.route('/dashboard/stats', methods=['GET'])
@admin_required
def dashboard_stats() -> tuple:
    """Return high-level statistics for the dashboard."""
    user_count = User.query.count()
    community_count = Community.query.count()
    message_count = ChatMessage.query.count()

    # Registration counts for last 7 days
    today = datetime.utcnow().date()
    daily_counts = []
    for i in range(7):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)
        count = User.query.filter(User.created_at >= datetime.combine(day, datetime.min.time()),
                                  User.created_at < datetime.combine(next_day, datetime.min.time())).count()
        daily_counts.append({'date': day.isoformat(), 'count': count})
    daily_counts.reverse()

    return success_response('Panel istatistikleri getirildi.', {
        'user_count': user_count,
        'community_count': community_count,
        'message_count': message_count,
        'registrations_last_7_days': daily_counts
    })


@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users() -> tuple:
    """Return a list of all users."""
    users = User.query.all()
    data = []
    for u in users:
        data.append({
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'university': u.university,
            'department': u.department,
            'year': u.year,
            'is_active': u.is_active,
            'created_at': u.created_at.isoformat(),
            'personality_type': u.personality_type,
        })
    return success_response('Kullanıcı listesi getirildi.', data)


@admin_bp.route('/communities', methods=['GET'])
@admin_required
def list_communities() -> tuple:
    """Return a list of all communities."""
    communities = Community.query.all()
    data = []
    for c in communities:
        data.append({
            'id': c.id,
            'name': c.name,
            'category': c.category,
            'description': c.description,
            'member_count': len(c.members),
            'max_members': c.max_members,
            'is_active': c.is_active,
        })
    return success_response('Topluluk listesi getirildi.', data)


@admin_bp.route('/personality-stats', methods=['GET'])
@admin_required
def personality_stats() -> tuple:
    """Return distribution of personality types."""
    users = User.query.filter(User.personality_type.isnot(None)).all()
    counts = Counter(u.personality_type for u in users if u.personality_type)
    data = [{'type': t, 'count': c} for t, c in counts.items()]
    return success_response('Kişilik tipleri istatistikleri getirildi.', data)


@admin_bp.route('/hobby-stats', methods=['GET'])
@admin_required
def hobby_stats() -> tuple:
    """Return popularity of hobbies across users."""
    hobby_counter: Counter[str] = Counter()
    users = User.query.filter(User.hobbies.isnot(None)).all()
    for u in users:
        for hobby in u.hobbies or []:
            hobby_counter[hobby] += 1
    data = [{'hobby': h, 'count': c} for h, c in hobby_counter.most_common()]
    return success_response('Hobi istatistikleri getirildi.', data)


@admin_bp.route('/export', methods=['GET'])
@admin_required
def export_data() -> tuple:
    """Export all primary data (users, communities, messages) in JSON format."""
    users = [
        {
            'id': u.id,
            'name': u.name,
            'email': u.email,
            'university': u.university,
            'department': u.department,
            'year': u.year,
            'bio': u.bio,
            'personality_type': u.personality_type,
            'hobbies': u.hobbies,
            'is_active': u.is_active,
            'created_at': u.created_at.isoformat(),
            'updated_at': u.updated_at.isoformat(),
        }
        for u in User.query.all()
    ]
    communities = [
        {
            'id': c.id,
            'name': c.name,
            'description': c.description,
            'category': c.category,
            'tags': c.tags,
            'compatibility_score': c.compatibility_score,
            'is_active': c.is_active,
            'max_members': c.max_members,
            'created_by': c.created_by,
            'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat(),
        }
        for c in Community.query.all()
    ]
    messages = [
        {
            'id': m.id,
            'community_id': m.community_id,
            'user_id': m.user_id,
            'content': m.content,
            'message_type': m.message_type,
            'timestamp': m.timestamp.isoformat(),
            'edited': m.edited,
            'reply_to': m.reply_to,
            'reactions': m.reactions,
        }
        for m in ChatMessage.query.all()
    ]
    return success_response('Veri export edildi.', {
        'users': users,
        'communities': communities,
        'messages': messages,
    })