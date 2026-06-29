// ─── Theme ETF map ────────────────────────────────────────────────────────────
// Each theme has: name, ETF ticker, sector, and keywords to match FMP industry/sector
// Used for: (1) assigning theme to each stock, (2) Themes tab ETF performance

export const THEME_ETF_MAP = [
  // Healthcare
  { theme: 'Biotech',              etf: 'IBB',  sector: 'Healthcare',           keywords: ['biotechnology', 'biotech'] },
  { theme: 'Medical Devices',      etf: 'IHI',  sector: 'Healthcare',           keywords: ['medical devices', 'medical instruments', 'diagnostics'] },
  { theme: 'Pharmaceuticals',      etf: 'IHE',  sector: 'Healthcare',           keywords: ['pharmaceuticals', 'drug manufacturers'] },
  { theme: 'Healthcare Providers', etf: 'IHF',  sector: 'Healthcare',           keywords: ['healthcare providers', 'managed health', 'hospitals'] },

  // Real Estate
  { theme: 'Home Builders',        etf: 'XHB',  sector: 'Real Estate',          keywords: ['residential construction', 'home builders', 'homebuilding'] },
  { theme: 'REITs',                etf: 'VNQ',  sector: 'Real Estate',          keywords: ['reit', 'real estate investment', 'real estate services'] },

  // Consumer Staples
  { theme: 'Food & Beverage',      etf: 'PBJ',  sector: 'Consumer Staples',     keywords: ['food', 'beverage', 'packaged foods', 'grocery'] },
  { theme: 'Restaurants',          etf: 'EATZ', sector: 'Consumer Discretionary',keywords: ['restaurant', 'fast food', 'food service'] },

  // Consumer Discretionary
  { theme: 'Leisure & Entertainment', etf: 'PEJ', sector: 'Consumer Discretionary', keywords: ['leisure', 'entertainment', 'gaming', 'casinos', 'hotels', 'travel'] },
  { theme: 'Retail',               etf: 'XRT',  sector: 'Consumer Discretionary',keywords: ['retail', 'specialty retail', 'department stores'] },
  { theme: 'Online Retail',        etf: 'ONLN', sector: 'Consumer Discretionary',keywords: ['internet retail', 'e-commerce', 'online retail'] },
  { theme: 'Cannabis',             etf: 'MSOS', sector: 'Healthcare',           keywords: ['cannabis', 'marijuana', 'pharmaceutical retailers'] },
  { theme: 'Electric Vehicles',    etf: 'KARS', sector: 'Consumer Discretionary',keywords: ['electric vehicle', 'auto manufacturers', 'automobile'] },

  // Technology
  { theme: 'Cloud Computing',      etf: 'SKYY', sector: 'Technology',           keywords: ['cloud', 'saas', 'software infrastructure', 'information technology services'] },
  { theme: 'Cryptocurrency',       etf: 'IBIT', sector: 'Financial Services',   keywords: ['cryptocurrency', 'crypto', 'blockchain', 'bitcoin'] },
  { theme: 'Cybersecurity',        etf: 'CIBR', sector: 'Technology',           keywords: ['cybersecurity', 'security software', 'network security'] },
  { theme: 'AI & Tech',            etf: 'ARTY', sector: 'Technology',           keywords: ['artificial intelligence', 'machine learning', 'ai'] },
  { theme: 'Internet',             etf: 'FDN',  sector: 'Technology',           keywords: ['internet content', 'internet services', 'social media platform'] },
  { theme: 'Nanotechnology',       etf: 'TINY', sector: 'Technology',           keywords: ['nanotechnology', 'nano'] },
  { theme: 'Semiconductors',       etf: 'SMH',  sector: 'Technology',           keywords: ['semiconductors', 'semiconductor', 'chips', 'integrated circuits'] },
  { theme: 'Fintech',              etf: 'ARKF', sector: 'Financial Services',   keywords: ['fintech', 'financial technology', 'payment processing', 'credit services'] },
  { theme: 'Social Media',         etf: 'SOCL', sector: 'Communication Services',keywords: ['social media', 'social network', 'internet content & information'] },
  { theme: 'Software',             etf: 'IGV',  sector: 'Technology',           keywords: ['software', 'application software', 'software—application', 'software-application'] },
  { theme: 'Robotics & Automation',etf: 'ROBO', sector: 'Industrials',          keywords: ['robotics', 'automation', 'industrial automation', 'scientific instruments'] },

  // Financials
  { theme: 'Banks',                etf: 'KBWB', sector: 'Financial Services',   keywords: ['banks', 'banking', 'money center banks', 'bank'] },
  { theme: 'Regional Banks',       etf: 'KRE',  sector: 'Financial Services',   keywords: ['regional banks', 'savings institutions'] },
  { theme: 'Capital Markets',      etf: 'KCE',  sector: 'Financial Services',   keywords: ['capital markets', 'asset management', 'investment banking', 'financial data'] },
  { theme: 'Insurance',            etf: 'KIE',  sector: 'Financial Services',   keywords: ['insurance', 'life insurance', 'property insurance', 'reinsurance'] },

  // Industrials
  { theme: 'Aerospace & Defense',  etf: 'PPA',  sector: 'Industrials',          keywords: ['aerospace', 'defense', 'aerospace & defense'] },
  { theme: 'Airlines',             etf: 'JETS', sector: 'Industrials',          keywords: ['airlines', 'air freight', 'airline'] },
  { theme: 'Transportation',       etf: 'XTN',  sector: 'Industrials',          keywords: ['transportation', 'trucking', 'railroads', 'logistics'] },
  { theme: 'Shipping',             etf: 'SEA',  sector: 'Industrials',          keywords: ['shipping', 'marine', 'sea freight'] },
  { theme: 'Water Resources',      etf: 'PHO',  sector: 'Utilities',            keywords: ['water', 'water utilities', 'water treatment'] },

  // Materials
  { theme: 'Agriculture',          etf: 'MOO',  sector: 'Basic Materials',      keywords: ['agriculture', 'farm products', 'fertilizers', 'crop'] },
  { theme: 'Gold',                 etf: 'GLD',  sector: 'Basic Materials',      keywords: ['gold', 'precious metals'] },
  { theme: 'Gold Miners',          etf: 'GDX',  sector: 'Basic Materials',      keywords: ['gold miners', 'gold mining'] },
  { theme: 'Silver',               etf: 'SLV',  sector: 'Basic Materials',      keywords: ['silver', 'silver miners'] },
  { theme: 'Copper Miners',        etf: 'COPX', sector: 'Basic Materials',      keywords: ['copper', 'copper mining'] },
  { theme: 'Uranium',              etf: 'URA',  sector: 'Basic Materials',      keywords: ['uranium', 'nuclear', 'nuclear energy'] },
  { theme: 'Steel',                etf: 'SLX',  sector: 'Basic Materials',      keywords: ['steel', 'iron', 'metals'] },
  { theme: 'Metals & Mining',      etf: 'XME',  sector: 'Basic Materials',      keywords: ['mining', 'diversified metals', 'other metals'] },
  { theme: 'Battery & Lithium',    etf: 'LIT',  sector: 'Basic Materials',      keywords: ['lithium', 'battery', 'energy storage'] },
  { theme: 'Natural Resources',    etf: 'HAP',  sector: 'Basic Materials',      keywords: ['natural resources', 'diversified commodities'] },

  // Energy
  { theme: 'Clean Energy',         etf: 'PBW',  sector: 'Energy',               keywords: ['clean energy', 'renewable energy', 'green energy'] },
  { theme: 'Oil',                  etf: 'USO',  sector: 'Energy',               keywords: ['oil', 'crude oil', 'oil & gas integrated', 'oil & gas e&p', 'oil & gas midstream'] },
  { theme: 'Natural Gas',          etf: 'FCG',  sector: 'Energy',               keywords: ['natural gas', 'gas utilities'] },
  { theme: 'Solar',                etf: 'TAN',  sector: 'Energy',               keywords: ['solar', 'solar energy'] },
  { theme: 'Wind',                 etf: 'FAN',  sector: 'Energy',               keywords: ['wind energy', 'wind power'] },
  { theme: 'MLP',                  etf: 'AMLP', sector: 'Energy',               keywords: ['mlp', 'oil & gas midstream', 'pipeline'] },

  // Utilities
  { theme: 'Infrastructure',       etf: 'IYT',  sector: 'Utilities',            keywords: ['infrastructure', 'utilities', 'electric utilities', 'multi-utilities'] },

  // Communication
  { theme: 'Communication Services',etf: 'XLC', sector: 'Communication Services',keywords: ['communication', 'telecom', 'wireless', 'media'] },
];

// ─── Assign theme to a stock based on FMP sector + industry ──────────────────
export function assignTheme(sector: string | null, industry: string | null): string | null {
  if (!sector && !industry) return null;

  const s = (sector   || '').toLowerCase();
  const i = (industry || '').toLowerCase();
  const combined = `${s} ${i}`;

  // Try industry match first (more specific), then sector
  for (const t of THEME_ETF_MAP) {
    for (const kw of t.keywords) {
      if (combined.includes(kw.toLowerCase())) return t.theme;
    }
  }

  // Fallback: broad sector match
  if (s.includes('technology'))              return 'Software';
  if (s.includes('healthcare'))              return 'Pharmaceuticals';
  if (s.includes('financial'))               return 'Capital Markets';
  if (s.includes('energy'))                  return 'Oil';
  if (s.includes('basic materials'))         return 'Metals & Mining';
  if (s.includes('industrials'))             return 'Transportation';
  if (s.includes('consumer discretionary'))  return 'Retail';
  if (s.includes('consumer staples'))        return 'Food & Beverage';
  if (s.includes('real estate'))             return 'REITs';
  if (s.includes('utilities'))               return 'Infrastructure';
  if (s.includes('communication'))           return 'Communication Services';

  return null;
}
