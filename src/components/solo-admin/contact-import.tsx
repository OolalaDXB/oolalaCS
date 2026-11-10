import { useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminRpc, errorLabel } from '@/lib/solo-admin';
import { displayName, FIELD_LABEL, guessField, isUsable, parseCsv, parseVcards, rowsFromCsv, type Field, type Row } from '@/lib/contact-import';

type Result = { created: number; merged: number; skipped: number; to_review: number };

// Import a contact list: a CSV (columns matched to the card's fields, which
// Darya can correct) or a vCard file. Rows matching a card by email or phone
// complete it; nothing on an existing card is overwritten.
export function ContactImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState('');
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<(Field | '')[]>([]);
  const [vcards, setVcards] = useState<Row[] | null>(null);
  const [source, setSource] = useState('Import');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  async function read(f: File) {
    setError(''); setResult(null); setFile(f.name);
    if (f.size > 5_000_000) { setError('Fichier trop lourd (5 Mo au plus).'); return; }
    const text = await f.text();
    if (/BEGIN:VCARD/i.test(text)) { setTable(null); setVcards(parseVcards(text)); setSource('Import carnet d’adresses'); return; }
    const t = parseCsv(text);
    if (t.length < 2) { setError('Le fichier ne contient pas de lignes à importer.'); return; }
    setVcards(null); setTable(t); setMapping((t[0] ?? []).map(guessField)); setSource(`Import ${f.name.replace(/\.[^.]+$/, '')}`.slice(0, 60));
  }
  const rows = useMemo(() => (vcards ?? (table ? rowsFromCsv(table, mapping) : [])).filter(isUsable), [vcards, table, mapping]);
  const mapped = mapping.filter(Boolean);
  const canName = vcards !== null || mapped.some(f => f === 'name' || f === 'first_name' || f === 'last_name' || f === 'email' || f === 'phone');

  async function run() {
    setBusy(true); setError('');
    try {
      let total: Result = { created: 0, merged: 0, skipped: 0, to_review: 0 };
      for (let i = 0; i < rows.length; i += 500) {
        const r = await adminRpc<Result>('solo_admin_contacts_import', { p_rows: rows.slice(i, i + 500), p_source: source });
        total = { created: total.created + r.created, merged: total.merged + r.merged, skipped: total.skipped + r.skipped, to_review: total.to_review + r.to_review };
      }
      setResult(total); onDone();
    } catch (e) { setError(errorLabel((e as Error).message)); }
    finally { setBusy(false); }
  }

  return <div className="admin-overlay" role="dialog" aria-modal="true" aria-labelledby="import-title" onClick={e => e.target === e.currentTarget && onClose()}>
    <div className="admin-sheet contact-form import-sheet">
      <div className="admin-sheet-head"><h2 id="import-title">Importer des contacts</h2><Button type="button" variant="ghost" size="icon" aria-label="Fermer" onClick={onClose}><X /></Button></div>
      {result ? <>
        <p className="page-lead">{result.created} contact{result.created > 1 ? 's' : ''} créé{result.created > 1 ? 's' : ''}, {result.merged} fiche{result.merged > 1 ? 's' : ''} complétée{result.merged > 1 ? 's' : ''}{result.skipped ? `, ${result.skipped} ligne${result.skipped > 1 ? 's' : ''} vide${result.skipped > 1 ? 's' : ''} ignorée${result.skipped > 1 ? 's' : ''}` : ''}.</p>
        {result.to_review > 0 && <p className="booking-muted">{result.to_review} fiche{result.to_review > 1 ? 's' : ''} marquée{result.to_review > 1 ? 's' : ''} « à vérifier » : plusieurs contacts existants partagent cet email ou ce téléphone.</p>}
        <div className="form-actions"><Button type="button" onClick={onClose}>Terminé</Button></div>
      </> : <>
        <label className="import-drop">
          <Upload aria-hidden="true" /><strong>{file || 'Choisir un fichier'}</strong>
          <span>CSV (Google Contacts, Outlook, Excel, LinkedIn…) ou vCard .vcf (iPhone, Android, Mac)</span>
          <input type="file" accept=".csv,.txt,.vcf,text/csv,text/vcard,text/x-vcard" onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); }} />
        </label>
        <p className="booking-muted">Un contact déjà présent (même email, ou même téléphone) est complété, jamais écrasé. Le fichier est lu sur cet appareil ; seules les lignes importées sont envoyées.</p>

        {table && <section className="import-map"><h3>Colonnes</h3>
          <div className="import-cols">{(table[0] ?? []).map((h, i) => <div key={i} className="field"><label htmlFor={`map-${i}`}>{h || `Colonne ${i + 1}`}<small>{table[1]?.[i] ?? ''}</small></label>
            <select id={`map-${i}`} value={mapping[i] ?? ''} onChange={e => setMapping(m => m.map((x, k) => k === i ? e.target.value as Field | '' : x))}>
              <option value="">— ignorer —</option>{(Object.keys(FIELD_LABEL) as Field[]).map(f => <option key={f} value={f}>{FIELD_LABEL[f]}</option>)}</select></div>)}</div>
        </section>}

        {(table || vcards) && <>
          <h3>Aperçu · {rows.length} contact{rows.length > 1 ? 's' : ''}</h3>
          {rows.length === 0 ? <p className="booking-muted">Aucune ligne avec un nom, un email ou un téléphone{table ? ' : vérifiez les colonnes.' : '.'}</p>
            : <div className="import-preview"><table><thead><tr><th>Nom</th><th>Email</th><th>Téléphone</th><th>Société</th><th>Ville / pays</th></tr></thead>
              <tbody>{rows.slice(0, 8).map((r, i) => <tr key={i}><td>{displayName(r)}</td><td>{r.email ?? ''}</td><td>{r.phone ?? ''}</td><td>{r.company ?? ''}</td><td>{[r.city, r.country].filter(Boolean).join(', ')}</td></tr>)}</tbody></table>
              {rows.length > 8 && <p className="booking-muted">… et {rows.length - 8} autre{rows.length - 8 > 1 ? 's' : ''}.</p>}</div>}
          <div className="field"><label htmlFor="imp-source">Source enregistrée sur les nouvelles fiches</label><input id="imp-source" value={source} onChange={e => setSource(e.target.value)} maxLength={60} /></div>
        </>}
        {error && <p role="alert" className="booking-error">{error}</p>}
        <div className="form-actions"><Button type="button" disabled={busy || rows.length === 0 || !canName} onClick={run}>{busy ? 'Import…' : rows.length ? `Importer ${rows.length} contact${rows.length > 1 ? 's' : ''}` : 'Importer'}</Button><Button type="button" variant="ghost" onClick={onClose}>Annuler</Button></div>
      </>}
    </div>
  </div>;
}
