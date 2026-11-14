CREATE TABLE IF NOT EXISTS usuarios (
  email            TEXT PRIMARY KEY,
  nome             TEXT,
  foto             TEXT,
  ultimo_login_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Cada pessoa tem a própria linha por boleto (usuario = dono da consulta).
CREATE TABLE IF NOT EXISTS boletos (
  id                      BIGSERIAL PRIMARY KEY,
  linha_digitavel         TEXT NOT NULL,
  usuario                 TEXT NOT NULL,
  status                  TEXT NOT NULL CHECK (status IN ('liberado', 'nao_liberado')),
  beneficiario_nome       TEXT,
  beneficiario_documento  TEXT,
  empresa                 TEXT,
  banco                   TEXT,
  valor                   NUMERIC(14, 2),
  vencimento              DATE,
  vencido                 BOOLEAN,
  motivo                  TEXT,
  resposta                JSONB,
  ultima_consulta_por     TEXT NOT NULL,
  consultas               INTEGER NOT NULL DEFAULT 1,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_consulta_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (linha_digitavel, usuario)
);

CREATE INDEX IF NOT EXISTS boletos_usuario_idx ON boletos (usuario, ultima_consulta_em DESC);
CREATE INDEX IF NOT EXISTS boletos_status_idx ON boletos (status, ultima_consulta_em DESC);
