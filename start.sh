#!/usr/bin/env bash

set -e

echo "FriendZone backend başlatılıyor..."

echo "PostgreSQL bağlantısı bekleniyor..."

until nc -z postgres 5432; do
  echo "PostgreSQL henüz hazır değil, bekleniyor..."
  sleep 2
done


echo "PostgreSQL hazır."


export FLASK_APP=backend.app

echo "Migration kontrol ediliyor..."

if [ ! -d "migrations" ]; then
  echo "Migrations klasörü bulunamadı. flask db init çalıştırılıyor..."
  flask db init || true
fi

echo "Migration oluşturuluyor..."
flask db migrate -m "auto migration" || true

echo "Migration uygulanıyor..."
flask db upgrade || true

echo "Seed data yükleniyor..."
python -m backend.database.seed_data || true

echo "Backend Socket.IO server başlatılıyor..."

python -m backend.app