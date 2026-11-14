#!/usr/bin/env bash
# Deploy do validador no Cloud Run, pensado para rodar no Cloud Shell (já vem com gcloud logado).
# Uso: bash scripts/deploy-cloudshell.sh
set -euo pipefail

SERVICE=validador-boletos
REGION="${REGION:-southamerica-east1}"

PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ -z "$PROJECT" ] || [ "$PROJECT" = "(unset)" ]; then
  gcloud projects list --format="table(projectId,name)"
  read -rp "ID do projeto para usar: " PROJECT
  gcloud config set project "$PROJECT" >/dev/null
fi
echo
echo "Projeto: $PROJECT"
echo "Região:  $REGION"
read -rp "Confirma? (s/n) " ok
[ "$ok" = "s" ] || { echo "Cancelado. Para outro projeto: gcloud config set project ID"; exit 1; }

echo "Ativando APIs (pode levar 1 minuto)..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

existe() { gcloud secrets describe "$1" >/dev/null 2>&1; }
gravar() {
  if existe "$1"; then printf %s "$2" | gcloud secrets versions add "$1" --data-file=- >/dev/null
  else printf %s "$2" | gcloud secrets create "$1" --data-file=- --replication-policy=automatic >/dev/null; fi
}
pedir() {
  if existe "$1"; then
    read -rp "O segredo $1 já existe. Trocar o valor? (s/n) " t
    [ "$t" = "s" ] || return 0
  fi
  read -rsp "$2: " v; echo
  [ -n "$v" ] || { echo "Valor vazio. Rode o script de novo."; exit 1; }
  gravar "$1" "$v"
  echo "  $1 gravado."
}

pedir asaas-api-key "Cole a chave de PRODUÇÃO do Asaas (não aparece na tela)"
pedir database-url "Cole a connection string do Neon, a com pooler (não aparece na tela)"
existe session-secret || { gravar session-secret "$(openssl rand -base64 48)"; echo "  session-secret gerado."; }
existe google-client-secret || gravar google-client-secret "pendente"

# A conta de serviço padrão do Cloud Run precisa ler os segredos.
PN="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')"
SA="${PN}-compute@developer.gserviceaccount.com"
for s in asaas-api-key database-url session-secret google-client-secret; do
  gcloud secrets add-iam-policy-binding "$s" --member="serviceAccount:$SA" \
    --role=roles/secretmanager.secretAccessor >/dev/null
done

# Mantém GOOGLE_CLIENT_ID e APP_URL se o serviço já existir.
ATUAL_CLIENT_ID="$(gcloud run services describe "$SERVICE" --region "$REGION" \
  --format='value(spec.template.spec.containers[0].env.filter(name=GOOGLE_CLIENT_ID).extract(value).flatten())' 2>/dev/null || true)"
CLIENT_ID="${ATUAL_CLIENT_ID:-pendente}"

echo "Publicando (o build leva uns 3 a 5 minutos)..."
gcloud run deploy "$SERVICE" --source . --region "$REGION" --allow-unauthenticated --quiet \
  --set-env-vars "ALLOWED_DOMAIN=bkm.com.br,ASAAS_BASE_URL=https://api.asaas.com/v3,APP_ENV=production,GOOGLE_CLIENT_ID=${CLIENT_ID},APP_URL=https://pendente" \
  --set-secrets "ASAAS_API_KEY=asaas-api-key:latest,DATABASE_URL=database-url:latest,SESSION_SECRET=session-secret:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars "APP_URL=${URL}" >/dev/null

echo
echo "Publicado em: $URL"
if [ "$CLIENT_ID" = "pendente" ]; then
  echo
  echo "Falta o login Google. No Console do Google Cloud:"
  echo "  APIs e serviços > Tela de permissão OAuth: tipo Interno (só contas da BKM)."
  echo "  APIs e serviços > Credenciais > Criar credenciais > ID do cliente OAuth > Aplicativo da Web."
  echo "  URI de redirecionamento autorizado: ${URL}/api/auth/callback"
  echo "Depois rode: bash scripts/configurar-google.sh"
fi
