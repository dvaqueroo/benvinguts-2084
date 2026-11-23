#!/bin/sh
# Publica els canvis: marca una versió nova, fa commit i push (Vercel desplega sol)
# i els mòbils amb la web oberta es recarreguen automàticament.
set -e
cd "$(dirname "$0")"
V=$(date +%Y%m%d%H%M%S)
printf '%s\n' "$V" > version.txt
sed -i '' -E "s/data-version=\"[^\"]*\"/data-version=\"$V\"/" index.html
find . -name .DS_Store -delete
git add -A
git commit -q -m "${1:-Actualització} ($V)" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q
echo "Publicat: versió $V"
