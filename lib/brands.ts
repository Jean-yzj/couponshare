import type { CouponCategory } from "@prisma/client";

// Curated common Taiwan brands. Any alias (case / spacing insensitive) normalizes
// to `name`, so 711 / 7-ELEVEN / Seven Eleven all become "7-11". `category` powers
// the "pick a category, then a brand" suggestions on the upload form. Extend freely.
export type CanonicalBrand = { name: string; category: CouponCategory; aliases: string[] };

export const BRANDS: CanonicalBrand[] = [
  // 超商
  { name: "7-11", category: "CONVENIENCE", aliases: ["711", "7 11", "7-eleven", "7 eleven", "seveneleven", "seven eleven", "seven-eleven", "seven", "統一超", "統一超商", "小七"] },
  { name: "全家", category: "CONVENIENCE", aliases: ["全家便利商店", "全家超商", "familymart", "family mart", "family-mart"] },
  { name: "萊爾富", category: "CONVENIENCE", aliases: ["hi-life", "hilife", "hi life"] },
  { name: "OK超商", category: "CONVENIENCE", aliases: ["ok", "ok mart", "okmart", "ok便利商店"] },
  { name: "全聯", category: "CONVENIENCE", aliases: ["全聯福利中心", "pxmart", "px mart"] },
  // 速食
  { name: "麥當勞", category: "FASTFOOD", aliases: ["mcdonald", "mcdonalds", "mcdonald's", "麥噹噹", "麥當當", "m記"] },
  { name: "肯德基", category: "FASTFOOD", aliases: ["kfc", "開封菜"] },
  { name: "摩斯漢堡", category: "FASTFOOD", aliases: ["摩斯", "mos", "mos burger", "mosburger"] },
  { name: "必勝客", category: "FASTFOOD", aliases: ["pizza hut", "pizzahut"] },
  { name: "達美樂", category: "FASTFOOD", aliases: ["domino", "dominos", "domino's", "達美樂披薩"] },
  { name: "Subway", category: "FASTFOOD", aliases: ["subway", "賽百味"] },
  { name: "頂呱呱", category: "FASTFOOD", aliases: ["tkk", "頂刮刮"] },
  // 咖啡
  { name: "星巴克", category: "COFFEE", aliases: ["starbucks", "sbux", "星巴"] },
  { name: "路易莎", category: "COFFEE", aliases: ["louisa", "louisa coffee", "路易莎咖啡"] },
  { name: "cama", category: "COFFEE", aliases: ["cama coffee", "cama café", "cama現烘咖啡"] },
  { name: "85度C", category: "COFFEE", aliases: ["85c", "85度c", "85 度c", "85°c"] },
  { name: "怡客咖啡", category: "COFFEE", aliases: ["ikari", "怡客"] },
  // 手搖飲
  { name: "50嵐", category: "DRINK", aliases: ["五十嵐", "50 嵐"] },
  { name: "可不可熟成紅茶", category: "DRINK", aliases: ["可不可", "kebuke"] },
  { name: "迷客夏", category: "DRINK", aliases: ["milksha", "迷克夏"] },
  { name: "清心福全", category: "DRINK", aliases: ["清心"] },
  { name: "大苑子", category: "DRINK", aliases: ["大苑子茶飲"] },
  { name: "CoCo都可", category: "DRINK", aliases: ["coco", "都可", "coco都可茶飲"] },
  { name: "五桐號", category: "DRINK", aliases: ["wootea"] },
  { name: "龜記", category: "DRINK", aliases: ["龜記茗品"] },
  { name: "comebuy", category: "DRINK", aliases: ["come buy"] },
  // 甜點
  { name: "Mister Donut", category: "DESSERT", aliases: ["mister donut", "misterdonut", "米斯特甜甜圈"] },
  { name: "亞尼克", category: "DESSERT", aliases: ["yannick"] },
  { name: "橋墩", category: "DESSERT", aliases: [] },
  // 餐廳
  { name: "王品", category: "RESTAURANT", aliases: ["wowprime"] },
  { name: "石二鍋", category: "RESTAURANT", aliases: [] },
  { name: "藏壽司", category: "RESTAURANT", aliases: ["kura", "藏鮨"] },
  { name: "壽司郎", category: "RESTAURANT", aliases: ["sushiro"] },
  { name: "海底撈", category: "RESTAURANT", aliases: ["haidilao"] },
  { name: "鼎泰豐", category: "RESTAURANT", aliases: ["din tai fung"] },
  // 購物
  { name: "康是美", category: "SHOPPING", aliases: ["cosmed"] },
  { name: "屈臣氏", category: "SHOPPING", aliases: ["watsons"] },
  { name: "寶雅", category: "SHOPPING", aliases: ["poya"] },
  { name: "家樂福", category: "SHOPPING", aliases: ["carrefour"] },
  { name: "大潤發", category: "SHOPPING", aliases: ["rt-mart", "rtmart"] },
  { name: "誠品", category: "SHOPPING", aliases: ["eslite", "誠品書店", "誠品生活"] },
  { name: "宜得利", category: "SHOPPING", aliases: ["nitori"] },
  { name: "IKEA", category: "SHOPPING", aliases: ["宜家"] },
  { name: "蝦皮", category: "SHOPPING", aliases: ["shopee"] },
  { name: "momo", category: "SHOPPING", aliases: ["momo購物"] },
  // 娛樂
  { name: "威秀影城", category: "ENTERTAINMENT", aliases: ["vieshow", "威秀"] },
  { name: "KKBOX", category: "ENTERTAINMENT", aliases: [] },
  { name: "Netflix", category: "ENTERTAINMENT", aliases: [] },
  { name: "Spotify", category: "ENTERTAINMENT", aliases: [] },
  { name: "錢櫃", category: "ENTERTAINMENT", aliases: ["cashbox"] },
];

const ALIAS_MAP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "");
  for (const b of BRANDS) {
    m.set(key(b.name), b.name);
    for (const a of b.aliases) m.set(key(a), b.name);
  }
  return m;
})();

// Normalize a free-text brand to its canonical name (exact / alias match, ignoring
// case and spacing). Unknown brands are returned trimmed, unchanged.
export function normalizeBrand(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return trimmed;
  return ALIAS_MAP.get(trimmed.toLowerCase().replace(/\s+/g, "")) ?? trimmed;
}

// Canonical brand names in a category — for the upload form's brand suggestions.
export function brandsForCategory(cat: string): string[] {
  return BRANDS.filter((b) => b.category === cat).map((b) => b.name);
}

export const ALL_BRAND_NAMES: string[] = BRANDS.map((b) => b.name);
