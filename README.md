# Validador de boletos

O usuário cola a linha digitável, o app consulta o Asaas e diz se o boleto está liberado para pagamento. Quando está liberado, o app mostra os dados do recebedor. Os boletos consultados ficam em duas tabelas, liberados e não liberados, e os não liberados têm um botão para reconsultar.

## Como "liberado" é decidido

O Asaas não tem um campo "liberado". O app usa o `POST /v3/bill/simulate` ([docs](https://docs.asaas.com/reference/simulate-a-bill-payment)), que simula um pagamento de conta sem criá-lo. Os casos são tratados assim:

| Resposta do Asaas | Resultado no app |
|---|---|
| 200 com `bankSlipInfo` | **Liberado**. Guarda `beneficiaryName`, `beneficiaryCpfCnpj`, `companyName`, `bank`, `value`, `dueDate` e `isOverdue` |
| 400 de regra do boleto (dados inválidos, boleto não encontrado etc.) | **Não liberado**, com a mensagem do Asaas |
| 401/403, 429, 5xx, falha de rede, ou "pagamento de contas não habilitado" | **Erro**. Não grava nada, para não marcar o boleto como não liberado por uma falha da integração |

Essa regra é uma inferência. A documentação não garante que um boleto recém-emitido e ainda não registrado volte sempre como 400. Vale testar com um boleto real.

Antes de chamar o Asaas, o app confere os dígitos verificadores da linha, tanto de boletos bancários (47 dígitos) quanto de arrecadação (48 dígitos).

Requisitos da conta Asaas:
- A chave tem que ser de **produção**, porque a sandbox só reconhece boletos criados nela mesma.
- A conta precisa ter **Pagamento de contas** habilitado.

## Login

O login usa Google OAuth (authorization code com PKCE, `state` e `nonce`) e não depende de biblioteca de auth. O servidor verifica o `id_token` contra as chaves do Google e só cria a sessão se todas as condições abaixo forem verdadeiras:
- `email_verified` é verdadeiro;
- o domínio do e-mail é exatamente `ALLOWED_DOMAIN` (`bkm.com.br`);
- o claim `hd` é igual ao domínio, ou seja, a conta é do Google Workspace da empresa. Isso bloqueia uma conta Google pessoal criada com um endereço @bkm.com.br. Para desligar essa checagem, use `REQUIRE_HD=false`.

O parâmetro `hd` na URL do Google serve só como dica de interface. A sessão fica num cookie httpOnly assinado (HS256) e dura 12 horas.

## Rodar local

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run db:migrate           # cria a tabela no Neon
npm run dev
```

Testes: `npm test`.

## Deploy (Cloud Run)

```bash
# segredos no Secret Manager (uma vez)
printf %s "$ASAAS_API_KEY" | gcloud secrets create asaas-api-key --data-file=-
# ... o mesmo para google-client-secret, session-secret, database-url

gcloud run deploy validador-boletos --source . --region southamerica-east1 \
  --allow-unauthenticated \
  --set-env-vars APP_URL=https://SEU-DOMINIO,GOOGLE_CLIENT_ID=...,ALLOWED_DOMAIN=bkm.com.br,ASAAS_BASE_URL=https://api.asaas.com/v3 \
  --set-secrets ASAAS_API_KEY=asaas-api-key:latest,GOOGLE_CLIENT_SECRET=google-client-secret:latest,SESSION_SECRET=session-secret:latest,DATABASE_URL=database-url:latest
```

Cadastre `https://SEU-DOMINIO/api/auth/callback` como URI de redirecionamento no cliente OAuth. O `--allow-unauthenticated` é necessário porque quem controla o acesso é o login do próprio app.
