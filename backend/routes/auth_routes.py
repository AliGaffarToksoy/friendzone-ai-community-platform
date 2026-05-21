"""
Authentication routes for FriendZone.

Provides user registration and login endpoints. Registration requires
a `.edu.tr` email address and a password of at least six characters.
On successful registration or login, a JWT access token is returned.
"""

from flask import Blueprint, request
from flask_jwt_extended import create_access_token
from backend.database.db_connection import db
from backend.models.user_model import User
from backend.utils.validators import is_valid_edu_email, is_strong_password
from backend.utils.helpers import success_response, error_response
from backend import bcrypt

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register() -> tuple:
    """Register a new user.

    Expects JSON with `name`, `email`, `password`, and optional
    `university`, `department` and `year` fields. Only emails ending
    with `.edu.tr` are allowed. Passwords must be at least six
    characters long. Returns a JWT token on success.
    """
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    university = data.get('university', '').strip()
    department = data.get('department', '').strip()
    year = data.get('year', '').strip()

    if not (name and email and password):
        return error_response('Lütfen gerekli tüm alanları doldurun.')

    if not is_valid_edu_email(email):
        return error_response('Yalnızca .edu.tr uzantılı e-posta adresleri kabul edilir.')

    if not is_strong_password(password):
        return error_response('Şifre en az 6 karakter olmalıdır.')

    # Check if user already exists
    if User.query.filter_by(email=email).first():
        return error_response('Bu e-posta adresi zaten kayıtlı.')

    # Hash password
    pw_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    # Create user
    user = User(
        name=name,
        email=email,
        password_hash=pw_hash,
        university=university,
        department=department,
        year=year
    )
    db.session.add(user)
    db.session.commit()

    # Create JWT token
    access_token = create_access_token(identity=str(user.id))

    return success_response('Kayıt başarılı.', {'token': access_token, 'user_id': user.id})


@auth_bp.route('/login', methods=['POST'])
def login() -> tuple:
    """Authenticate a user and return a JWT token.

    Expects JSON with `email` and `password`. Returns a token and a
    suggested next page depending on whether the user has completed
    the personality test.
    """
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not (email and password):
        return error_response('E-posta ve şifre gereklidir.')

    user = User.query.filter_by(email=email).first()
    if not user or not bcrypt.check_password_hash(user.password_hash, password):
        return error_response('Geçersiz giriş bilgileri.')

    if not user.is_active:
        return error_response('Hesabınız devre dışı bırakılmıştır.')

    access_token = create_access_token(identity=str(user.id))
    next_page = 'personality_test.html' if not user.is_test_completed else 'communities.html'

    return success_response('Giriş başarılı.', {
        'token': access_token,
        'user_id': user.id,
        'next': next_page
    })