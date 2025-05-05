#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Construit le front (Vite) et copie la build dans backend/static
# Appelé automatiquement par le workflow GitHub Actions ou manuellement en local
# -----------------------------------------------------------------------------
set -e

echo "🛠️  Build du front (Vite)"
cd frontend

# installation propre (CI) ; fallback npm install en local si ci‑dessous échoue
npm ci || npm install

npm run build              # ➜ frontend/dist

echo "📦  Copie de la build dans backend/static"
cd ..
rm -rf backend/static
mkdir  -p backend/static
cp -a frontend/dist/. backend/static/

echo "✅  Front prêt dans backend/static"
