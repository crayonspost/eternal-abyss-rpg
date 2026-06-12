export type ClassKey = "warrior" | "paladin" | "mage" | "warlock" | "archer" | "elf" | "assassin";
export type Gender = "male" | "female";
export type Quality = "normal" | "fine" | "rare" | "epic" | "legend" | "myth";
export type EquipSlot = "weapon" | "helmet" | "armor" | "gloves" | "boots" | "necklace" | "ring";
export type ItemKind = "equip" | "consume" | "material" | "quest";

export interface Stats {
  str: number; agi: number; int: number; vit: number; luk: number;
}

export interface DerivedStats {
  hp: number; mp: number; patk: number; matk: number; pdef: number; mdef: number;
  crit: number; eva: number;
}

export interface Affix { key: keyof DerivedStats; value: number; }

export interface EquipItem {
  id: string;
  kind: "equip";
  slot: EquipSlot;
  name: string;
  quality: Quality;
  level: number;
  base: Partial<DerivedStats>;
  affixes: Affix[];
  icon: string;
  price: number;
}

export interface ConsumeItem {
  id: string; kind: "consume"; name: string; icon: string; price: number;
  effect: { hp?: number; mp?: number };
  desc: string;
}

export interface MaterialItem {
  id: string; kind: "material"; name: string; icon: string; price: number; desc: string;
}

export interface QuestItem {
  id: string; kind: "quest"; name: string; icon: string; price: 0; desc: string;
}

export type Item = EquipItem | ConsumeItem | MaterialItem | QuestItem;

export interface InventoryStack {
  uid: string; // unique inventory id
  item: Item;
  count: number;
}

export interface Skill {
  id: string;
  name: string;
  tier: "basic" | "mid" | "high" | "ultimate";
  type: "active" | "passive";
  maxLv: number;
  desc: (lv: number) => string;
  cost?: (lv: number) => number; // mp cost
  // for active: damage multiplier on patk or matk
  power?: (lv: number) => number;
  element?: "phys" | "magic";
  passive?: (lv: number) => Partial<DerivedStats>;
  requires?: { id: string; lv: number }[];
  icon: string;
}

export interface Monster {
  id: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  gold: number;
  kind: "normal" | "elite" | "boss";
  icon: string;
  drops: { itemId: string; chance: number }[];
}

export interface MapDef {
  id: string;
  name: string;
  minLevel: number;
  bg: string; // css gradient
  emoji: string;
  monsters: string[]; // monster ids
  boss: string;
}

export interface QuestDef {
  id: string;
  type: "main" | "side" | "daily";
  name: string;
  desc: string;
  target: { type: "kill" | "level" | "collect"; id?: string; count: number };
  reward: { exp?: number; gold?: number; items?: { id: string; count: number }[] };
}

export interface Achievement {
  id: string; name: string; desc: string;
  check: (s: PlayerSave) => boolean;
  reward?: { title?: string; gold?: number };
}

export interface TitleDef {
  id: string; name: string; desc: string;
  bonus: Partial<DerivedStats>;
}

export interface PlayerSave {
  slot: number;
  name: string;
  classKey: ClassKey;
  gender: Gender;
  level: number;
  exp: number;
  statPoints: number;
  skillPoints: number;
  stats: Stats;
  hp: number; mp: number;
  gold: number;
  inventory: InventoryStack[];
  equipped: Partial<Record<EquipSlot, EquipItem>>;
  skills: Record<string, number>; // id -> level
  mapId: string;
  questsActive: Record<string, number>; // questId -> progress
  questsDone: string[];
  questsClaimedDaily: Record<string, string>; // questId -> dateStr
  killCount: Record<string, number>;
  totalKills: number;
  achievements: string[];
  titles: string[];
  activeTitle?: string;
  abyssFloor: number; // highest cleared
  abyssClaims: number[]; // floors with first-clear claimed
  playTime: number;
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  bgm: boolean;
  sfx: boolean;
  quality: "low" | "mid" | "high";
}
