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

## Interface

Segue as [Diretrizes de design BKM](https://claude.ai/artifact/9X3yJh6UijhD3SjsLvwzHz): Material 3 do Google sobre a marca BKM, Google Sans Flex, quadros contornados, botões em cápsula, chips tonais, tema claro, escuro ou automático (no menu do avatar). As tabelas ordenam pelo clique no título e viram lista no celular. O logo e o símbolo vêm do [Design System BKM](https://claude.ai/artifact/N76hgnKi7LrCSpCusmwFCL), em `public/marca/` e `app/icon.svg`. Com `APP_ENV` diferente de `production`, aparece o selo "Desenvolvimento" e `[DEV]` no título da aba.

## Banco

Neon, projeto `validador-boletos` (`cold-brook-50206564`, aws-us-east-2), na org `org-round-hat-68493592`. A tabela `boletos` já foi criada. Para recriá-la em outro banco, use `npm run db:migrate`.

## Rodar local

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run db:migrate           # cria a tabela no Neon
npm run dev
```

Testes: `npm test`.

## Deploy (Cloud Run)

No Cloud Shell (console.cloud.google.com, ícone de terminal no topo), que já vem com o gcloud logado:

```bash
git clone https://github.com/Mbekerman/validador-boletos && cd validador-boletos
bash scripts/deploy-cloudshell.sh
```

O script ativa as APIs, pede a chave do Asaas e a connection string do Neon (sem mostrar na tela) e grava as duas no Secret Manager. Também gera o `SESSION_SECRET`, dá à conta do Cloud Run acesso aos segredos, publica em `southamerica-east1` e mostra a URL. Depois, crie o cliente OAuth no Console (tela de permissão do tipo **Interno**, cliente "Aplicativo da Web", redirecionamento `URL/api/auth/callback`) e rode `bash scripts/configurar-google.sh`.

Para atualizar depois de uma mudança no código: `git pull && bash scripts/deploy-cloudshell.sh`. Os segredos que já existem são mantidos.

O `--no-invoker-iam-check` deixa a URL aberta, porque a organização bkm.com.br bloqueia `allUsers`. Quem controla o acesso é o login do próprio app.

## Endereço amigável (validaboleto.web.app)

O Firebase Hosting fica na frente do Cloud Run, porque o Cloud Run não aceita domínio próprio em southamerica-east1. Ele só repassa o cookie `__session`, por isso o login usa esse nome. Para configurar, rode `bash scripts/configurar-firebase.sh` no Cloud Shell. O `deploy-cloudshell.sh` mantém o `APP_URL` que já estiver configurado.
