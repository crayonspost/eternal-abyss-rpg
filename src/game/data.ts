import type {
  ClassKey, Skill, EquipItem, ConsumeItem, MaterialItem, Monster, MapDef,
  QuestDef, Achievement, TitleDef, Stats, Quality, EquipSlot, DerivedStats,
} from "./types";

export const CLASSES: Record<ClassKey, {
  key: ClassKey; name: string; desc: string; emoji: { male: string; female: string };
  base: Stats; growth: Stats; mainAttr: "patk" | "matk";
  color: string;
}> = {
  warrior:  { key: "warrior",  name: "戰士",   desc: "近戰物攻，肉盾型輸出",   emoji: { male: "⚔️", female: "🗡️" }, base: { str: 8, agi: 5, int: 3, vit: 8, luk: 4 }, growth: { str: 3, agi: 1, int: 1, vit: 2, luk: 1 }, mainAttr: "patk", color: "#d94f3a" },
  paladin:  { key: "paladin",  name: "聖騎士", desc: "防禦與聖光輔助",         emoji: { male: "🛡️", female: "✨" }, base: { str: 7, agi: 4, int: 5, vit: 9, luk: 3 }, growth: { str: 2, agi: 1, int: 2, vit: 3, luk: 1 }, mainAttr: "patk", color: "#f4d35e" },
  mage:     { key: "mage",     name: "法師",   desc: "元素魔法高傷",           emoji: { male: "🔮", female: "💫" }, base: { str: 3, agi: 4, int: 10, vit: 4, luk: 5 }, growth: { str: 1, agi: 1, int: 3, vit: 1, luk: 1 }, mainAttr: "matk", color: "#5b8def" },
  warlock:  { key: "warlock",  name: "術士",   desc: "暗影詛咒持續傷害",       emoji: { male: "🕯️", female: "🌙" }, base: { str: 3, agi: 5, int: 9, vit: 5, luk: 5 }, growth: { str: 1, agi: 1, int: 3, vit: 1, luk: 2 }, mainAttr: "matk", color: "#9b59b6" },
  archer:   { key: "archer",   name: "弓箭手", desc: "遠程物攻、暴擊高",       emoji: { male: "🏹", female: "🎯" }, base: { str: 5, agi: 9, int: 4, vit: 5, luk: 6 }, growth: { str: 2, agi: 3, int: 1, vit: 1, luk: 2 }, mainAttr: "patk", color: "#3aa66b" },
  elf:      { key: "elf",      name: "妖精",   desc: "自然魔法、輔助回復",     emoji: { male: "🍃", female: "🌸" }, base: { str: 4, agi: 7, int: 7, vit: 5, luk: 6 }, growth: { str: 1, agi: 2, int: 2, vit: 2, luk: 2 }, mainAttr: "matk", color: "#7ed957" },
  assassin: { key: "assassin", name: "刺客",   desc: "敏捷暴擊、瞬殺",         emoji: { male: "🗡️", female: "🌑" }, base: { str: 6, agi: 10, int: 3, vit: 4, luk: 7 }, growth: { str: 2, agi: 3, int: 1, vit: 1, luk: 2 }, mainAttr: "patk", color: "#2c3e50" },
};

// Exp curve: smooth
export function expForLevel(lv: number): number {
  if (lv <= 1) return 0;
  return Math.floor(50 * Math.pow(lv, 1.85));
}

export function derive(stats: Stats, level: number, classKey: ClassKey, equip: Partial<Record<EquipSlot, EquipItem>>, skillBonuses: Partial<DerivedStats>, titleBonus: Partial<DerivedStats>): DerivedStats {
  const c = CLASSES[classKey];
  const d: DerivedStats = {
    hp: 80 + stats.vit * 12 + level * 18,
    mp: 30 + stats.int * 8 + level * 6,
    patk: 5 + stats.str * 2 + Math.floor(level * 1.2) + (c.mainAttr === "patk" ? stats.str : 0),
    matk: 5 + stats.int * 2 + Math.floor(level * 1.2) + (c.mainAttr === "matk" ? stats.int : 0),
    pdef: 3 + stats.vit * 1 + Math.floor(level * 0.6),
    mdef: 3 + stats.int + Math.floor(level * 0.5),
    crit: Math.min(60, 3 + stats.luk * 0.5 + stats.agi * 0.1),
    eva: Math.min(40, 2 + stats.agi * 0.4 + stats.luk * 0.1),
  };
  for (const slot of Object.keys(equip) as EquipSlot[]) {
    const e = equip[slot]; if (!e) continue;
    for (const [k, v] of Object.entries(e.base)) (d as any)[k] += v;
    for (const af of e.affixes) (d as any)[af.key] += af.value;
  }
  for (const [k, v] of Object.entries(skillBonuses)) (d as any)[k] += v || 0;
  for (const [k, v] of Object.entries(titleBonus)) (d as any)[k] += v || 0;
  d.hp = Math.floor(d.hp); d.mp = Math.floor(d.mp);
  return d;
}

// ============ Skills per class (15 each) ============
function mkSkill(s: Skill): Skill { return s; }

function genSkillSet(cls: ClassKey): Skill[] {
  const isMagic = CLASSES[cls].mainAttr === "matk";
  const elem = isMagic ? "magic" : "phys";
  const prefix = CLASSES[cls].name;
  const list: Skill[] = [];
  const tiers: Skill["tier"][] = ["basic","basic","basic","basic","mid","mid","mid","mid","high","high","high","high","ultimate","ultimate","ultimate"];
  const icons = ["💥","⚡","🔥","❄️","🌪️","✨","☄️","🌟","🩸","🛡️","💫","🌀","🌈","🎯","☠️"];
  const names = ["強擊","破甲","旋風","集中","怒裂","狂風","烈焰","寒霜","裂地","聖盾","奧義","風暴","終極","必殺","湮滅"];
  for (let i=0;i<15;i++){
    const tier = tiers[i];
    const isPassive = i===3 || i===7 || i===9;
    if (isPassive) {
      list.push(mkSkill({
        id: `${cls}_p${i}`,
        name: `${prefix}·${names[i]}`,
        tier, type:"passive", maxLv: tier==="ultimate"?5:10,
        icon: icons[i],
        desc: (lv)=> `被動：${isMagic?"魔":"物"}攻 +${lv*3}, 生命 +${lv*15}`,
        passive: (lv)=> isMagic? { matk: lv*3, hp: lv*15 } : { patk: lv*3, hp: lv*15 },
        requires: i>0 ? [{ id: `${cls}_p${Math.max(0,i-4)}`, lv: 1 }] : undefined,
      }));
    } else {
      const baseMul = tier==="basic"?1.2: tier==="mid"?1.8: tier==="high"?2.6:4.0;
      list.push(mkSkill({
        id: `${cls}_a${i}`,
        name: `${prefix}·${names[i]}`,
        tier, type:"active",
        maxLv: tier==="ultimate"?5:10,
        icon: icons[i],
        element: elem as any,
        cost: (lv)=> Math.floor((tier==="basic"?5: tier==="mid"?12: tier==="high"?22:40) + lv*2),
        power: (lv)=> baseMul + lv*0.15,
        desc: (lv)=> `${isMagic?"魔":"物"}傷 x${(baseMul+lv*0.15).toFixed(2)}，消耗MP ${Math.floor((tier==="basic"?5: tier==="mid"?12: tier==="high"?22:40)+lv*2)}`,
        requires: i>=4 ? [{ id: `${cls}_a0`, lv: 1 }] : undefined,
      }));
    }
  }
  return list;
}

export const SKILLS: Record<ClassKey, Skill[]> = {
  warrior: genSkillSet("warrior"),
  paladin: genSkillSet("paladin"),
  mage: genSkillSet("mage"),
  warlock: genSkillSet("warlock"),
  archer: genSkillSet("archer"),
  elf: genSkillSet("elf"),
  assassin: genSkillSet("assassin"),
};

// =========== Items ============
export const QUALITY_COLOR: Record<Quality, string> = {
  normal: "#bdbdbd", fine: "#4ade80", rare: "#60a5fa", epic: "#c084fc", legend: "#fbbf24", myth: "#f87171",
};
export const QUALITY_NAME: Record<Quality, string> = {
  normal: "普通", fine: "優秀", rare: "稀有", epic: "史詩", legend: "傳說", myth: "神話",
};
export const QUALITY_MUL: Record<Quality, number> = {
  normal: 1, fine: 1.4, rare: 1.9, epic: 2.6, legend: 3.6, myth: 5.0,
};
export const QUALITY_AFFIX_COUNT: Record<Quality, number> = {
  normal: 0, fine: 1, rare: 2, epic: 3, legend: 4, myth: 5,
};

const SLOT_ICONS: Record<EquipSlot, string> = {
  weapon: "⚔️", helmet: "⛑️", armor: "🥋", gloves: "🧤", boots: "👢", necklace: "📿", ring: "💍",
};
const SLOT_NAMES: Record<EquipSlot, string> = {
  weapon: "武器", helmet: "頭盔", armor: "衣服", gloves: "護手", boots: "鞋子", necklace: "項鍊", ring: "戒指",
};
export const SLOT_INFO = { icons: SLOT_ICONS, names: SLOT_NAMES };

const AFFIX_POOL: { key: keyof DerivedStats; min: number; max: number }[] = [
  { key: "patk", min: 2, max: 8 },
  { key: "matk", min: 2, max: 8 },
  { key: "pdef", min: 2, max: 6 },
  { key: "mdef", min: 2, max: 6 },
  { key: "hp",   min: 20, max: 80 },
  { key: "mp",   min: 10, max: 40 },
  { key: "crit", min: 1, max: 5 },
];

export function rollEquip(slot: EquipSlot, level: number, qualityForce?: Quality): EquipItem {
  const r = Math.random();
  const q: Quality = qualityForce ?? (
    r < 0.45 ? "normal" :
    r < 0.75 ? "fine" :
    r < 0.9  ? "rare" :
    r < 0.97 ? "epic" :
    r < 0.995? "legend" : "myth"
  );
  const mul = QUALITY_MUL[q] * (1 + level * 0.08);
  const base: Partial<DerivedStats> = {};
  if (slot === "weapon") { base.patk = Math.floor(8 * mul); base.matk = Math.floor(8 * mul); }
  else if (slot === "helmet") { base.pdef = Math.floor(4 * mul); base.hp = Math.floor(20 * mul); }
  else if (slot === "armor") { base.pdef = Math.floor(6 * mul); base.hp = Math.floor(30 * mul); }
  else if (slot === "gloves") { base.patk = Math.floor(3 * mul); base.crit = Math.floor(2 * mul); }
  else if (slot === "boots") { base.eva = Math.floor(2 * mul); base.pdef = Math.floor(3 * mul); }
  else if (slot === "necklace") { base.matk = Math.floor(4 * mul); base.mp = Math.floor(20 * mul); }
  else if (slot === "ring") { base.crit = Math.floor(2 * mul); base.patk = Math.floor(2 * mul); base.matk = Math.floor(2 * mul); }

  const count = QUALITY_AFFIX_COUNT[q];
  const affixes = [];
  const pool = [...AFFIX_POOL];
  for (let i=0; i<count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    const a = pool.splice(idx, 1)[0];
    if (!a) break;
    const val = Math.floor((a.min + Math.random()*(a.max - a.min)) * (1 + level*0.05));
    affixes.push({ key: a.key, value: val });
  }
  const name = `${QUALITY_NAME[q]}${SLOT_NAMES[slot]}`;
  return {
    id: `eq_${Math.random().toString(36).slice(2,9)}`,
    kind: "equip", slot, name, quality: q, level,
    base, affixes, icon: SLOT_ICONS[slot],
    price: Math.floor(10 * mul * level),
  };
}

export const CONSUMES: ConsumeItem[] = [
  { id: "hp_pot_s", kind: "consume", name: "小型生命藥水", icon: "🧪", price: 30, effect: { hp: 80 }, desc: "回復 80 HP" },
  { id: "hp_pot_m", kind: "consume", name: "中型生命藥水", icon: "🧪", price: 120, effect: { hp: 300 }, desc: "回復 300 HP" },
  { id: "hp_pot_l", kind: "consume", name: "大型生命藥水", icon: "🧪", price: 400, effect: { hp: 1000 }, desc: "回復 1000 HP" },
  { id: "mp_pot_s", kind: "consume", name: "小型魔力藥水", icon: "💙", price: 30, effect: { mp: 50 }, desc: "回復 50 MP" },
  { id: "mp_pot_m", kind: "consume", name: "中型魔力藥水", icon: "💙", price: 120, effect: { mp: 200 }, desc: "回復 200 MP" },
  { id: "elixir",   kind: "consume", name: "全能藥劑",     icon: "🌟", price: 800, effect: { hp: 5000, mp: 5000 }, desc: "完全回復" },
];

export const MATERIALS: MaterialItem[] = [
  { id: "mat_fang", kind: "material", name: "獠牙", icon: "🦷", price: 8, desc: "怪物素材" },
  { id: "mat_horn", kind: "material", name: "魔角", icon: "🐏", price: 25, desc: "稀有素材" },
  { id: "mat_crystal", kind: "material", name: "魔晶", icon: "💎", price: 80, desc: "高階素材" },
  { id: "mat_shadow", kind: "material", name: "暗影碎片", icon: "🖤", price: 200, desc: "深淵素材" },
];

export const ITEM_INDEX: Record<string, ConsumeItem | MaterialItem> = {};
[...CONSUMES, ...MATERIALS].forEach(i => { ITEM_INDEX[i.id] = i; });

// =========== Monsters (50+) ============
const M = (id: string, name: string, level: number, kind: Monster["kind"], icon: string, drops: Monster["drops"] = []): Monster => {
  const k = kind === "boss" ? 8 : kind === "elite" ? 2.5 : 1;
  return {
    id, name, level, kind, icon,
    hp: Math.floor((40 + level * 22) * k),
    atk: Math.floor((6 + level * 2.2) * (k*0.7+0.3)),
    def: Math.floor((2 + level * 1.1) * (k*0.6+0.4)),
    exp: Math.floor((15 + level * 8) * (k*0.6+0.4)),
    gold: Math.floor((8 + level * 4) * (k*0.6+0.4)),
    drops,
  };
};

export const MONSTERS: Monster[] = [
  // 草原 1-10
  M("slime","史萊姆",1,"normal","🟢",[{itemId:"mat_fang",chance:0.4},{itemId:"hp_pot_s",chance:0.15}]),
  M("rabbit","野兔",2,"normal","🐇",[{itemId:"mat_fang",chance:0.5}]),
  M("bee","刺蜂",3,"normal","🐝",[{itemId:"mat_fang",chance:0.4}]),
  M("boar","野豬",4,"normal","🐗",[{itemId:"mat_fang",chance:0.5},{itemId:"hp_pot_s",chance:0.2}]),
  M("wolfpup","幼狼",5,"normal","🐺",[{itemId:"mat_fang",chance:0.5}]),
  M("greenslime","綠史萊姆",6,"elite","🟢",[{itemId:"mat_horn",chance:0.3}]),
  M("plant","食人花",7,"normal","🌺",[{itemId:"mat_fang",chance:0.5}]),
  M("scarecrow","稻草人",8,"elite","🎃",[{itemId:"mat_horn",chance:0.35}]),
  M("hornet","大黃蜂",9,"normal","🐝",[{itemId:"mat_fang",chance:0.4}]),
  M("plain_king","平原之王",10,"boss","👑",[{itemId:"mat_horn",chance:1},{itemId:"hp_pot_m",chance:0.8}]),

  // 森林遺跡 11-25
  M("goblin","哥布林",11,"normal","👺",[{itemId:"mat_fang",chance:0.5}]),
  M("treant","樹人",13,"normal","🌳",[{itemId:"mat_horn",chance:0.3}]),
  M("spider","巨蜘蛛",14,"normal","🕷️",[{itemId:"mat_fang",chance:0.5}]),
  M("druid","遺跡德魯伊",16,"elite","🧙",[{itemId:"mat_horn",chance:0.4},{itemId:"mp_pot_s",chance:0.3}]),
  M("wolf","狼王",18,"normal","🐺",[{itemId:"mat_horn",chance:0.3}]),
  M("ghost","遊魂",20,"elite","👻",[{itemId:"mat_crystal",chance:0.15}]),
  M("forest_lord","森林守護者",25,"boss","🌲",[{itemId:"mat_crystal",chance:1},{itemId:"hp_pot_l",chance:0.5}]),

  // 黑暗洞窟 26-50
  M("bat","蝙蝠",26,"normal","🦇",[{itemId:"mat_fang",chance:0.5}]),
  M("skeleton","骷髏兵",30,"normal","💀",[{itemId:"mat_horn",chance:0.4}]),
  M("zombie","食屍鬼",33,"normal","🧟",[{itemId:"mat_horn",chance:0.4}]),
  M("minotaur","牛頭怪",37,"elite","🐂",[{itemId:"mat_crystal",chance:0.3}]),
  M("dark_knight","暗黑騎士",42,"elite","🖤",[{itemId:"mat_crystal",chance:0.35}]),
  M("cave_lord","洞窟魔王",50,"boss","🦂",[{itemId:"mat_crystal",chance:1}]),

  // 熔岩火山 51-90
  M("imp","火精靈",51,"normal","🔥",[{itemId:"mat_horn",chance:0.4}]),
  M("magma","熔岩怪",55,"normal","🟥",[{itemId:"mat_crystal",chance:0.3}]),
  M("salamander","火蜥蜴",60,"normal","🦎",[{itemId:"mat_crystal",chance:0.3}]),
  M("fire_giant","炎巨人",70,"elite","🗿",[{itemId:"mat_crystal",chance:0.4}]),
  M("phoenix","幼鳳",80,"elite","🐦‍🔥",[{itemId:"mat_crystal",chance:0.5}]),
  M("volcano_lord","熔岩之主",90,"boss","🌋",[{itemId:"mat_crystal",chance:1},{itemId:"mat_shadow",chance:0.5}]),

  // 冰雪峽谷 91-130
  M("snowfox","雪狐",92,"normal","🦊",[{itemId:"mat_horn",chance:0.4}]),
  M("yeti","雪人",100,"normal","☃️",[{itemId:"mat_crystal",chance:0.3}]),
  M("ice_witch","冰雪女巫",110,"elite","🧙‍♀️",[{itemId:"mat_crystal",chance:0.4}]),
  M("frost_wolf","霜狼",115,"normal","🐺",[{itemId:"mat_crystal",chance:0.3}]),
  M("frost_giant","霜巨人",125,"elite","🧊",[{itemId:"mat_crystal",chance:0.5}]),
  M("ice_dragon","冰霜龍",130,"boss","🐉",[{itemId:"mat_crystal",chance:1},{itemId:"mat_shadow",chance:0.6}]),

  // 天空神殿 131-180
  M("angel","小天使",132,"normal","😇",[{itemId:"mat_crystal",chance:0.4}]),
  M("seraph","熾天使",145,"elite","👼",[{itemId:"mat_shadow",chance:0.3}]),
  M("griffin","獅鷲",160,"normal","🦅",[{itemId:"mat_crystal",chance:0.5}]),
  M("paladin_g","守護聖騎",170,"elite","🛡️",[{itemId:"mat_shadow",chance:0.4}]),
  M("god_guard","神殿守衛",175,"elite","⚜️",[{itemId:"mat_shadow",chance:0.5}]),
  M("sky_god","天空之神",180,"boss","☁️",[{itemId:"mat_shadow",chance:1}]),

  // 深淵魔城 181-300
  M("demon","小惡魔",182,"normal","😈",[{itemId:"mat_shadow",chance:0.4}]),
  M("abyss_knight","深淵騎士",200,"elite","⚫",[{itemId:"mat_shadow",chance:0.5}]),
  M("abyss_mage","深淵法師",215,"elite","🔮",[{itemId:"mat_shadow",chance:0.5}]),
  M("hellhound","地獄犬",230,"normal","🐕‍🦺",[{itemId:"mat_shadow",chance:0.5}]),
  M("succubus","魅魔",250,"elite","🦇",[{itemId:"mat_shadow",chance:0.6}]),
  M("lich","巫妖",270,"elite","☠️",[{itemId:"mat_shadow",chance:0.7}]),
  M("doom_lord","末日領主",285,"elite","👹",[{itemId:"mat_shadow",chance:0.8}]),
  M("abyss_lord","永恆深淵",300,"boss","🐲",[{itemId:"mat_shadow",chance:1}]),
];

export const MONSTER_INDEX: Record<string, Monster> = {};
MONSTERS.forEach(m => MONSTER_INDEX[m.id] = m);

// =========== Maps ============
export const MAPS: MapDef[] = [
  { id:"plain", name:"新手草原", minLevel:1, bg:"linear-gradient(180deg,#7ed957,#bff39e)", emoji:"🌾",
    monsters:["slime","rabbit","bee","boar","wolfpup","greenslime","plant","scarecrow","hornet"], boss:"plain_king" },
  { id:"forest", name:"森林遺跡", minLevel:10, bg:"linear-gradient(180deg,#3aa66b,#8fd6ad)", emoji:"🌲",
    monsters:["goblin","treant","spider","druid","wolf","ghost"], boss:"forest_lord" },
  { id:"cave", name:"黑暗洞窟", minLevel:25, bg:"linear-gradient(180deg,#2c2236,#5a4a72)", emoji:"🕳️",
    monsters:["bat","skeleton","zombie","minotaur","dark_knight"], boss:"cave_lord" },
  { id:"volcano", name:"熔岩火山", minLevel:50, bg:"linear-gradient(180deg,#7a1f1f,#e25822)", emoji:"🌋",
    monsters:["imp","magma","salamander","fire_giant","phoenix"], boss:"volcano_lord" },
  { id:"ice", name:"冰雪峽谷", minLevel:90, bg:"linear-gradient(180deg,#9ec8e8,#dff3ff)", emoji:"❄️",
    monsters:["snowfox","yeti","ice_witch","frost_wolf","frost_giant"], boss:"ice_dragon" },
  { id:"sky", name:"天空神殿", minLevel:130, bg:"linear-gradient(180deg,#f9d6a3,#fff7e3)", emoji:"☁️",
    monsters:["angel","seraph","griffin","paladin_g","god_guard"], boss:"sky_god" },
  { id:"abyss", name:"深淵魔城", minLevel:180, bg:"linear-gradient(180deg,#1a0a1f,#4a1e5b)", emoji:"🏰",
    monsters:["demon","abyss_knight","abyss_mage","hellhound","succubus","lich","doom_lord"], boss:"abyss_lord" },
];

export const MAP_INDEX: Record<string, MapDef> = {};
MAPS.forEach(m => MAP_INDEX[m.id] = m);

// =========== Quests ============
export const QUESTS: QuestDef[] = [
  { id:"main_1", type:"main", name:"踏出第一步", desc:"擊敗 5 隻史萊姆", target:{ type:"kill", id:"slime", count:5 }, reward:{ exp:80, gold:50 } },
  { id:"main_2", type:"main", name:"草原獵手", desc:"擊敗平原之王", target:{ type:"kill", id:"plain_king", count:1 }, reward:{ exp:300, gold:300, items:[{id:"hp_pot_m",count:3}] } },
  { id:"main_3", type:"main", name:"森林試煉", desc:"擊敗森林守護者", target:{ type:"kill", id:"forest_lord", count:1 }, reward:{ exp:1000, gold:800 } },
  { id:"main_4", type:"main", name:"火山征服", desc:"擊敗熔岩之主", target:{ type:"kill", id:"volcano_lord", count:1 }, reward:{ exp:5000, gold:3000 } },
  { id:"main_5", type:"main", name:"終結深淵", desc:"擊敗永恆深淵", target:{ type:"kill", id:"abyss_lord", count:1 }, reward:{ exp:50000, gold:30000 } },
  { id:"side_1", type:"side", name:"狩獵入門", desc:"累積擊殺 30 隻怪物", target:{ type:"kill", count:30 }, reward:{ exp:200, gold:200 } },
  { id:"side_2", type:"side", name:"成長之路", desc:"達到 20 級", target:{ type:"level", count:20 }, reward:{ exp:500, gold:500 } },
  { id:"side_3", type:"side", name:"百戰之名", desc:"累積擊殺 200 隻怪物", target:{ type:"kill", count:200 }, reward:{ exp:3000, gold:2000 } },
  { id:"daily_1", type:"daily", name:"每日狩獵", desc:"今日擊敗 20 隻怪物", target:{ type:"kill", count:20 }, reward:{ exp:500, gold:500, items:[{id:"hp_pot_m",count:2}] } },
  { id:"daily_2", type:"daily", name:"每日精英", desc:"今日擊敗 5 隻精英", target:{ type:"kill", count:5 }, reward:{ exp:1000, gold:800 } },
];

// =========== Achievements ============
export const ACHIEVEMENTS: Achievement[] = [
  { id:"first_blood", name:"初次擊殺", desc:"擊殺第一隻怪物", check:s=>s.totalKills>=1, reward:{ title:"新手冒險者" } },
  { id:"kill_100", name:"百戰", desc:"累積擊殺 100", check:s=>s.totalKills>=100, reward:{ title:"怪物獵人" } },
  { id:"kill_1000", name:"千殺", desc:"累積擊殺 1000", check:s=>s.totalKills>=1000, reward:{ gold:5000 } },
  { id:"lv50", name:"老練冒險者", desc:"達到 50 級", check:s=>s.level>=50 },
  { id:"lv100", name:"百級英雄", desc:"達到 100 級", check:s=>s.level>=100, reward:{ title:"傳奇英雄" } },
  { id:"lv200", name:"超凡入聖", desc:"達到 200 級", check:s=>s.level>=200 },
  { id:"abyss10", name:"深淵入門", desc:"通關深淵塔 10 層", check:s=>s.abyssFloor>=10 },
  { id:"abyss50", name:"深淵高手", desc:"通關深淵塔 50 層", check:s=>s.abyssFloor>=50, reward:{ title:"深淵征服者" } },
  { id:"abyss100", name:"深淵之王", desc:"通關深淵塔 100 層", check:s=>s.abyssFloor>=100 },
  { id:"rich", name:"小富翁", desc:"擁有 10000 金幣", check:s=>s.gold>=10000 },
];

export const TITLES: Record<string, TitleDef> = {
  "新手冒險者": { id:"新手冒險者", name:"新手冒險者", desc:"HP+30", bonus:{ hp:30 } },
  "怪物獵人": { id:"怪物獵人", name:"怪物獵人", desc:"物攻+10", bonus:{ patk:10 } },
  "深淵征服者": { id:"深淵征服者", name:"深淵征服者", desc:"全攻+30 HP+200", bonus:{ patk:30, matk:30, hp:200 } },
  "傳奇英雄": { id:"傳奇英雄", name:"傳奇英雄", desc:"全屬性大幅提升", bonus:{ patk:50, matk:50, hp:500, mp:200, crit:5 } },
};
