<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep TanStack Start file-based routes with a shared root header/footer and separate content leaves; this preserves the platform runtime and independently shareable pages.
- Define all visual roles and layouts in the global semantic design system; this keeps Oolala consistent across every page.
- Keep editorial motion CSS-only, progressively enhanced with scroll timelines and reduced-motion overrides; content remains visible in unsupported browsers and hydration stays stable.
- Use an explicitly labeled WhatsApp handoff for initial contact until a hosted lead inbox is configured; this avoids claiming that an unconnected form saved or sent a lead.
- Store supplied and downloaded media through asset pointers, keeping country service content in a shared browser-safe module; this avoids duplicated assets and divergent country offerings.
- All pages live under the optional {-$lang} route segment (French unprefixed, /en and /ru prefixed) with copy in src/lib/i18n dictionaries typed from French; this keeps each language indexable and translations in sync.
