/**
 * Comprehensive list of major global banks organized by region.
 *
 * This dataset is used by the leak detection engine to identify
 * mentions of banking institutions in scraped dark-web content.
 *
 * Each entry includes:
 *   - name: The full official name of the bank
 *   - aliases: Common abbreviations, ticker symbols, or colloquial names
 *   - region: Geographic region for grouping and reporting
 *
 * When matching, both the full name and all aliases are checked
 * against the content (case-insensitive).
 */

export interface BankEntry {
  name: string;
  aliases: string[];
  region: BankRegion;
}

export type BankRegion =
  | "NORTH_AMERICA"
  | "EUROPE"
  | "ASIA_PACIFIC"
  | "MIDDLE_EAST"
  | "LATIN_AMERICA"
  | "AFRICA"
  | "GLOBAL";

// ─── North America ─────────────────────────────────────

const NORTH_AMERICA_BANKS: BankEntry[] = [
  {
    name: "JPMorgan Chase",
    aliases: ["JPMorgan", "Chase", "JP Morgan", "JPMC", "Chase Bank"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Bank of America",
    aliases: ["BofA", "BoA", "BankOfAmerica"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Wells Fargo",
    aliases: ["WellsFargo", "WFC"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Citigroup",
    aliases: ["Citi", "Citibank", "CitiGroup"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Goldman Sachs",
    aliases: ["GoldmanSachs", "Goldman", "GS"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Morgan Stanley",
    aliases: ["MorganStanley", "MS"],
    region: "NORTH_AMERICA",
  },
  {
    name: "US Bancorp",
    aliases: ["US Bank", "USBank", "USB"],
    region: "NORTH_AMERICA",
  },
  {
    name: "PNC Financial Services",
    aliases: ["PNC", "PNC Bank"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Truist Financial",
    aliases: ["Truist", "Truist Bank"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Charles Schwab",
    aliases: ["Schwab", "CharlesSchwab"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Capital One",
    aliases: ["CapitalOne", "Cap One"],
    region: "NORTH_AMERICA",
  },
  {
    name: "TD Bank",
    aliases: ["TD", "Toronto-Dominion"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Bank of New York Mellon",
    aliases: ["BNY Mellon", "BNY", "BNYM"],
    region: "NORTH_AMERICA",
  },
  {
    name: "State Street Corporation",
    aliases: ["State Street", "STT"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Fifth Third Bank",
    aliases: ["Fifth Third", "5/3 Bank"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Citizens Financial Group",
    aliases: ["Citizens Bank", "Citizens Financial"],
    region: "NORTH_AMERICA",
  },
  {
    name: "KeyBank",
    aliases: ["KeyCorp", "Key Bank"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Regions Financial",
    aliases: ["Regions Bank", "Regions"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Ally Financial",
    aliases: ["Ally Bank", "Ally"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Discover Financial",
    aliases: ["Discover", "Discover Bank", "Discover Card"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Royal Bank of Canada",
    aliases: ["RBC", "Royal Bank"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Bank of Montreal",
    aliases: ["BMO", "BMO Harris"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Scotiabank",
    aliases: ["Bank of Nova Scotia", "Scotia"],
    region: "NORTH_AMERICA",
  },
  {
    name: "Canadian Imperial Bank of Commerce",
    aliases: ["CIBC"],
    region: "NORTH_AMERICA",
  },
];

// ─── Europe ────────────────────────────────────────────

const EUROPE_BANKS: BankEntry[] = [
  {
    name: "HSBC",
    aliases: [
      "HSBC Holdings",
      "Hong Kong Shanghai Banking Corporation",
      "HSBC Bank",
    ],
    region: "EUROPE",
  },
  {
    name: "Barclays",
    aliases: ["Barclays Bank", "Barclays PLC"],
    region: "EUROPE",
  },
  {
    name: "Lloyds Banking Group",
    aliases: ["Lloyds Bank", "Lloyds", "Lloyds TSB"],
    region: "EUROPE",
  },
  {
    name: "NatWest Group",
    aliases: [
      "NatWest",
      "National Westminster",
      "RBS",
      "Royal Bank of Scotland",
    ],
    region: "EUROPE",
  },
  {
    name: "Standard Chartered",
    aliases: ["StanChart", "Standard Chartered Bank"],
    region: "EUROPE",
  },
  {
    name: "Deutsche Bank",
    aliases: ["DeutscheBank", "DB"],
    region: "EUROPE",
  },
  {
    name: "Commerzbank",
    aliases: ["CBK"],
    region: "EUROPE",
  },
  {
    name: "BNP Paribas",
    aliases: ["BNP", "BNPP"],
    region: "EUROPE",
  },
  {
    name: "Société Générale",
    aliases: ["SocGen", "Societe Generale", "SG"],
    region: "EUROPE",
  },
  {
    name: "Crédit Agricole",
    aliases: ["Credit Agricole", "CA"],
    region: "EUROPE",
  },
  {
    name: "Groupe BPCE",
    aliases: ["BPCE", "Natixis"],
    region: "EUROPE",
  },
  {
    name: "UBS",
    aliases: ["UBS Group", "UBS AG", "Union Bank of Switzerland"],
    region: "EUROPE",
  },
  {
    name: "Credit Suisse",
    aliases: ["CreditSuisse", "CS"],
    region: "EUROPE",
  },
  {
    name: "ING Group",
    aliases: ["ING", "ING Bank"],
    region: "EUROPE",
  },
  {
    name: "Rabobank",
    aliases: ["Rabo"],
    region: "EUROPE",
  },
  {
    name: "ABN AMRO",
    aliases: ["ABN", "ABNAMRO"],
    region: "EUROPE",
  },
  {
    name: "Nordea",
    aliases: ["Nordea Bank"],
    region: "EUROPE",
  },
  {
    name: "Danske Bank",
    aliases: ["Danske"],
    region: "EUROPE",
  },
  {
    name: "Handelsbanken",
    aliases: ["SHB", "Svenska Handelsbanken"],
    region: "EUROPE",
  },
  {
    name: "Intesa Sanpaolo",
    aliases: ["Intesa", "ISP"],
    region: "EUROPE",
  },
  {
    name: "UniCredit",
    aliases: ["UniCredit Bank", "UCG"],
    region: "EUROPE",
  },
  {
    name: "Banco Santander",
    aliases: ["Santander", "Santander Bank"],
    region: "EUROPE",
  },
  {
    name: "BBVA",
    aliases: ["Banco Bilbao", "Banco Bilbao Vizcaya Argentaria"],
    region: "EUROPE",
  },
  {
    name: "CaixaBank",
    aliases: ["Caixa", "La Caixa"],
    region: "EUROPE",
  },
  {
    name: "Erste Group",
    aliases: ["Erste Bank", "Erste"],
    region: "EUROPE",
  },
  {
    name: "Raiffeisen Bank International",
    aliases: ["Raiffeisen", "RBI"],
    region: "EUROPE",
  },
  {
    name: "Sberbank",
    aliases: ["Sber"],
    region: "EUROPE",
  },
  {
    name: "VTB Bank",
    aliases: ["VTB"],
    region: "EUROPE",
  },
];

// ─── Asia Pacific ──────────────────────────────────────

const ASIA_PACIFIC_BANKS: BankEntry[] = [
  {
    name: "Industrial and Commercial Bank of China",
    aliases: ["ICBC"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "China Construction Bank",
    aliases: ["CCB"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Agricultural Bank of China",
    aliases: ["AgBank", "ABC"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Bank of China",
    aliases: ["BOC"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "China Merchants Bank",
    aliases: ["CMB"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Ping An Bank",
    aliases: ["PingAn"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Bank of Communications",
    aliases: ["BoCom", "BOCOM"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "State Bank of India",
    aliases: ["SBI"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "HDFC Bank",
    aliases: ["HDFC"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "ICICI Bank",
    aliases: ["ICICI"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Axis Bank",
    aliases: ["Axis"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Kotak Mahindra Bank",
    aliases: ["Kotak", "Kotak Mahindra"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Punjab National Bank",
    aliases: ["PNB"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Bank of Baroda",
    aliases: ["BoB"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "IndusInd Bank",
    aliases: ["IndusInd"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Yes Bank",
    aliases: ["YesBank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Mitsubishi UFJ Financial Group",
    aliases: ["MUFG", "Mitsubishi UFJ", "Bank of Tokyo"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Sumitomo Mitsui Financial Group",
    aliases: ["SMFG", "SMBC", "Sumitomo Mitsui"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Mizuho Financial Group",
    aliases: ["Mizuho", "Mizuho Bank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Nomura Holdings",
    aliases: ["Nomura"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "DBS Group",
    aliases: ["DBS", "DBS Bank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "OCBC Bank",
    aliases: ["OCBC", "Oversea-Chinese Banking"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "United Overseas Bank",
    aliases: ["UOB", "UOB Bank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Commonwealth Bank of Australia",
    aliases: ["CBA", "CommBank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Westpac Banking Corporation",
    aliases: ["Westpac"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Australia and New Zealand Banking Group",
    aliases: ["ANZ", "ANZ Bank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "National Australia Bank",
    aliases: ["NAB"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Macquarie Group",
    aliases: ["Macquarie", "Macquarie Bank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "KB Financial Group",
    aliases: ["KB", "Kookmin Bank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Shinhan Financial Group",
    aliases: ["Shinhan", "Shinhan Bank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Hana Financial Group",
    aliases: ["Hana Bank", "Hana"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Kasikornbank",
    aliases: ["KBank"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Bangkok Bank",
    aliases: ["BBL"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Bank Central Asia",
    aliases: ["BCA"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Bank Rakyat Indonesia",
    aliases: ["BRI"],
    region: "ASIA_PACIFIC",
  },
  {
    name: "Bank Mandiri",
    aliases: ["Mandiri"],
    region: "ASIA_PACIFIC",
  },
];

// ─── Middle East ───────────────────────────────────────

const MIDDLE_EAST_BANKS: BankEntry[] = [
  {
    name: "Qatar National Bank",
    aliases: ["QNB"],
    region: "MIDDLE_EAST",
  },
  {
    name: "First Abu Dhabi Bank",
    aliases: ["FAB"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Emirates NBD",
    aliases: ["ENBD", "Emirates National Bank of Dubai"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Saudi National Bank",
    aliases: ["SNB", "Al Ahli"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Al Rajhi Bank",
    aliases: ["Al Rajhi", "AlRajhi"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Riyad Bank",
    aliases: ["Riyad"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Mashreq Bank",
    aliases: ["Mashreq", "MashreqBank"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Abu Dhabi Commercial Bank",
    aliases: ["ADCB"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Kuwait Finance House",
    aliases: ["KFH"],
    region: "MIDDLE_EAST",
  },
  {
    name: "National Bank of Kuwait",
    aliases: ["NBK"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Bank Leumi",
    aliases: ["Leumi"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Hapoalim Bank",
    aliases: ["Bank Hapoalim"],
    region: "MIDDLE_EAST",
  },
  {
    name: "Arab National Bank",
    aliases: ["ANB", "Arab National"],
    region: "MIDDLE_EAST",
  },
];

// ─── Latin America ─────────────────────────────────────

const LATIN_AMERICA_BANKS: BankEntry[] = [
  {
    name: "Itaú Unibanco",
    aliases: ["Itau", "Itaú", "Itau Unibanco"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Banco Bradesco",
    aliases: ["Bradesco"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Banco do Brasil",
    aliases: ["BB", "Bank of Brazil"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Nubank",
    aliases: ["Nu"],
    region: "LATIN_AMERICA",
  },
  {
    name: "BTG Pactual",
    aliases: ["BTG"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Banorte",
    aliases: ["GFNorte", "Grupo Financiero Banorte"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Grupo Financiero Inbursa",
    aliases: ["Inbursa"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Banco de Chile",
    aliases: ["BCI"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Bancolombia",
    aliases: ["Bancolombia SA"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Banco de Bogotá",
    aliases: ["Banco de Bogota"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Banco de Crédito del Perú",
    aliases: ["BCP", "Banco de Credito del Peru"],
    region: "LATIN_AMERICA",
  },
  {
    name: "Mercado Pago",
    aliases: ["MercadoPago"],
    region: "LATIN_AMERICA",
  },
];

// ─── Africa ────────────────────────────────────────────

const AFRICA_BANKS: BankEntry[] = [
  {
    name: "Standard Bank",
    aliases: ["Standard Bank Group", "Stanbic"],
    region: "AFRICA",
  },
  {
    name: "FirstRand",
    aliases: ["First National Bank", "FNB"],
    region: "AFRICA",
  },
  {
    name: "Absa Group",
    aliases: ["Absa", "Absa Bank"],
    region: "AFRICA",
  },
  {
    name: "Nedbank",
    aliases: ["Nedbank Group"],
    region: "AFRICA",
  },
  {
    name: "Investec",
    aliases: ["Investec Bank"],
    region: "AFRICA",
  },
  {
    name: "Attijariwafa Bank",
    aliases: ["Attijariwafa"],
    region: "AFRICA",
  },
  {
    name: "Ecobank",
    aliases: ["Ecobank Transnational"],
    region: "AFRICA",
  },
  {
    name: "Zenith Bank",
    aliases: ["Zenith"],
    region: "AFRICA",
  },
  {
    name: "Guaranty Trust Bank",
    aliases: ["GTBank", "GTB", "GTCO"],
    region: "AFRICA",
  },
  {
    name: "Access Bank",
    aliases: ["Access"],
    region: "AFRICA",
  },
  {
    name: "United Bank for Africa",
    aliases: ["UBA"],
    region: "AFRICA",
  },
  {
    name: "First Bank of Nigeria",
    aliases: ["FirstBank", "FBN"],
    region: "AFRICA",
  },
  {
    name: "Commercial Bank of Ethiopia",
    aliases: ["CBE"],
    region: "AFRICA",
  },
  {
    name: "National Bank of Egypt",
    aliases: ["NBE"],
    region: "AFRICA",
  },
  {
    name: "Equity Bank",
    aliases: ["Equity Group"],
    region: "AFRICA",
  },
  {
    name: "KCB Group",
    aliases: ["KCB", "Kenya Commercial Bank"],
    region: "AFRICA",
  },
];

// ─── Combined Export ───────────────────────────────────

/**
 * All banks from every region, combined into a single array.
 */
export const BANKS: BankEntry[] = [
  ...NORTH_AMERICA_BANKS,
  ...EUROPE_BANKS,
  ...ASIA_PACIFIC_BANKS,
  ...MIDDLE_EAST_BANKS,
  ...LATIN_AMERICA_BANKS,
  ...AFRICA_BANKS,
];

/**
 * Banks grouped by region for region-specific analysis or reporting.
 */
export const BANKS_BY_REGION: Record<BankRegion, BankEntry[]> = {
  NORTH_AMERICA: NORTH_AMERICA_BANKS,
  EUROPE: EUROPE_BANKS,
  ASIA_PACIFIC: ASIA_PACIFIC_BANKS,
  MIDDLE_EAST: MIDDLE_EAST_BANKS,
  LATIN_AMERICA: LATIN_AMERICA_BANKS,
  AFRICA: AFRICA_BANKS,
  GLOBAL: BANKS,
};

/**
 * Flat list of all bank names and aliases for quick lookups.
 * Useful for building search indexes or pre-processing.
 */
export function getAllBankIdentifiers(): string[] {
  const identifiers: string[] = [];
  for (const bank of BANKS) {
    identifiers.push(bank.name);
    for (const alias of bank.aliases) {
      identifiers.push(alias);
    }
  }
  return identifiers;
}

/**
 * Total count of unique bank entries in the dataset.
 */
export const BANK_COUNT = BANKS.length;
