// Reading a contact list in the browser: CSV (Google, Outlook, Excel, any
// spreadsheet) or vCard (iPhone, Android, Mac). Nothing leaves the browser
// until the import is confirmed.

export type Field = 'first_name' | 'last_name' | 'name' | 'email' | 'phone' | 'company' | 'role' | 'city' | 'country' | 'address_line' | 'postal_code' | 'website' | 'linkedin' | 'note' | 'tags';
export const FIELD_LABEL: Record<Field, string> = {
  first_name: 'Prénom', last_name: 'Nom', name: 'Nom complet', email: 'Email', phone: 'Téléphone', company: 'Société', role: 'Fonction', city: 'Ville',
  country: 'Pays', address_line: 'Adresse', postal_code: 'Code postal', website: 'Site web', linkedin: 'LinkedIn', note: 'Note', tags: 'Étiquettes',
};
export type Row = Partial<Record<Exclude<Field, 'tags'>, string>> & { tags?: string[] };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// header words → field, for French and English exports (Google, Outlook, Apple, HubSpot…)
const SYNONYMS: [RegExp, Field][] = [
  [/^(first name|given name|prenom|firstname)$/, 'first_name'],
  [/^(last name|family name|surname|nom de famille|lastname|nom)$/, 'last_name'],
  [/^(name|full name|display name|nom complet|contact|contact name)$/, 'name'],
  [/^(e ?mail|email address|e mail 1 value|courriel|adresse e ?mail|e mail address|primary email)/, 'email'],
  [/^(phone|telephone|tel|mobile|mobile phone|portable|phone 1 value|primary phone|numero|whatsapp|cell)/, 'phone'],
  [/^(job title|title|role|fonction|poste|organization 1 title)/, 'role'],
  [/^(company|organization|organisation|societe|entreprise|organization 1 name|company name)/, 'company'],
  [/^(city|ville|address 1 city|home city|business city)/, 'city'],
  [/^(country|pays|address 1 country|country region|home country region|business country region)/, 'country'],
  [/^(address|adresse|street|rue|address 1 street|home street|business street)/, 'address_line'],
  [/^(postal code|zip|code postal|cp|address 1 postal code|zip code)/, 'postal_code'],
  [/^(website|site|site web|web page|url|website 1 value)/, 'website'],
  [/^(linkedin|linkedin url|profil linkedin)/, 'linkedin'],
  [/^(notes?|commentaires?|remarques?|description)$/, 'note'],
  [/^(tags?|labels?|etiquettes?|groups?|group membership|categories)$/, 'tags'],
];
export function guessField(header: string): Field | '' {
  const h = norm(header);
  for (const [re, f] of SYNONYMS) if (re.test(h)) return f;
  return '';
}

// RFC 4180 CSV with the delimiter guessed among , ; and tab
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const first = src.split(/\r?\n/, 1)[0] ?? '';
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0]![0];
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delim) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim() !== '')) rows.push(row); row = []; }
    else cell += c;
  }
  row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row);
  return rows;
}

export function rowsFromCsv(table: string[][], mapping: (Field | '')[]): Row[] {
  return table.slice(1).map(cells => {
    const r: Row = {};
    mapping.forEach((f, i) => {
      const v = (cells[i] ?? '').trim(); if (!f || !v) return;
      if (f === 'tags') r.tags = [...(r.tags ?? []), ...v.split(/[,;:]| ::: /).map(t => t.replace(/^\*\s*/, '').trim().toLowerCase()).filter(Boolean)];
      else if (f === 'note') r.note = r.note ? `${r.note}\n${v}` : v;
      else if (!r[f]) r[f] = v;
    });
    return r;
  });
}

// vCard 2.1 to 4.0: FN, N, EMAIL, TEL, ORG, TITLE, ADR, URL, NOTE, CATEGORIES
export function parseVcards(text: string): Row[] {
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').replace(/=\r?\n/g, '').split(/\r?\n/);
  const out: Row[] = []; let cur: Row | null = null;
  const val = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim();
  for (const line of lines) {
    const up = line.toUpperCase();
    if (up.startsWith('BEGIN:VCARD')) { cur = {}; continue; }
    if (up.startsWith('END:VCARD')) { if (cur) out.push(cur); cur = null; continue; }
    if (!cur) continue;
    const i = line.indexOf(':'); if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0]!.replace(/^item\d+\./i, '').toUpperCase(); const v = line.slice(i + 1);
    if (key === 'FN' && !cur.name) cur.name = val(v);
    else if (key === 'N') { const [last = '', first = ''] = v.split(';').map(val); if (first) cur.first_name = first; if (last) cur.last_name = last; }
    else if (key === 'EMAIL' && !cur.email) cur.email = val(v);
    else if (key === 'TEL' && !cur.phone) cur.phone = val(v).replace(/^tel:/i, '');
    else if (key === 'ORG' && !cur.company) cur.company = val(v.split(';')[0] ?? '');
    else if (key === 'TITLE' && !cur.role) cur.role = val(v);
    else if (key === 'ADR' && !cur.city) { const p = v.split(';').map(val); if (p[2]) cur.address_line = p[2]; if (p[3]) cur.city = p[3]; if (p[5]) cur.postal_code = p[5]; if (p[6]) cur.country = p[6]; }
    else if (key === 'URL') { const u = val(v); if (/linkedin\.com/i.test(u)) cur.linkedin = u; else if (!cur.website) cur.website = u; }
    else if (key === 'NOTE') cur.note = val(v);
    else if (key === 'CATEGORIES') cur.tags = val(v).split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }
  return out;
}

export const displayName = (r: Row) => r.name || [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || r.phone || '—';
export const isUsable = (r: Row) => !!(r.name || r.first_name || r.last_name || r.email || r.phone);
