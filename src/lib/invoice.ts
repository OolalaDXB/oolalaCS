// The invoice as both the back office and the client's page receive it
// (beau_solo.invoice_doc), with its labels in French, English and Russian.
export type Party = {
  trade_name?: string | null; legal_name?: string | null; address?: string | null; licence?: string | null; trn?: string | null; vat_rate?: number | null;
  vat_note?: string | null; email?: string | null; phone?: string | null; website?: string | null; bank_name?: string | null; account_name?: string | null;
  iban?: string | null; swift?: string | null; bank_note?: string | null; payment_terms?: string | null; legal_mentions?: string | null;
  invoice_prefix?: string; default_currency?: string; due_days?: number;
};
export type Client = { name?: string; company?: string; email?: string; phone?: string; address?: string; trn?: string };
export type DocLine = { label: string; quantity: number; unit_amount: number; vat_rate: number; net: number; vat: number; total: number };
export type InvoiceState = 'draft' | 'unpaid' | 'partial' | 'overdue' | 'paid' | 'cancelled';
export type Lang = 'fr' | 'en' | 'ru';
export type InvoiceDoc = {
  id?: string; number: string | null; status: 'draft' | 'issued' | 'cancelled'; state: InvoiceState; lang: Lang; currency: string;
  issue_date: string | null; due_date: string | null; issuer: Party; client: Client; lines: DocLine[]; subtotal: number; vat_total: number; total: number;
  vat_breakdown: { rate: number; net: number; vat: number }[]; paid: number; balance: number; notes: string | null;
  payments: { amount: number; method: string; paid_at: string }[]; pay_card: boolean; cancelled_at: string | null; card?: boolean;
};

const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB', ru: 'ru-RU' };
export const money = (minor: number, currency: string, lang: Lang = 'fr') =>
  new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
export const day = (iso: string | null, lang: Lang = 'fr') => (iso ? new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T12:00:00Z`)) : '');
export const CURRENCIES = ['USD', 'AED', 'EUR', 'GBP', 'GEL'];

export const T = {
  fr: { invoice: 'Facture', taxInvoice: 'Facture fiscale', draft: 'Brouillon', number: 'N°', issued: 'Date', due: 'Échéance', to: 'Facturé à',
    item: 'Désignation', qty: 'Qté', unit: 'Prix unitaire HT', vat: 'TVA', amount: 'Montant HT', subtotal: 'Total HT', vatTotal: 'TVA', total: 'Total TTC', totalNoVat: 'Total',
    paid: 'Déjà réglé', balance: 'Reste à payer', trn: 'N° TVA (TRN)', licence: 'Licence', bank: 'Virement bancaire', iban: 'IBAN', swift: 'SWIFT / BIC',
    accountName: 'Titulaire', bankName: 'Banque', reference: 'Référence à indiquer', notes: 'Notes',
    stamp: { paid: 'Payée', partial: 'Partiellement payée', overdue: 'En retard', unpaid: 'À payer', draft: 'Brouillon', cancelled: 'Annulée' } },
  en: { invoice: 'Invoice', taxInvoice: 'Tax invoice', draft: 'Draft', number: 'No.', issued: 'Date', due: 'Due date', to: 'Billed to',
    item: 'Description', qty: 'Qty', unit: 'Unit price excl. VAT', vat: 'VAT', amount: 'Amount excl. VAT', subtotal: 'Subtotal', vatTotal: 'VAT', total: 'Total incl. VAT', totalNoVat: 'Total',
    paid: 'Already paid', balance: 'Balance due', trn: 'TRN', licence: 'Licence', bank: 'Bank transfer', iban: 'IBAN', swift: 'SWIFT / BIC',
    accountName: 'Account name', bankName: 'Bank', reference: 'Payment reference', notes: 'Notes',
    stamp: { paid: 'Paid', partial: 'Partly paid', overdue: 'Overdue', unpaid: 'Due', draft: 'Draft', cancelled: 'Cancelled' } },
  ru: { invoice: 'Счёт', taxInvoice: 'Налоговый счёт', draft: 'Черновик', number: '№', issued: 'Дата', due: 'Срок оплаты', to: 'Плательщик',
    item: 'Описание', qty: 'Кол-во', unit: 'Цена без НДС', vat: 'НДС', amount: 'Сумма без НДС', subtotal: 'Итого без НДС', vatTotal: 'НДС', total: 'Итого с НДС', totalNoVat: 'Итого',
    paid: 'Уже оплачено', balance: 'К оплате', trn: 'TRN (НДС)', licence: 'Лицензия', bank: 'Банковский перевод', iban: 'IBAN', swift: 'SWIFT / BIC',
    accountName: 'Получатель', bankName: 'Банк', reference: 'Назначение платежа', notes: 'Примечания',
    stamp: { paid: 'Оплачен', partial: 'Оплачен частично', overdue: 'Просрочен', unpaid: 'К оплате', draft: 'Черновик', cancelled: 'Отменён' } },
} satisfies Record<Lang, unknown>;

export const stateLabel: Record<InvoiceState, string> = { draft: 'Brouillon', unpaid: 'À payer', partial: 'Partiel', overdue: 'En retard', paid: 'Payée', cancelled: 'Annulée' };
export const methodLabel: Record<string, string> = { bank_transfer: 'Virement', card: 'Carte', cash: 'Espèces', other: 'Autre' };
// "1 234,50", "1234.5" or "2500" typed by Darya → minor units
export function toMinor(v: string): number | null {
  const s = v.replace(/\s| | /g, '').replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
export const fromMinor = (n: number) => (n / 100).toFixed(2).replace(/\.00$/, '');
