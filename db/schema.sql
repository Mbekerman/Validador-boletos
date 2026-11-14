CREATE TABLE IF NOT EXISTS boletos (
  id                      BIGSERIAL PRIMARY KEY,
  linha_digitavel         TEXT NOT NULL UNIQUE,
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
  consultado_por          TEXT NOT NULL,
  consultas               INTEGER NOT NULL DEFAULT 1,
  criado_em               TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_consulta_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS boletos_status_idx ON boletos (status, ultima_consulta_em DESC);
