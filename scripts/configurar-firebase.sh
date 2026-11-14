#!/usr/bin/env bash
# Publica o validador em https://validaboleto.web.app usando o Firebase Hosting na frente do Cloud Run.
# Rode no Cloud Shell, depois de um deploy com o código atual: bash scripts/configurar-firebase.sh
set -euo pipefail

SITE=validaboleto
SERVICE=validador-boletos
REGION="${REGION:-southamerica-east1}"
PROJECT="$(gcloud config get-value project 2>/dev/null)"
URL="https://${SITE}.web.app"

echo "Projeto: $PROJECT   Site: $URL"
read -rp "Confirma? (s/n) " ok
[ "$ok" = "s" ] || exit 1

TOKEN="$(gcloud auth print-access-token)"
api() { # api MÉTODO URL [JSON]
  curl -sS -X "$1" "$2" -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROJECT" \
    -H "Content-Type: application/json" ${3:+-d "$3"} -w '\n%{http_code}'
}
codigo() { tail -n1 <<<"$1"; }
corpo() { sed '$d' <<<"$1"; }

echo "Ativando APIs do Firebase..."
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com

echo "Ligando o Firebase ao projeto..."
r="$(api GET "https://firebase.googleapis.com/v1beta1/projects/$PROJECT")"
if [ "$(codigo "$r")" != 200 ]; then
  r="$(api POST "https://firebase.googleapis.com/v1beta1/projects/$PROJECT:addFirebase" '{}')"
  if [ "$(codigo "$r")" != 200 ]; then
    corpo "$r"
    echo "Não consegui ligar o Firebase. Abra https://console.firebase.google.com, clique em"
    echo "'Criar um projeto', escolha o projeto $PROJECT já existente e rode este script de novo."
    exit 1
  fi
  echo "  aguardando o Firebase terminar (até 1 minuto)..."
  for _ in $(seq 1 12); do
    sleep 5
    [ "$(codigo "$(api GET "https://firebase.googleapis.com/v1beta1/projects/$PROJECT")")" = 200 ] && break
  done
fi

echo "Criando o site $SITE..."
r="$(api GET "https://firebasehosting.googleapis.com/v1beta1/projects/$PROJECT/sites/$SITE")"
if [ "$(codigo "$r")" != 200 ]; then
  r="$(api POST "https://firebasehosting.googleapis.com/v1beta1/projects/$PROJECT/sites?siteId=$SITE" '{}')"
  if [ "$(codigo "$r")" != 200 ]; then
    corpo "$r"
    echo "O nome '$SITE' não pôde ser criado (talvez já esteja em uso por outra pessoa)."
    exit 1
  fi
fi

echo
echo "ANTES DE CONTINUAR, no Console do Google Cloud > APIs e serviços > Credenciais > seu ID do cliente OAuth,"
echo "adicione em 'URIs de redirecionamento autorizados' (mantenha o que já existe):"
echo
echo "  $URL/api/auth/callback"
echo
read -rp "Salvou no Console? (s/n) " ok
[ "$ok" = "s" ] || { echo "Rode o script de novo depois de salvar."; exit 1; }

echo "Apontando $URL para o Cloud Run..."
CONF="{\"config\":{\"rewrites\":[{\"glob\":\"**\",\"run\":{\"serviceId\":\"$SERVICE\",\"region\":\"$REGION\"}}]}}"
r="$(api POST "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE/versions" "$CONF")"
[ "$(codigo "$r")" = 200 ] || { corpo "$r"; echo "Falha ao criar a versão."; exit 1; }
VERSAO="$(corpo "$r" | python3 -c 'import json,sys; print(json.load(sys.stdin)["name"])')"
r="$(api PATCH "https://firebasehosting.googleapis.com/v1beta1/$VERSAO?update_mask=status" '{"status":"FINALIZED"}')"
[ "$(codigo "$r")" = 200 ] || { corpo "$r"; echo "Falha ao finalizar a versão."; exit 1; }
r="$(api POST "https://firebasehosting.googleapis.com/v1beta1/sites/$SITE/releases?versionName=$VERSAO" '{}')"
[ "$(codigo "$r")" = 200 ] || { corpo "$r"; echo "Falha ao publicar."; exit 1; }

echo "Atualizando o endereço do app..."
gcloud run services update "$SERVICE" --region "$REGION" --update-env-vars "APP_URL=$URL" >/dev/null

echo
echo "Pronto: $URL"
