

// Shared community helpers
export type CategoryKey =
  | 'onlineshop'
  | 'bank_finance'
  | 'social_media'
  | 'streaming'
  | 'gaming'
  | 'email_provider'
  | 'cloud_storage'
  | 'travel'
  | 'food_delivery'
  | 'marketplace'
  | 'news_media'
  | 'healthcare'
  | 'utilities'
  | 'other';

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  onlineshop: 'Onlineshops',
  bank_finance: 'Banken & Finanzen',
  social_media: 'Social Media',
  streaming: 'Streaming',
  gaming: 'Gaming',
  email_provider: 'E-Mail-Provider',
  cloud_storage: 'Cloud & Speicher',
  travel: 'Reisen',
  food_delivery: 'Lieferdienste',
  marketplace: 'Marktplätze',
  news_media: 'News & Medien',
  healthcare: 'Gesundheit',
  utilities: 'Tools & Sonstiges',
  other: 'Sonstiges',
};

const DOMAIN_CATEGORY_RULES: Array<{ test: RegExp; cat: CategoryKey }> = [
  { test: /(amazon|amazon\.[a-z]{2,}|amzn)/, cat: 'marketplace' },
  { test: /(ebay|kleinanzeigen|etsy|aliexpress|zalando|otto|shein|temu)/, cat: 'onlineshop' },
  { test: /(sparkasse|volksbank|n26|revolut|wise|comdirect|dkb|ing-diba|ing\.de|ing\.com|paypal)/, cat: 'bank_finance' },
  { test: /(facebook|fb\.com|instagram|tiktok|snapchat|twitter|x\.com|linkedin|pinterest|reddit|discord)/, cat: 'social_media' },
  { test: /(netflix|amazonvideo|primevideo|disney|hulu|paramount|wowtv|wow\.tv|sky|spotify|applemusic|music\.apple|youtube|youtubemusic)/, cat: 'streaming' },
  { test: /(steam|epicgames|playstation|xbox|nintendo|riotgames|blizzard|origin|ea\.com)/, cat: 'gaming' },
  { test: /(gmail|googlemail|outlook|hotmail|live\.com|gmx|web\.de|yahoo)/, cat: 'email_provider' },
  { test: /(dropbox|drive\.google|onedrive|icloud|box\.com|mega\.nz)/, cat: 'cloud_storage' },
  { test: /(booking|airbnb|expedia|skyscanner|ryanair|lufthansa|bahn|deutschebahn|flixbus|uber|bolt)/, cat: 'travel' },
  { test: /(lieferando|doordash|ubereats|wolt|deliveroo|gorillas|flink)/, cat: 'food_delivery' },
  { test: /(nytimes|washingtonpost|guardian|spiegel|zeit|welt|faz|bbc|cnn|tagesschau)/, cat: 'news_media' },
  { test: /(doctolib|teleclinic|ada\.com|myfitnesspal|fitbit|withings)/, cat: 'healthcare' },
  { test: /(github|gitlab|bitbucket|notion|slack|trello|asana|figma|canva)/, cat: 'utilities' },
];

export function categorizeDomain(domain: string): CategoryKey {
  const d = (domain || '').toLowerCase();
  for (const rule of DOMAIN_CATEGORY_RULES) {
    if (rule.test.test(d)) return rule.cat;
  }
  if (/(shop|store)/.test(d)) return 'onlineshop';
  return 'other';
}

export function getPostCategory(p: { domain: string; category?: CategoryKey }): CategoryKey {
  return (p.category as CategoryKey) ?? categorizeDomain(p.domain);
}

export function normalizeDomain(input: string) {
  if (!input) return '';
  let s = input.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '');
  const slash = s.indexOf('/');
  if (slash !== -1) s = s.slice(0, slash);
  s = s.split('?')[0].split('#')[0];
  s = s.replace(/^www\./, '');
  return s;
}