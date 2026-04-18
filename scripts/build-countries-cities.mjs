/**
 * Generates src/data/countries-and-cities.json (static, no runtime API).
 * Run: node scripts/build-countries-cities.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { City, Country } from "country-state-city";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outPath = path.join(root, "src", "data", "countries-and-cities.json");

/** Curated capitals / hubs first (English names), then filled from dataset by population */
const SEED_EN = {
  KR: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju", "Suwon", "Ulsan", "Sejong", "Jeju"],
  JP: ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto", "Hiroshima", "Sendai"],
  CN: ["Shanghai", "Beijing", "Guangzhou", "Shenzhen", "Chengdu", "Chongqing", "Hangzhou", "Wuhan", "Xi'an", "Nanjing"],
  TW: ["Taipei", "Kaohsiung", "Taichung", "Tainan", "Hsinchu"],
  HK: ["Hong Kong"],
  MO: ["Macau"],
  SG: ["Singapore"],
  MY: ["Kuala Lumpur", "George Town", "Johor Bahru", "Ipoh", "Malacca"],
  TH: ["Bangkok", "Chiang Mai", "Phuket", "Pattaya", "Hat Yai"],
  VN: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Hue"],
  ID: ["Jakarta", "Surabaya", "Bandung", "Medan", "Bali", "Denpasar", "Yogyakarta"],
  PH: ["Manila", "Quezon City", "Cebu City", "Davao City"],
  IN: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Jaipur"],
  BD: ["Dhaka", "Chittagong", "Khulna"],
  NP: ["Kathmandu", "Pokhara"],
  LK: ["Colombo", "Kandy", "Galle"],
  AU: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra"],
  NZ: ["Auckland", "Wellington", "Christchurch", "Queenstown"],
  US: ["New York", "Los Angeles", "Chicago", "Houston", "San Francisco", "Seattle", "Miami", "Boston", "Washington"],
  CA: ["Toronto", "Vancouver", "Montreal", "Calgary", "Ottawa"],
  MX: ["Mexico City", "Guadalajara", "Monterrey", "Cancún", "Puebla"],
  BR: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza"],
  AR: ["Buenos Aires", "Córdoba", "Mendoza"],
  CL: ["Santiago", "Valparaíso"],
  CO: ["Bogotá", "Medellín", "Cali", "Cartagena"],
  PE: ["Lima", "Cusco", "Arequipa"],
  GB: ["London", "Manchester", "Edinburgh", "Birmingham", "Liverpool", "Bristol"],
  IE: ["Dublin", "Cork", "Galway"],
  FR: ["Paris", "Lyon", "Marseille", "Nice", "Toulouse", "Bordeaux"],
  DE: ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart"],
  IT: ["Rome", "Milan", "Florence", "Naples", "Venice", "Turin"],
  ES: ["Madrid", "Barcelona", "Valencia", "Seville", "Málaga"],
  PT: ["Lisbon", "Porto", "Faro"],
  NL: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht"],
  BE: ["Brussels", "Antwerp", "Bruges", "Ghent"],
  CH: ["Zurich", "Geneva", "Basel", "Bern", "Lausanne"],
  AT: ["Vienna", "Salzburg", "Innsbruck", "Graz"],
  SE: ["Stockholm", "Gothenburg", "Malmö"],
  NO: ["Oslo", "Bergen", "Trondheim"],
  DK: ["Copenhagen", "Aarhus", "Odense"],
  FI: ["Helsinki", "Tampere", "Turku", "Rovaniemi"],
  IS: ["Reykjavík"],
  PL: ["Warsaw", "Kraków", "Gdańsk", "Wrocław"],
  CZ: ["Prague", "Brno", "Český Krumlov"],
  HU: ["Budapest", "Debrecen"],
  GR: ["Athens", "Thessaloniki", "Santorini"],
  TR: ["Istanbul", "Ankara", "Izmir", "Antalya", "Cappadocia"],
  AE: ["Dubai", "Abu Dhabi", "Sharjah"],
  SA: ["Riyadh", "Jeddah", "Mecca", "Medina"],
  IL: ["Tel Aviv", "Jerusalem", "Haifa"],
  JO: ["Amman", "Petra", "Aqaba"],
  EG: ["Cairo", "Alexandria", "Luxor", "Sharm El Sheikh"],
  MA: ["Marrakesh", "Casablanca", "Fez", "Rabat", "Chefchaouen"],
  ZA: ["Cape Town", "Johannesburg", "Durban"],
  KE: ["Nairobi", "Mombasa"],
  NG: ["Lagos", "Abuja"],
  RU: ["Moscow", "Saint Petersburg", "Sochi", "Kazan"],
  UA: ["Kyiv", "Lviv", "Odesa"],
  RO: ["Bucharest", "Cluj-Napoca", "Brașov"],
  BG: ["Sofia", "Plovdiv", "Varna"],
  HR: ["Zagreb", "Dubrovnik", "Split"],
  RS: ["Belgrade", "Novi Sad"],
  SI: ["Ljubljana", "Bled"],
  SK: ["Bratislava", "Košice"],
};

const INCLUDE = new Set(Object.keys(SEED_EN));

const MAX_CITIES = 28;

function triplet(en) {
  return { en, ko: en, de: en };
}

function mergeCities(code) {
  const seen = new Set();
  const out = [];
  const add = (name) => {
    const n = name.trim();
    if (!n) return;
    const k = n.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(triplet(n));
  };
  for (const n of SEED_EN[code] ?? []) add(n);

  const cities = City.getCitiesOfCountry(code);
  if (cities?.length) {
    const sorted = [...cities].sort((a, b) => (Number(b.population) || 0) - (Number(a.population) || 0));
    for (const c of sorted) {
      add(c.name);
      if (out.length >= MAX_CITIES) break;
    }
  }
  return out;
}

const citiesByCountry = {};
for (const code of INCLUDE) {
  citiesByCountry[code] = mergeCities(code);
}

const allCountries = Country.getAllCountries().map((c) => c.isoCode);

const payload = {
  version: 2,
  generatedAt: new Date().toISOString(),
  citiesByCountry,
  countryCodes: allCountries.sort(),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload));
console.log("Wrote", outPath, "regions with city lists:", Object.keys(citiesByCountry).length);
