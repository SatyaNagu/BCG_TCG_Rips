/**
 * BC Rip's mystery packs (mock catalogue data).
 * Each pack yields ONE card; `odds` is the chance that card lands in each rarity tier.
 */

export type Rarity = "common" | "uncommon" | "rare" | "legendary" | "mythic";

export type Pack = {
  id: Rarity;
  name: string;
  /** Price in USD. */
  price: number;
  image: string;
  /** Back of the pack. */
  back: string;
  /** Pack colour, used for glows and the odds bar. */
  color: string;
  tagline: string;
  /** Chance (0–100) of each rarity, summing to 100. */
  odds: Record<Rarity, number>;
  badge?: string;
};

export const rarityOrder: Rarity[] = ["common", "uncommon", "rare", "legendary", "mythic"];

export const rarityColor: Record<Rarity, string> = {
  common: "#c9ccd3",
  uncommon: "#2fd06b",
  rare: "#3b82f6",
  legendary: "#ffc400",
  mythic: "#ff3d8b",
};

export const rarityLabel: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  legendary: "Legendary",
  mythic: "Mythic",
};

export const packs: Pack[] = [
  {
    id: "common",
    name: "Common Pack",
    price: 4.99,
    image: "/packs/common.webp",
    back: "/packs/common-back.webp",
    color: rarityColor.common,
    tagline: "Where every binder starts.",
    odds: { common: 68, uncommon: 24, rare: 6.5, legendary: 1.3, mythic: 0.2 },
  },
  {
    id: "uncommon",
    name: "Uncommon Pack",
    price: 9.99,
    image: "/packs/uncommon.webp",
    back: "/packs/uncommon-back.webp",
    color: rarityColor.uncommon,
    tagline: "Better odds, brighter pulls.",
    odds: { common: 40, uncommon: 42, rare: 14, legendary: 3.4, mythic: 0.6 },
  },
  {
    id: "rare",
    name: "Rare Pack",
    price: 24.99,
    image: "/packs/rare.webp",
    back: "/packs/rare-back.webp",
    color: rarityColor.rare,
    tagline: "Holo season starts here.",
    odds: { common: 0, uncommon: 45, rare: 44, legendary: 9.5, mythic: 1.5 },
  },
  {
    id: "legendary",
    name: "Legendary Pack",
    price: 49.99,
    image: "/packs/legendary.webp",
    back: "/packs/legendary-back.webp",
    color: rarityColor.legendary,
    tagline: "Gold foil. Big names.",
    odds: { common: 0, uncommon: 0, rare: 58, legendary: 37, mythic: 5 },
  },
  {
    id: "mythic",
    name: "Mythic Pack",
    price: 99.99,
    image: "/packs/mythic.webp",
    back: "/packs/mythic-back.webp",
    color: rarityColor.mythic,
    tagline: "Where Mew was pulled.",
    odds: { common: 0, uncommon: 0, rare: 0, legendary: 82, mythic: 18 },
  },
];

/** "1 in 6" style chance of the pack's own rarity or better. */
export function topHitOdds(pack: Pack) {
  const from = rarityOrder.indexOf(pack.id === "common" ? "rare" : pack.id);
  const chance = rarityOrder.slice(from).reduce((sum, r) => sum + pack.odds[r], 0);
  return { label: rarityLabel[rarityOrder[from]], oneIn: Math.max(1, Math.round(100 / chance)) };
}

/* ------------------------------------------------------------------ */
/* Cards that can be pulled                                            */
/* ------------------------------------------------------------------ */

export type PullCard = {
  id: string;
  name: string;
  rarity: Rarity;
  image: string;
  /** Mock market value in USD. */
  value: number;
};

/**
 * Pull pool (the binder cards from the hero video). Tiers with no card of their own
 * fall back to the nearest tier below, then above, so every roll returns a card.
 */
export const cards: PullCard[] = [
  { id: "rockets-mewtwo", name: "Rocket's Mewtwo", rarity: "uncommon", image: "/cards/rockets-mewtwo.webp", value: 6 },
  { id: "pikachu-ex", name: "Pikachu ex", rarity: "rare", image: "/cards/pikachu-ex.webp", value: 38 },
  { id: "gengar-mimikyu-gx", name: "Gengar & Mimikyu GX", rarity: "rare", image: "/cards/gengar-mimikyu-gx.webp", value: 24 },
  { id: "latias-latios-gx", name: "Latias & Latios GX", rarity: "rare", image: "/cards/latias-latios-gx.webp", value: 29 },
  { id: "giratina-v", name: "Giratina V", rarity: "legendary", image: "/cards/giratina-v.webp", value: 160 },
  { id: "umbreon-ex", name: "Umbreon ex", rarity: "legendary", image: "/cards/umbreon-ex.webp", value: 210 },
  { id: "umbreon-vmax", name: "Umbreon VMAX", rarity: "legendary", image: "/cards/umbreon-vmax.webp", value: 420 },
  { id: "mew-ex", name: "Mew ex", rarity: "mythic", image: "/cards/mew.webp", value: 640 },
];

function cardsOf(rarity: Rarity) {
  const i = rarityOrder.indexOf(rarity);
  const search = [...rarityOrder.slice(0, i + 1).reverse(), ...rarityOrder.slice(i + 1)];
  for (const r of search) {
    const pool = cards.filter((c) => c.rarity === r);
    if (pool.length) return pool;
  }
  return cards;
}

/** Rolls the pack's odds, then picks a card of that rarity. */
export function rollCard(pack: Pack, random = Math.random): { card: PullCard; rarity: Rarity } {
  let roll = random() * 100;
  let rarity: Rarity = rarityOrder[rarityOrder.length - 1];
  for (const r of rarityOrder) {
    roll -= pack.odds[r];
    if (roll < 0) {
      rarity = r;
      break;
    }
  }
  const pool = cardsOf(rarity);
  return { card: pool[Math.floor(random() * pool.length)], rarity };
}

/** Back of every pulled card (shown before the reveal and when a card is turned over). */
export const CARD_BACK = "/cards/back.webp";
