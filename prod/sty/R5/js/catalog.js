// Loads the live garment catalog (no list endpoint, so we use a broad sourcing
// search) and offers id→name lookups for brands / celebrities.
import { api } from "./api.js";
import { BRANDS, CELEBRITIES } from "./config.js";

let garmentsPromise = null;
let garments = [];

export async function loadGarments() {
  if (!garmentsPromise) {
    garmentsPromise = api.sourcingSearch({ mood_text: "editorial catalog", per_page: 100 })
      .then(res => {
        garments = (res.results || []).map(r => r.garment);
        // stable alpha order for selectors
        garments.sort((a, b) => a.name.localeCompare(b.name));
        return garments;
      })
      .catch(err => { garmentsPromise = null; throw err; });
  }
  return garmentsPromise;
}

export const getGarments = () => garments;
export const garmentById = (id) => garments.find(g => g.id === id);

const BRAND_BY_ID = new Map(BRANDS.map(b => [b.id, b]));
const BRAND_BY_NAME = new Map(BRANDS.map(b => [b.name.toLowerCase(), b]));
export const brandName = (id) => BRAND_BY_ID.get(id)?.name || id;
export const brandIdByName = (name) => BRAND_BY_NAME.get((name || "").toLowerCase())?.id || null;

const CELEB_BY_ID = new Map(CELEBRITIES.map(c => [c.id, c]));
export const celebName = (id) => {
  const c = CELEB_BY_ID.get(id);
  return c ? `${c.name}` : id;
};
export const celebKo = (id) => CELEB_BY_ID.get(id)?.ko || "";
