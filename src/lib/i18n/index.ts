import { useParams } from '@tanstack/react-router';
import { fr, type Dict } from './fr';
import { en } from './en';
import { ru } from './ru';

export type Lang = 'fr' | 'en' | 'ru';
export type PageKey = keyof Dict['meta'];
export const langs: Lang[] = ['fr', 'en', 'ru'];
export const langLabels: Record<Lang, string> = { fr: 'FR', en: 'EN', ru: 'RU' };
export const dictionaries: Record<Lang, Dict> = { fr, en, ru };

export function toLang(value?: string): Lang { return value === 'en' || value === 'ru' ? value : 'fr'; }
export function isLangParam(value?: string) { return value === undefined || value === 'en' || value === 'ru'; }
/** Route param value: French lives at the unprefixed URLs. */
export function langParam(lang: Lang) { return lang === 'fr' ? undefined : lang; }
export function localizedPath(lang: Lang, path: string) { return lang === 'fr' ? path : `/${lang}${path === '/' ? '' : path}`; }

export function useLang(): Lang { const params = useParams({ strict: false }) as { lang?: string }; return toLang(params.lang); }
export function useT() { const lang = useLang(); return { lang, t: dictionaries[lang], lp: { lang: langParam(lang) } }; }

export function localeHead(langValue: string | undefined, page: PageKey, path: string) {
  const lang = toLang(langValue);
  const [title, description] = dictionaries[lang].meta[page];
  const full = `${title} | Oolala Corporate Services`;
  const url = localizedPath(lang, path);
  return {
    meta: [{ title: full }, { name: 'description', content: description }, { property: 'og:title', content: full }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { property: 'og:url', content: url }, { property: 'og:locale', content: { fr: 'fr_FR', en: 'en_GB', ru: 'ru_RU' }[lang] }, { name: 'twitter:card', content: 'summary_large_image' }],
    links: [{ rel: 'canonical', href: url }, ...langs.map(l => ({ rel: 'alternate', hrefLang: l, href: localizedPath(l, path) })), { rel: 'alternate', hrefLang: 'x-default', href: path }],
  };
}
