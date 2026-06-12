import { CLASSES, SKILLS, derive, expForLevel, MONSTER_INDEX, MAP_INDEX, rollEquip, ITEM_INDEX, QUESTS, ACHIEVEMENTS, TITLES, CONSUMES, MATERIALS } from "./data";
import type { ClassKey, Gender, PlayerSave, InventoryStack, EquipItem, EquipSlot, Item, Monster, DerivedStats, Skill, Stats } from "./types";

export function newSave(slot: number, name: string, classKey: ClassKey, gender: Gender): PlayerSave {
  const c = CLASSES[classKey];
  const save: PlayerSave = {
    slot, name, classKey, gender,
    level: 1, exp: 0, statPoints: 0, skillPoints: 0,
    stats: { ...c.base },
    hp: 0, mp: 0, gold: 100,
    inventory: [],
    equipped: {},
    skills: {},
    mapId: "plain",
    questsActive: { "main_1": 0, "side_1": 0, "side_2": 0 },
    questsDone: [],
    questsClaimedDaily: {},
    killCount: {},
    totalKills: 0,
    achievements: [],
    titles: [],
    activeTitle: undefined,
    abyssFloor: 0,
    abyssClaims: [],
    playTime: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  // Give a basic skill
  const firstActive = SKILLS[classKey].find(s => s.type === "active");
  if (firstActive) save.skills[firstActive.id] = 1;
  // starter potions
  addItem(save, ITEM_INDEX["hp_pot_s"], 5);
  addItem(save, ITEM_INDEX["mp_pot_s"], 3);
  const d = computeDerived(save);
  save.hp = d.hp; save.mp = d.mp;
  return save;
}

export function computeDerived(save: PlayerSave): DerivedStats {
  const passiveBonus: Partial<DerivedStats> = {};
  for (const [sid, lv] of Object.entries(save.skills)) {
    const sk = SKILLS[save.classKey].find(s => s.id === sid);
    if (sk && sk.type === "passive" && sk.passive) {
      const b = sk.passive(lv);
      for (const [k, v] of Object.entries(b)) (passiveBonus as any)[k] = ((passiveBonus as any)[k] || 0) + v;
    }
  }
  const titleBonus = save.activeTitle && TITLES[save.activeTitle] ? TITLES[save.activeTitle].bonus : {};
  return derive(save.stats, save.level, save.classKey, save.equipped, passiveBonus, titleBonus);
}

export function addExp(save: PlayerSave, amount: number): { leveled: number } {
  let leveled = 0;
  save.exp += amount;
  while (save.level < 300) {
    const need = expForLevel(save.level + 1);
    if (save.exp >= need) {
      save.exp -= need;
      save.level += 1;
      leveled++;
      save.statPoints += 5;
      save.skillPoints += 1;
      // class growth
      const g = CLASSES[save.classKey].growth;
      save.stats.str += g.str; save.stats.agi += g.agi; save.stats.int += g.int;
      save.stats.vit += g.vit; save.stats.luk += g.luk;
      const d = computeDerived(save);
      save.hp = d.hp; save.mp = d.mp;
    } else break;
  }
  return { leveled };
}

export function addItem(save: PlayerSave, item: Item, count = 1) {
  if (item.kind === "equip") {
    save.inventory.push({ uid: `iv_${Math.random().toString(36).slice(2,9)}`, item, count: 1 });
  } else {
    const exist = save.inventory.find(s => s.item.kind === item.kind && s.item.id === item.id);
    if (exist) exist.count += count;
    else save.inventory.push({ uid: `iv_${Math.random().toString(36).slice(2,9)}`, item, count });
  }
}

export function removeStack(save: PlayerSave, uid: string, count = 1) {
  const idx = save.inventory.findIndex(s => s.uid === uid);
  if (idx < 0) return;
  save.inventory[idx].count -= count;
  if (save.inventory[idx].count <= 0) save.inventory.splice(idx, 1);
}

export function equip(save: PlayerSave, uid: string) {
  const stack = save.inventory.find(s => s.uid === uid);
  if (!stack || stack.item.kind !== "equip") return;
  const eq = stack.item;
  const prev = save.equipped[eq.slot];
  save.equipped[eq.slot] = eq;
  removeStack(save, uid, 1);
  if (prev) addItem(save, prev, 1);
}

export function unequip(save: PlayerSave, slot: EquipSlot) {
  const eq = save.equipped[slot]; if (!eq) return;
  delete save.equipped[slot];
  addItem(save, eq, 1);
}

export function sellStack(save: PlayerSave, uid: string, count: number) {
  const stack = save.inventory.find(s => s.uid === uid);
  if (!stack) return;
  const n = Math.min(count, stack.count);
  save.gold += stack.item.price * n;
  removeStack(save, uid, n);
}

export function useConsume(save: PlayerSave, uid: string) {
  const stack = save.inventory.find(s => s.uid === uid);
  if (!stack || stack.item.kind !== "consume") return;
  const eff = stack.item.effect;
  const d = computeDerived(save);
  if (eff.hp) save.hp = Math.min(d.hp, save.hp + eff.hp);
  if (eff.mp) save.mp = Math.min(d.mp, save.mp + eff.mp);
  removeStack(save, uid, 1);
}

export function allocStat(save: PlayerSave, key: keyof Stats) {
  if (save.statPoints <= 0) return;
  save.stats[key] += 1;
  save.statPoints -= 1;
}

export function learnSkill(save: PlayerSave, sid: string): string | null {
  if (save.skillPoints <= 0) return "技能點不足";
  const sk = SKILLS[save.classKey].find(s => s.id === sid);
  if (!sk) return null;
  const cur = save.skills[sid] || 0;
  if (cur >= sk.maxLv) return "已滿級";
  if (sk.requires) {
    for (const r of sk.requires) {
      if ((save.skills[r.id] || 0) < r.lv) return "前置技能不足";
    }
  }
  save.skills[sid] = cur + 1;
  save.skillPoints -= 1;
  return null;
}

// ============= Battle =============
export interface BattleLogLine { t: number; text: string; dmg?: number; crit?: boolean; isPlayer?: boolean; }
export interface BattleState {
  enemy: { ref: Monster; hp: number; maxHp: number };
  log: BattleLogLine[];
  turn: number;
  ended: boolean;
  victory?: boolean;
  rewards?: { exp: number; gold: number; items: Item[] };
}

export function startBattle(save: PlayerSave, monster: Monster): BattleState {
  return {
    enemy: { ref: monster, hp: monster.hp, maxHp: monster.hp },
    log: [{ t: Date.now(), text: `遭遇 ${monster.name} Lv.${monster.level}!` }],
    turn: 0,
    ended: false,
  };
}

function rng() { return Math.random(); }

export function playerAction(save: PlayerSave, bs: BattleState, action: { kind: "attack" } | { kind: "skill"; id: string } | { kind: "item"; uid: string }): BattleState {
  if (bs.ended) return bs;
  const d = computeDerived(save);
  let dmg = 0; let crit = false; let text = "";
  if (action.kind === "attack") {
    const base = d.patk;
    crit = rng()*100 < d.crit;
    dmg = Math.max(1, Math.floor((base - bs.enemy.ref.def*0.6) * (crit ? 1.8 : 1) * (0.9 + Math.random()*0.2)));
    text = `你普通攻擊，造成 ${dmg} 傷害${crit?"（暴擊！）":""}`;
  } else if (action.kind === "skill") {
    const sk = SKILLS[save.classKey].find(s => s.id === action.id);
    if (!sk || sk.type !== "active") return bs;
    const lv = save.skills[sk.id] || 0; if (lv<=0) return bs;
    const cost = sk.cost!(lv);
    if (save.mp < cost) {
      bs.log.push({ t: Date.now(), text: "MP 不足！", isPlayer: true });
      return { ...bs };
    }
    save.mp -= cost;
    const base = (sk.element === "magic" ? d.matk : d.patk) * sk.power!(lv);
    crit = rng()*100 < d.crit;
    dmg = Math.max(1, Math.floor((base - bs.enemy.ref.def*0.4) * (crit ? 1.8 : 1) * (0.9 + Math.random()*0.2)));
    text = `使用「${sk.name}」造成 ${dmg} 傷害${crit?"（暴擊！）":""}`;
  } else if (action.kind === "item") {
    useConsume(save, action.uid);
    text = "使用了道具";
  }
  bs.enemy.hp -= dmg;
  bs.log.push({ t: Date.now(), text, dmg, crit, isPlayer: true });
  if (bs.enemy.hp <= 0) {
    bs.enemy.hp = 0;
    return finishBattle(save, bs, true);
  }
  // enemy turn
  const eva = rng()*100 < d.eva;
  if (eva) {
    bs.log.push({ t: Date.now(), text: `${bs.enemy.ref.name} 攻擊，但被你閃避！` });
  } else {
    const edmg = Math.max(1, Math.floor((bs.enemy.ref.atk - d.pdef*0.6) * (0.9 + Math.random()*0.2)));
    save.hp -= edmg;
    bs.log.push({ t: Date.now(), text: `${bs.enemy.ref.name} 攻擊，造成 ${edmg} 傷害`, dmg: edmg });
    if (save.hp <= 0) {
      save.hp = Math.floor(computeDerived(save).hp * 0.3);
      bs.log.push({ t: Date.now(), text: "你倒下了…復活並回到城鎮" });
      return finishBattle(save, bs, false);
    }
  }
  bs.turn += 1;
  return { ...bs };
}

function finishBattle(save: PlayerSave, bs: BattleState, victory: boolean): BattleState {
  bs.ended = true; bs.victory = victory;
  if (victory) {
    const m = bs.enemy.ref;
    const items: Item[] = [];
    for (const drop of m.drops) {
      if (Math.random() < drop.chance) {
        const it = ITEM_INDEX[drop.itemId];
        if (it) { addItem(save, it, 1); items.push(it); }
      }
    }
    // equipment drop chance
    const eqChance = m.kind === "boss" ? 1 : m.kind === "elite" ? 0.35 : 0.1;
    if (Math.random() < eqChance) {
      const slots: EquipSlot[] = ["weapon","helmet","armor","gloves","boots","necklace","ring"];
      const slot = slots[Math.floor(Math.random()*slots.length)];
      const q = m.kind === "boss" ? (Math.random()<0.3?"legend":"epic") : undefined;
      const eq = rollEquip(slot, m.level, q as any);
      addItem(save, eq, 1);
      items.push(eq);
    }
    save.gold += m.gold;
    const r = addExp(save, m.exp);
    bs.rewards = { exp: m.exp, gold: m.gold, items };
    if (r.leveled) bs.log.push({ t: Date.now(), text: `升級！現在 Lv.${save.level}` });
    // counters
    save.totalKills += 1;
    save.killCount[m.id] = (save.killCount[m.id] || 0) + 1;
    // quests progress
    progressQuests(save, m.id, m.kind);
    // achievements
    checkAchievements(save);
  }
  return { ...bs };
}

export function progressQuests(save: PlayerSave, monsterId?: string, kind?: Monster["kind"]) {
  for (const q of QUESTS) {
    if (save.questsDone.includes(q.id) && q.type !== "daily") continue;
    if (q.type === "daily") {
      const today = new Date().toDateString();
      if (save.questsClaimedDaily[q.id] === today) continue;
    }
    const cur = save.questsActive[q.id];
    if (cur === undefined && q.type === "main") continue; // main must be active
    let progress = cur ?? 0;
    if (q.target.type === "kill") {
      if (q.id === "daily_2") { if (kind === "elite" || kind === "boss") progress++; }
      else if (q.target.id) { if (monsterId === q.target.id) progress++; }
      else progress++;
    } else if (q.target.type === "level") {
      progress = save.level;
    }
    save.questsActive[q.id] = progress;
  }
}

export function claimQuest(save: PlayerSave, qid: string): string | null {
  const q = QUESTS.find(x=>x.id===qid); if (!q) return "任務不存在";
  const cur = save.questsActive[qid] ?? 0;
  if (cur < q.target.count) return "未完成";
  if (q.reward.exp) addExp(save, q.reward.exp);
  if (q.reward.gold) save.gold += q.reward.gold;
  if (q.reward.items) for (const it of q.reward.items) { const item = ITEM_INDEX[it.id]; if (item) addItem(save, item, it.count); }
  delete save.questsActive[qid];
  if (q.type === "daily") {
    save.questsClaimedDaily[qid] = new Date().toDateString();
  } else {
    save.questsDone.push(qid);
    // unlock next main
    const idx = QUESTS.findIndex(x=>x.id===qid);
    const next = QUESTS.slice(idx+1).find(x=>x.type===q.type);
    if (next && !save.questsDone.includes(next.id)) save.questsActive[next.id] = 0;
  }
  checkAchievements(save);
  return null;
}

export function checkAchievements(save: PlayerSave) {
  for (const a of ACHIEVEMENTS) {
    if (save.achievements.includes(a.id)) continue;
    if (a.check(save)) {
      save.achievements.push(a.id);
      if (a.reward?.title) {
        if (!save.titles.includes(a.reward.title)) save.titles.push(a.reward.title);
      }
      if (a.reward?.gold) save.gold += a.reward.gold;
    }
  }
}

export function resetDailyIfNeeded(save: PlayerSave) {
  const today = new Date().toDateString();
  for (const q of QUESTS.filter(x=>x.type==="daily")) {
    if (save.questsClaimedDaily[q.id] !== today) {
      // make sure active progress slot exists
      if (save.questsActive[q.id] === undefined) save.questsActive[q.id] = 0;
    }
  }
}

// Abyss tower monster generator
export function abyssMonster(floor: number): Monster {
  const isBoss = floor % 10 === 0;
  const lv = Math.min(300, 5 + floor * 3);
  const k = isBoss ? 10 : 1.5;
  const icons = ["👹","💀","🐉","🦂","🦇","☠️","🐲","🦴"];
  return {
    id: `abyss_${floor}`,
    name: isBoss ? `深淵之主・第${floor}層` : `深淵守衛${floor}`,
    level: lv, kind: isBoss?"boss":"elite", icon: icons[floor%icons.length],
    hp: Math.floor((50 + lv*30) * k),
    atk: Math.floor((10 + lv*2.5) * (isBoss?1.4:1)),
    def: Math.floor((4 + lv*1.2) * (isBoss?1.3:1)),
    exp: Math.floor((30 + lv*15) * (isBoss?2:1)),
    gold: Math.floor((20 + lv*8) * (isBoss?3:1)),
    drops: isBoss ? [{itemId:"mat_shadow",chance:1},{itemId:"mat_crystal",chance:1}] : [{itemId:"mat_crystal",chance:0.5}],
  };
}

// Shop stock
export function shopStock() {
  const eqs: EquipItem[] = [];
  const slots: EquipSlot[] = ["weapon","helmet","armor","gloves","boots","necklace","ring"];
  for (let i=0;i<6;i++) eqs.push(rollEquip(slots[i%slots.length], 5 + i*8));
  return { consumes: CONSUMES, equips: eqs };
}
