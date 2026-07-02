// ─── Theme ETF map ────────────────────────────────────────────────────────────
// Each theme has: name, ETF ticker, sector, and keywords to match FMP industry/sector.
// FMP's actual sector values (confirmed): Technology, Healthcare, Financial Services,
// Consumer Cyclical, Consumer Defensive, Industrials, Basic Materials, Energy,
// Utilities, Real Estate, Communication Services.
// NOTE: it's "Consumer Cyclical" / "Consumer Defensive" — NOT "Consumer Discretionary"
// / "Consumer Staples". Matching against the wrong strings silently drops stocks
// with no theme at all, so keyword/fallback checks below use the real FMP names.
// Used for: (1) assigning theme to each stock, (2) Themes tab ETF performance.

export const THEME_ETF_MAP = [
  // Healthcare
  { theme: 'Biotech',              etf: 'IBB',  sector: 'Healthcare',           keywords: ['biotechnology', 'biotech'] },
  { theme: 'Medical Devices',      etf: 'IHI',  sector: 'Healthcare',           keywords: ['medical devices', 'medical instruments', 'medical instruments & supplies', 'diagnostics', 'diagnostics & research'] },
  { theme: 'Pharmaceuticals',      etf: 'IHE',  sector: 'Healthcare',           keywords: ['pharmaceuticals', 'drug manufacturers', 'drug manufacturers - general', 'drug manufacturers - specialty & generic'] },
  { theme: 'Healthcare Providers', etf: 'IHF',  sector: 'Healthcare',           keywords: ['healthcare providers', 'managed health', 'hospitals', 'medical care facilities', 'health information services'] },

  // Real Estate
  { theme: 'Home Builders',        etf: 'XHB',  sector: 'Real Estate',          keywords: ['residential construction', 'home builders', 'homebuilding'] },
  { theme: 'REITs',                etf: 'VNQ',  sector: 'Real Estate',          keywords: ['reit', 'real estate investment', 'real estate services', 'real estate - development', 'real estate - diversified'] },

  // Consumer Defensive (FMP's actual name — was miscoded as "Consumer Staples")
  { theme: 'Food & Beverage',      etf: 'PBJ',  sector: 'Consumer Defensive',   keywords: ['food', 'beverage', 'packaged foods', 'grocery', 'grocery stores', 'confectioners', 'beverages - non-alcoholic', 'beverages - wineries & distilleries', 'beverages - brewers'] },
  { theme: 'Household & Personal', etf: 'XLP',  sector: 'Consumer Defensive',   keywords: ['household & personal products', 'personal products', 'tobacco', 'discount stores'] },
  { theme: 'Restaurants',          etf: 'EATZ', sector: 'Consumer Cyclical',    keywords: ['restaurant', 'fast food', 'food service'] },

  // Consumer Cyclical (FMP's actual name — was miscoded as "Consumer Discretionary")
  { theme: 'Leisure & Entertainment', etf: 'PEJ', sector: 'Consumer Cyclical', keywords: ['leisure', 'entertainment', 'gaming', 'casinos', 'resorts & casinos', 'hotels', 'lodging', 'travel', 'travel services', 'gambling'] },
  { theme: 'Retail',               etf: 'XRT',  sector: 'Consumer Cyclical',   keywords: ['retail', 'specialty retail', 'department stores', 'home improvement retail', 'apparel retail', 'footwear & accessories', 'luxury goods'] },
  { theme: 'Online Retail',        etf: 'ONLN', sector: 'Consumer Cyclical',   keywords: ['internet retail', 'e-commerce', 'online retail'] },
  { theme: 'Cannabis',             etf: 'MSOS', sector: 'Healthcare',          keywords: ['cannabis', 'marijuana', 'pharmaceutical retailers'] },
  { theme: 'Electric Vehicles',    etf: 'KARS', sector: 'Consumer Cyclical',   keywords: ['electric vehicle', 'auto manufacturers', 'automobile'] },
  { theme: 'Auto Parts & Retail',  etf: 'CARZ', sector: 'Consumer Cyclical',   keywords: ['auto parts', 'auto & truck dealerships', 'recreational vehicles'] },
  { theme: 'Apparel & Textiles',   etf: 'XLY',  sector: 'Consumer Cyclical',   keywords: ['apparel manufacturing', 'textile manufacturing', 'furnishings, fixtures & appliances', 'furnishings fixtures & appliances'] },
  { theme: 'Personal Services',    etf: 'XLY',  sector: 'Consumer Cyclical',   keywords: ['personal services', 'education & training services'] },

  // Technology
  { theme: 'Cloud Computing',      etf: 'SKYY', sector: 'Technology',           keywords: ['cloud', 'saas', 'software infrastructure', 'software - infrastructure', 'information technology services'] },
  { theme: 'Cryptocurrency',       etf: 'IBIT', sector: 'Financial Services',   keywords: ['cryptocurrency', 'crypto', 'blockchain', 'bitcoin'] },
  { theme: 'Cybersecurity',        etf: 'CIBR', sector: 'Technology',           keywords: ['cybersecurity', 'security software', 'network security'] },
  { theme: 'AI & Tech',            etf: 'ARTY', sector: 'Technology',           keywords: ['artificial intelligence', 'machine learning'] },
  { theme: 'Internet',             etf: 'FDN',  sector: 'Technology',           keywords: ['internet content', 'internet content & information', 'internet services'] },
  { theme: 'Nanotechnology',       etf: 'TINY', sector: 'Technology',           keywords: ['nanotechnology', 'nano'] },
  { theme: 'Semiconductors',       etf: 'SMH',  sector: 'Technology',           keywords: ['semiconductors', 'semiconductor', 'chips', 'integrated circuits', 'semiconductor equipment & materials'] },
  { theme: 'Fintech',              etf: 'ARKF', sector: 'Financial Services',   keywords: ['fintech', 'financial technology', 'payment processing', 'credit services'] },
  { theme: 'Social Media',         etf: 'SOCL', sector: 'Communication Services',keywords: ['social media', 'social network', 'social media platform'] },
  { theme: 'Software',             etf: 'IGV',  sector: 'Technology',           keywords: ['software', 'application software', 'software—application', 'software-application', 'software - application'] },
  { theme: 'Tech Hardware',        etf: 'XLK',  sector: 'Technology',           keywords: ['computer hardware', 'consumer electronics', 'communication equipment', 'electronic components', 'electronics & computer distribution', 'scientific & technical instruments'] },
  { theme: 'Robotics & Automation',etf: 'ROBO', sector: 'Industrials',          keywords: ['robotics', 'automation', 'industrial automation', 'scientific instruments'] },

  // Financials
  { theme: 'Banks',                etf: 'KBWB', sector: 'Financial Services',   keywords: ['banks', 'banking', 'money center banks', 'bank', 'banks - diversified'] },
  { theme: 'Regional Banks',       etf: 'KRE',  sector: 'Financial Services',   keywords: ['regional banks', 'banks - regional', 'savings institutions'] },
  { theme: 'Capital Markets',      etf: 'KCE',  sector: 'Financial Services',   keywords: ['capital markets', 'asset management', 'investment banking', 'financial data', 'financial data & stock exchanges', 'financial conglomerates'] },
  { theme: 'Insurance',            etf: 'KIE',  sector: 'Financial Services',   keywords: ['insurance', 'life insurance', 'property insurance', 'reinsurance', 'insurance brokers', 'insurance - specialty', 'insurance - diversified'] },
  { theme: 'Mortgage & Lending',   etf: 'REM',  sector: 'Financial Services',   keywords: ['mortgage finance', 'shell companies'] },

  // Industrials
  { theme: 'Aerospace & Defense',  etf: 'PPA',  sector: 'Industrials',          keywords: ['aerospace', 'defense', 'aerospace & defense'] },
  { theme: 'Airlines',             etf: 'JETS', sector: 'Industrials',          keywords: ['airlines', 'air freight', 'airline', 'airports & air services'] },
  { theme: 'Transportation',       etf: 'XTN',  sector: 'Industrials',          keywords: ['transportation', 'trucking', 'railroads', 'railroad', 'logistics', 'integrated freight & logistics'] },
  { theme: 'Shipping',             etf: 'SEA',  sector: 'Industrials',          keywords: ['shipping', 'marine', 'marine shipping', 'sea freight'] },
  { theme: 'Industrial Equipment', etf: 'XLI',  sector: 'Industrials',          keywords: ['electrical equipment', 'electrical products', 'electrical component', 'electrical equipment & parts', 'industrial machinery', 'industrial - machinery', 'machinery', 'farm & heavy construction', 'farm & heavy construction machinery', 'building products', 'building products & equipment', 'specialty industrial machinery', 'tools & accessories', 'conglomerates', 'metal fabrication', 'industrial distribution'] },
  { theme: 'Business Services',    etf: 'PSCI', sector: 'Industrials',          keywords: ['staffing', 'staffing & employment services', 'consulting services', 'security & protection', 'security & protection services', 'waste management', 'engineering & construction', 'infrastructure operations', 'rental & leasing services', 'business equipment & supplies', 'specialty business services'] },
  { theme: 'Water Resources',      etf: 'PHO',  sector: 'Utilities',            keywords: ['water', 'water utilities', 'water treatment', 'utilities - regulated water'] },

  // Materials
  { theme: 'Agriculture',          etf: 'MOO',  sector: 'Basic Materials',      keywords: ['agriculture', 'farm products', 'fertilizers', 'agricultural inputs', 'crop'] },
  { theme: 'Gold',                 etf: 'GLD',  sector: 'Basic Materials',      keywords: ['gold', 'precious metals'] },
  { theme: 'Gold Miners',          etf: 'GDX',  sector: 'Basic Materials',      keywords: ['gold miners', 'gold mining'] },
  { theme: 'Silver',               etf: 'SLV',  sector: 'Basic Materials',      keywords: ['silver', 'silver miners'] },
  { theme: 'Copper Miners',        etf: 'COPX', sector: 'Basic Materials',      keywords: ['copper', 'copper mining'] },
  { theme: 'Uranium',              etf: 'URA',  sector: 'Basic Materials',      keywords: ['uranium', 'nuclear', 'nuclear energy'] },
  { theme: 'Steel',                etf: 'SLX',  sector: 'Basic Materials',      keywords: ['steel', 'iron', 'coking coal', 'aluminum'] },
  { theme: 'Metals & Mining',      etf: 'XME',  sector: 'Basic Materials',      keywords: ['mining', 'diversified metals', 'other metals', 'other industrial metals & mining', 'thermal coal'] },
  { theme: 'Battery & Lithium',    etf: 'LIT',  sector: 'Basic Materials',      keywords: ['lithium', 'battery', 'energy storage'] },
  { theme: 'Natural Resources',    etf: 'HAP',  sector: 'Basic Materials',      keywords: ['natural resources', 'diversified commodities'] },
  { theme: 'Chemicals',            etf: 'XLB',  sector: 'Basic Materials',      keywords: ['chemicals', 'specialty chemicals', 'building materials', 'packaging & containers', 'paper & paper products', 'lumber & wood production'] },

  // Energy
  { theme: 'Clean Energy',         etf: 'PBW',  sector: 'Energy',               keywords: ['clean energy', 'renewable energy', 'green energy'] },
  { theme: 'Oil',                  etf: 'USO',  sector: 'Energy',               keywords: ['oil', 'crude oil', 'oil & gas integrated', 'oil & gas e&p', 'oil & gas drilling', 'oil & gas refining & marketing', 'oil & gas equipment & services'] },
  { theme: 'Natural Gas',          etf: 'FCG',  sector: 'Energy',               keywords: ['natural gas', 'gas utilities', 'utilities - regulated gas'] },
  { theme: 'Solar',                etf: 'TAN',  sector: 'Energy',               keywords: ['solar', 'solar energy'] },
  { theme: 'Wind',                 etf: 'FAN',  sector: 'Energy',               keywords: ['wind energy', 'wind power'] },
  { theme: 'MLP',                  etf: 'AMLP', sector: 'Energy',               keywords: ['mlp', 'oil & gas midstream', 'pipeline'] },

  // Utilities
  { theme: 'Utilities',            etf: 'XLU',  sector: 'Utilities',            keywords: ['utilities - regulated electric', 'utilities - diversified', 'utilities - independent power producers', 'utilities - renewable', 'electric utilities', 'multi-utilities'] },
  { theme: 'Infrastructure',       etf: 'IYT',  sector: 'Utilities',            keywords: ['infrastructure'] },

  // Communication
  { theme: 'Communication Services',etf: 'XLC', sector: 'Communication Services',keywords: ['communication', 'telecom', 'telecom services', 'wireless', 'media', 'broadcasting', 'advertising agencies', 'publishing', 'entertainment', 'electronic gaming & multimedia'] },
];

// ─── Assign theme to a stock based on FMP sector + industry ──────────────────
export function assignTheme(sector: string | null, industry: string | null): string | null {
  if (!sector && !industry) return null;

  const s = (sector   || '').toLowerCase();
  const i = (industry || '').toLowerCase();
  const combined = `${s} ${i}`;

  // Match against ALL themes, then pick the most SPECIFIC match (longest
  // keyword) rather than the first theme in array order. First-match-wins
  // let broader/earlier themes (e.g. "Gold") silently swallow every stock
  // that should've gone to a more specific, later-listed theme (e.g. "Gold
  // Miners"), leaving that theme permanently empty regardless of real data.
  let best: { theme: string; kwLen: number } | null = null;
  for (const t of THEME_ETF_MAP) {
    for (const kw of t.keywords) {
      const kwLower = kw.toLowerCase();
      if (combined.includes(kwLower) && (!best || kwLower.length > best.kwLen)) {
        best = { theme: t.theme, kwLen: kwLower.length };
      }
    }
  }
  if (best) return best.theme;

  // Fallback: broad sector match, using FMP's REAL sector strings.
  // Each fallback now points to a genuinely generic/representative theme for
  // that sector rather than an unrelated specific one (e.g. Industrials no
  // longer defaults to "Transportation" for non-transport industrial stocks).
  if (s.includes('technology'))         return 'Tech Hardware';
  if (s.includes('healthcare'))         return 'Healthcare Providers';
  if (s.includes('financial'))          return 'Capital Markets';
  if (s.includes('energy'))             return 'Oil';
  if (s.includes('basic materials'))    return 'Metals & Mining';
  if (s.includes('industrials'))        return 'Industrial Equipment';
  if (s.includes('consumer cyclical'))  return 'Retail';
  if (s.includes('consumer defensive')) return 'Food & Beverage';
  if (s.includes('real estate'))        return 'REITs';
  if (s.includes('utilities'))          return 'Utilities';
  if (s.includes('communication'))      return 'Communication Services';
  if (s.includes('conglomerates'))      return 'Industrial Equipment';

  return null;
}
