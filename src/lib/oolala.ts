export type CountryKey = 'emirats' | 'georgie' | 'france';
export const countryKeys: CountryKey[] = ['emirats', 'georgie', 'france'];
export const countryPaths = { emirats: '/{-$lang}/emirats', georgie: '/{-$lang}/georgie', france: '/{-$lang}/france' } as const;
export const whatsappUrl = 'https://wa.me/971506838777';
export type Testimonial = { quote: string; name: string; context: string; country: CountryKey };
// Published only once real, consented client quotes are added; the section stays hidden while empty.
export const testimonials: Testimonial[] = [];
/** URL hash of each country-page tab, in pillar order (company, settling in, investment). */
export const pillarSlugs = ['societe', 'installation', 'investissement'] as const;
