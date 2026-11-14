#!/usr/bin/env bash
# Grava o cliente OAuth do Google no serviço já publicado.
set -euo pipefail
SERVICE=validador-boletos
REGION="${REGION:-southamerica-east1}"
read -rp "ID do cliente (termina em .apps.googleusercontent.com): " CID
read -rsp "Chave secreta do cliente (não aparece na tela): " CSEC; echo
[ -n "$CID" ] && [ -n "$CSEC" ] || { echo "Valores vazios."; exit 1; }
printf %s "$CSEC" | gcloud secrets versions add google-client-secret --data-file=- >/dev/null
gcloud run services update "$SERVICE" --region "$REGION" \
  --update-env-vars "GOOGLE_CLIENT_ID=${CID}" \
  --update-secrets "GOOGLE_CLIENT_SECRET=google-client-secret:latest" >/dev/null
echo "Pronto: $(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
