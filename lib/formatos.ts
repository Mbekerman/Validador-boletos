/** 11 dígitos vira CPF e 14 vira CNPJ. Qualquer outra coisa volta como veio. */
export function formatarDocumento(doc: string | null): string | null {
  if (!doc) return doc;
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  return doc;
}

// Códigos COMPE mais comuns. Um código fora da lista aparece só como número.
const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil", "004": "Banco do Nordeste", "021": "Banestes", "033": "Santander",
  "037": "Banpará", "041": "Banrisul", "047": "Banese", "070": "BRB", "077": "Inter", "085": "Ailos",
  "104": "Caixa", "121": "Agibank", "133": "Cresol", "136": "Unicred", "197": "Stone",
  "208": "BTG Pactual", "212": "Banco Original", "218": "BS2", "237": "Bradesco", "246": "ABC Brasil",
  "260": "Nubank", "290": "PagBank", "318": "BMG", "323": "Mercado Pago", "336": "C6 Bank",
  "341": "Itaú", "364": "Efí", "380": "PicPay", "389": "Mercantil do Brasil", "403": "Cora",
  "422": "Safra", "461": "Asaas", "623": "Banco Pan", "633": "Rendimento", "637": "Sofisa",
  "655": "Banco BV", "707": "Daycoval", "745": "Citibank", "748": "Sicredi", "756": "Sicoob",
};

/** "461" vira "461 · Asaas". Se o Asaas já mandar um nome, mantém o nome. */
export function formatarBanco(banco: string | null): string | null {
  if (!banco) return banco;
  const b = banco.trim();
  if (!/^\d{1,3}$/.test(b)) return b;
  const cod = b.padStart(3, "0");
  return BANCOS[cod] ? `${cod} · ${BANCOS[cod]}` : cod;
}
