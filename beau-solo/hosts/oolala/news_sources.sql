-- Oolala — starting news sources, France and UAE. Darya edits them in
-- Réglages → Actualités (add, pause, change). Re-runnable. No percent sign:
-- spaces are written as "+" and accents left out of the searches.
insert into beau_solo.news_sources (region, name, url) values
  ('fr', 'Service-Public.fr · Professionnels', 'https://www.service-public.fr/abonnements/rss/actu-actu-pro.rss'),
  ('fr', 'Google Actualités · Création d’entreprise', 'https://news.google.com/rss/search?q=creation+entreprise+OR+URSSAF+OR+micro-entrepreneur+when:7d&hl=fr&gl=FR&ceid=FR:fr'),
  ('fr', 'Google Actualités · Fiscalité des entreprises', 'https://news.google.com/rss/search?q=impots+entreprises+OR+TVA+OR+facturation+electronique+when:7d&hl=fr&gl=FR&ceid=FR:fr'),
  ('fr', 'Google Actualités · Expatriation Émirats et Géorgie', 'https://news.google.com/rss/search?q=expatriation+OR+expatries+Dubai+OR+Emirats+OR+Georgie+when:7d&hl=fr&gl=FR&ceid=FR:fr'),
  ('ae', 'Google News · UAE visas and residency', 'https://news.google.com/rss/search?q=UAE+golden+visa+OR+residency+OR+ICP+OR+GDRFA+when:7d&hl=en-AE&gl=AE&ceid=AE:en'),
  ('ae', 'Google News · UAE companies and tax', 'https://news.google.com/rss/search?q=UAE+free+zone+OR+corporate+tax+OR+business+licence+OR+RAKEZ+OR+DMCC+when:7d&hl=en-AE&gl=AE&ceid=AE:en'),
  ('ae', 'Google News · Dubai real estate', 'https://news.google.com/rss/search?q=Dubai+real+estate+OR+DLD+OR+RERA+OR+off-plan+when:7d&hl=en-AE&gl=AE&ceid=AE:en'),
  ('ae', 'Google News · UAE banking and labour', 'https://news.google.com/rss/search?q=UAE+bank+account+OR+Central+Bank+UAE+OR+MoHRE+OR+work+permit+when:7d&hl=en-AE&gl=AE&ceid=AE:en')
on conflict (url) do nothing;
