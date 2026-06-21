// Runtime config. The dev server (devserver.py) proxies /api → backend, so the
// app is same-origin and API_BASE is empty. In production behind one origin the
// same empty base works. Override by setting window.STYLEON_API_BASE before load.
export const API_BASE = (window.STYLEON_API_BASE ?? "").replace(/\/$/, "");

export const ROLES = [
  { id: "admin",            label: "관리자",       short: "관리자",  note: "전체 PII 열람" },
  { id: "stylist",          label: "스타일리스트", short: "스타일",  note: "연락처 PII 비공개" },
  { id: "showroom-partner", label: "쇼룸 파트너",  short: "쇼룸",    note: "전체 PII 열람" },
];

export const DEFAULT_ROLE = "stylist";

// Navigation map (also the hash routes). All 10 STYLE:ON features.
export const NAV = [
  { id: "sourcing", route: "#/sourcing", tag: "01", label: "ON Sourcing" },
  { id: "sponsor",  route: "#/sponsor",  tag: "02", label: "ON Sponsor" },
  { id: "track",    route: "#/track",    tag: "03", label: "ON Track" },
  { id: "fit",      route: "#/fit",      tag: "04", label: "ON Fit" },
  { id: "ref",      route: "#/ref",      tag: "05", label: "ON Ref" },
  { id: "lens",     route: "#/lens",     tag: "06", label: "ON Lens" },
  { id: "trend",    route: "#/trend",    tag: "07", label: "ON Trend" },
  { id: "pay",      route: "#/pay",      tag: "08", label: "ON Pay" },
  { id: "desk",     route: "#/desk",     tag: "09", label: "ON Desk" },
  { id: "crew",     route: "#/crew",     tag: "10", label: "ON Crew" },
];

// Reference data without a list endpoint (seeded brands/celebrities/showrooms).
// Sourced from the live DB seed; used to populate selectors. Garments are loaded
// live from POST /api/sourcing/search.
export const BRANDS = [
  { id: "brand-studio-margot",  name: "STUDIO MARGOT" },
  { id: "brand-essentiel",      name: "ESSENTIEL" },
  { id: "brand-denim-atelier",  name: "DENIM ATELIER" },
  { id: "brand-rooms-label",    name: "ROOMS LABEL" },
  { id: "brand-aurora-archive", name: "AURORA ARCHIVE" },
  { id: "brand-noir-division",  name: "NOIR DIVISION" },
  { id: "brand-atelier-lune",   name: "ATELIER LUNE" },
  { id: "brand-sable-row",      name: "SABLE ROW" },
  { id: "brand-mint-works",     name: "MINT WORKS" },
  { id: "brand-arc-bijou",      name: "ARC BIJOU" },
];

export const CELEBRITIES = [
  { id: "celeb-minseo",   name: "Han Minseo",   ko: "한민서" },
  { id: "celeb-arin",     name: "Yoo Arin",     ko: "유아린" },
  { id: "celeb-daehyun",  name: "Kang Daehyun", ko: "강대현" },
  { id: "celeb-jieun",    name: "Seo Jieun",    ko: "서지은" },
];

export const CATEGORIES = [
  { id: "", label: "전체 카테고리" },
  { id: "outer", label: "아우터" },
  { id: "top", label: "탑" },
  { id: "bottom", label: "보텀" },
  { id: "full", label: "원피스/세트" },
  { id: "shoes", label: "슈즈" },
  { id: "bag", label: "백" },
  { id: "jewelry", label: "주얼리" },
  { id: "accessory", label: "액세서리" },
];

export const SEASONS = [
  { id: "", label: "전체 시즌" },
  { id: "spring", label: "봄" },
  { id: "summer", label: "여름" },
  { id: "fall", label: "가을" },
  { id: "winter", label: "겨울" },
];

export const SIZES = ["", "XS", "S", "M", "L", "OS", "245"];
