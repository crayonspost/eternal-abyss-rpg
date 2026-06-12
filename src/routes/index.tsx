import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CLASSES, SKILLS, MAPS, MAP_INDEX, MONSTER_INDEX, QUESTS,
  ACHIEVEMENTS, TITLES, QUALITY_COLOR, QUALITY_NAME, SLOT_INFO,
} from "../game/data";
import type {
  PlayerSave, ClassKey, Gender, InventoryStack, EquipItem,
  EquipSlot, Item, Settings, Skill, Stats,
} from "../game/types";
import {
  newSave, computeDerived, addItem, equip, unequip, sellStack,
  useConsume, allocStat, learnSkill, startBattle, playerAction,
  abyssMonster, shopStock, resetDailyIfNeeded, claimQuest,
  checkAchievements, type BattleState,
} from "../game/engine";
import {
  loadSlot, saveSlot, deleteSlot, loadSettings, saveSettings,
  exportSave, importSave,
} from "../game/storage";
import { sfx, setAudioFlags, startBgm, stopBgm } from "../game/audio";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "永恆深淵 Eternal Abyss - 單機網頁 RPG" },
      { name: "description", content: "Q版日系奇幻單機網頁 RPG，7 種職業、深淵塔挑戰、自動回合戰鬥，全程離線可玩。" },
      { property: "og:title", content: "永恆深淵 Eternal Abyss" },
      { property: "og:description", content: "Q版日系奇幻單機網頁 RPG。" },
    ],
  }),
  component: Game,
});

type View = "title" | "select_slot" | "create" | "town";
type TownTab = "home" | "char" | "bag" | "skill" | "shop" | "dungeon" | "abyss" | "quest" | "achv" | "settings";

function Game() {
  const [view, setView] = useState<View>("title");
  const [save, setSave] = useState<PlayerSave | null>(null);
  const [slot, setSlot] = useState<number>(1);
  const [tab, setTab] = useState<TownTab>("home");
  const [settings, setSettings] = useState<Settings>(() => (typeof window !== "undefined" ? loadSettings() : { bgm:true, sfx:true, quality:"mid" }));
  const [, forceTick] = useState(0);
  const rerender = useCallback(()=>forceTick(t=>t+1),[]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(()=>setToast(null), 2200);
  }, []);

  // Audio init
  useEffect(()=>{
    if (typeof window === "undefined") return;
    setAudioFlags(settings.bgm, settings.sfx);
    if (settings.bgm && view === "town") startBgm(); else stopBgm();
    return () => stopBgm();
  }, [settings.bgm, settings.sfx, view]);

  // Autosave
  useEffect(()=>{
    if (!save) return;
    const id = window.setInterval(()=>{ saveSlot(save); }, 8000);
    return ()=>clearInterval(id);
  }, [save]);
  useEffect(()=>{
    if (save) { resetDailyIfNeeded(save); checkAchievements(save); saveSlot(save); }
  }, [save?.slot]);
  // Save on unload
  useEffect(()=>{
    if (!save) return;
    const h = ()=>saveSlot(save);
    window.addEventListener("beforeunload", h);
    return ()=>window.removeEventListener("beforeunload", h);
  }, [save]);

  const loadAndEnter = (s: PlayerSave) => {
    resetDailyIfNeeded(s);
    setSave(s); setView("town"); setTab("home");
    sfx("click");
  };

  // ============ Title screen ============
  if (view === "title") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="ea-panel p-8 max-w-md w-full text-center fade-in">
          <div className="text-7xl mb-2 glow">🐲</div>
          <h1 className="text-4xl font-black tracking-wider mb-1" style={{color:"oklch(0.85 0.18 75)"}}>永恆深淵</h1>
          <p className="text-sm text-muted-foreground mb-1">Eternal Abyss</p>
          <p className="text-xs text-muted-foreground mb-8">Q版單機奇幻 RPG ・ 完全離線</p>
          <button className="ea-btn w-full mb-3" onClick={()=>{sfx("click"); setView("select_slot");}}>進入遊戲</button>
          <p className="text-xs text-muted-foreground mt-4">支援手機 ・ 自動存檔 ・ 純前端</p>
        </div>
        {toast && <Toast text={toast} />}
      </div>
    );
  }

  // ============ Slot select ============
  if (view === "select_slot") {
    return <SlotSelect
      onBack={()=>setView("title")}
      onNew={(s)=>{ setSlot(s); setView("create"); }}
      onLoad={(s)=>{ const sv=loadSlot(s); if (sv) loadAndEnter(sv); else showToast("此存檔不存在"); }}
      onDelete={(s)=>{ deleteSlot(s); showToast("已刪除存檔"); rerender(); }}
      onImport={(s, str)=>{
        const sv = importSave(str);
        if (sv) { sv.slot = s; saveSlot(sv); loadAndEnter(sv); }
        else showToast("匯入失敗");
      }}
    />;
  }

  // ============ Create character ============
  if (view === "create") {
    return <CreateChar
      onBack={()=>setView("select_slot")}
      onConfirm={(classKey, gender, name)=>{
        const sv = newSave(slot, name, classKey, gender);
        saveSlot(sv); loadAndEnter(sv);
      }}
    />;
  }

  // ============ Town ============
  if (!save) { return null; }

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar save={save} settings={settings} onTitle={()=>{ saveSlot(save); stopBgm(); setSave(null); setView("title"); }} />
      <div className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-4">
        <Tabs tab={tab} setTab={(t)=>{sfx("click"); setTab(t);}} />
        <div className="mt-3 fade-in" key={tab}>
          {tab === "home" && <HomeView save={save} setTab={setTab} />}
          {tab === "char" && <CharView save={save} update={rerender} />}
          {tab === "bag"  && <BagView save={save} update={rerender} toast={showToast} />}
          {tab === "skill" && <SkillView save={save} update={rerender} toast={showToast} />}
          {tab === "shop" && <ShopView save={save} update={rerender} toast={showToast} />}
          {tab === "dungeon" && <DungeonView save={save} update={rerender} toast={showToast} />}
          {tab === "abyss" && <AbyssView save={save} update={rerender} toast={showToast} />}
          {tab === "quest" && <QuestView save={save} update={rerender} toast={showToast} />}
          {tab === "achv" && <AchvView save={save} update={rerender} />}
          {tab === "settings" && <SettingsView save={save} settings={settings} setSettings={(s)=>{setSettings(s); saveSettings(s);}} toast={showToast} />}
        </div>
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}

// ============ Components ============
function Toast({ text }: { text: string }) {
  return <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 ea-panel px-4 py-2 fade-in text-sm">{text}</div>;
}

function TopBar({ save, settings, onTitle }: { save: PlayerSave; settings: Settings; onTitle: ()=>void }) {
  const d = computeDerived(save);
  const need = expNeed(save.level + 1);
  const c = CLASSES[save.classKey];
  return (
    <div className="ea-panel m-3 sm:m-4 p-3 flex items-center gap-3 sticky top-2 z-30">
      <div className="text-3xl" style={{filter:"drop-shadow(0 2px 4px #000a)"}}>{c.emoji[save.gender]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <div className="font-bold truncate">{save.name}</div>
          {save.activeTitle && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">{save.activeTitle}</span>}
        </div>
        <div className="text-xs text-muted-foreground">Lv.{save.level} {c.name} ・ 💰{save.gold.toLocaleString()}</div>
        <div className="flex gap-1 mt-1">
          <div className="ea-bar hp flex-1"><span style={{width:`${Math.max(0,save.hp)/d.hp*100}%`}} /><div className="label">{Math.max(0,save.hp)}/{d.hp}</div></div>
          <div className="ea-bar mp flex-1"><span style={{width:`${Math.max(0,save.mp)/d.mp*100}%`}} /><div className="label">{Math.max(0,save.mp)}/{d.mp}</div></div>
        </div>
        <div className="ea-bar exp mt-1"><span style={{width:`${Math.min(100,save.exp/Math.max(1,need)*100)}%`}} /><div className="label">EXP {save.exp}/{need}</div></div>
      </div>
      <button className="ea-btn secondary sm" onClick={onTitle}>主選單</button>
    </div>
  );
}

function expNeed(lv: number) { return Math.floor(50 * Math.pow(lv, 1.85)); }

function Tabs({ tab, setTab }: { tab: TownTab; setTab: (t: TownTab)=>void }) {
  const tabs: { k: TownTab; n: string; i: string }[] = [
    { k:"home", n:"主頁", i:"🏠" },
    { k:"char", n:"角色", i:"🧙" },
    { k:"bag",  n:"背包", i:"🎒" },
    { k:"skill",n:"技能", i:"✨" },
    { k:"shop", n:"商店", i:"🛒" },
    { k:"dungeon", n:"副本", i:"⚔️" },
    { k:"abyss",n:"深淵塔", i:"🗼" },
    { k:"quest",n:"任務", i:"📜" },
    { k:"achv", n:"成就", i:"🏆" },
    { k:"settings", n:"設定", i:"⚙️" },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {tabs.map(t=>(
        <button key={t.k} className={`ea-tab ${tab===t.k?"active":""}`} onClick={()=>setTab(t.k)}>
          <span className="mr-1">{t.i}</span><span className="hidden sm:inline">{t.n}</span>
        </button>
      ))}
    </div>
  );
}

// =============== Slot Select ===============
function SlotSelect({ onBack, onNew, onLoad, onDelete, onImport }: {
  onBack: ()=>void;
  onNew: (slot:number)=>void;
  onLoad: (slot:number)=>void;
  onDelete: (slot:number)=>void;
  onImport: (slot:number, str:string)=>void;
}) {
  const [importText, setImportText] = useState<{slot:number, text:string} | null>(null);
  const slots = [1,2,3].map(s=>({ slot: s, data: loadSlot(s) }));
  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <div className="ea-panel p-6 w-full max-w-xl fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">選擇存檔</h2>
          <button className="ea-btn secondary sm" onClick={onBack}>返回</button>
        </div>
        <div className="space-y-3">
          {slots.map(({slot, data})=>(
            <div key={slot} className="ea-card p-3">
              <div className="flex items-center gap-3">
                <div className="text-3xl">{data ? CLASSES[data.classKey].emoji[data.gender] : "❓"}</div>
                <div className="flex-1">
                  <div className="font-bold">存檔 {slot}</div>
                  {data ? (
                    <div className="text-xs text-muted-foreground">
                      {data.name} ・ Lv.{data.level} {CLASSES[data.classKey].name}
                      <br/>金幣 {data.gold.toLocaleString()} ・ 最後遊玩 {new Date(data.updatedAt).toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">空白</div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {data
                  ? <>
                      <button className="ea-btn sm" onClick={()=>onLoad(slot)}>讀取</button>
                      <button className="ea-btn danger sm" onClick={()=>{ if (confirm("確認刪除？")) onDelete(slot); }}>刪除</button>
                      <button className="ea-btn secondary sm" onClick={()=>{ const s = exportSave(data!); navigator.clipboard?.writeText(s); prompt("匯出存檔字串（已複製）：", s); }}>匯出</button>
                    </>
                  : <>
                      <button className="ea-btn sm" onClick={()=>onNew(slot)}>新遊戲</button>
                      <button className="ea-btn secondary sm" onClick={()=>setImportText({ slot, text: "" })}>匯入</button>
                    </>
                }
              </div>
            </div>
          ))}
        </div>
        {importText && (
          <div className="ea-card p-3 mt-3 space-y-2">
            <div className="text-sm">貼上存檔字串：</div>
            <textarea className="w-full p-2 bg-black/30 rounded border border-border text-xs" rows={4}
              value={importText.text} onChange={e=>setImportText({...importText, text:e.target.value})} />
            <div className="flex gap-2 justify-end">
              <button className="ea-btn secondary sm" onClick={()=>setImportText(null)}>取消</button>
              <button className="ea-btn sm" onClick={()=>{ onImport(importText.slot, importText.text); setImportText(null); }}>匯入</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// =============== Create Char ===============
function CreateChar({ onBack, onConfirm }: { onBack: ()=>void; onConfirm: (k: ClassKey, g: Gender, name: string)=>void }) {
  const [classKey, setClassKey] = useState<ClassKey>("warrior");
  const [gender, setGender] = useState<Gender>("male");
  const [name, setName] = useState("冒險者");
  const c = CLASSES[classKey];
  return (
    <div className="min-h-screen p-4 flex items-center justify-center">
      <div className="ea-panel p-6 w-full max-w-3xl fade-in">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">建立角色</h2>
          <button className="ea-btn secondary sm" onClick={onBack}>返回</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm mb-2 text-muted-foreground">選擇職業</div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CLASSES) as ClassKey[]).map(k=>{
                const cc = CLASSES[k];
                return (
                  <button key={k} onClick={()=>{sfx("click"); setClassKey(k);}}
                    className={`ea-card p-3 text-left ${classKey===k?"ring-2 ring-amber-400":""}`}>
                    <div className="text-2xl">{cc.emoji[gender]}</div>
                    <div className="font-bold">{cc.name}</div>
                    <div className="text-[11px] text-muted-foreground">{cc.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="char-card" style={{ ["--hue" as any]: hueOf(classKey) }}>
              <div className="portrait">{c.emoji[gender]}</div>
              <div className="text-center text-lg font-bold mt-2">{c.name}</div>
              <div className="text-center text-xs text-muted-foreground mb-3">{c.desc}</div>
              <div className="grid grid-cols-5 gap-1 text-xs text-center">
                <Stat label="STR" v={c.base.str} />
                <Stat label="AGI" v={c.base.agi} />
                <Stat label="INT" v={c.base.int} />
                <Stat label="VIT" v={c.base.vit} />
                <Stat label="LUK" v={c.base.luk} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm mb-2 text-muted-foreground">性別</div>
              <div className="flex gap-2">
                <button className={`ea-btn ${gender==="male"?"":"secondary"} flex-1`} onClick={()=>setGender("male")}>♂ 男</button>
                <button className={`ea-btn ${gender==="female"?"":"secondary"} flex-1`} onClick={()=>setGender("female")}>♀ 女</button>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-sm mb-2 text-muted-foreground">角色名稱</div>
              <input value={name} onChange={e=>setName(e.target.value.slice(0,12))}
                className="w-full p-2 bg-black/30 rounded border border-border" />
            </div>
            <button className="ea-btn w-full mt-4" disabled={!name.trim()}
              onClick={()=>{ sfx("levelup"); onConfirm(classKey, gender, name.trim() || "冒險者"); }}>
              開始冒險
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Stat({ label, v }: { label:string; v:number }) { return <div className="ea-card p-1"><div className="text-muted-foreground">{label}</div><div className="font-bold">{v}</div></div>; }
function hueOf(k: ClassKey): number {
  const map: Record<ClassKey, number> = { warrior:25, paladin:75, mage:245, warlock:295, archer:140, elf:110, assassin:280 };
  return map[k];
}

// =============== Home / Map ===============
function HomeView({ save, setTab }: { save: PlayerSave; setTab: (t: TownTab)=>void }) {
  const c = CLASSES[save.classKey];
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div className="md:col-span-1">
        <div className="char-card" style={{ ["--hue" as any]: hueOf(save.classKey) }}>
          <div className="portrait">{c.emoji[save.gender]}</div>
          <div className="text-center text-xl font-bold">{save.name}</div>
          <div className="text-center text-xs text-muted-foreground">Lv.{save.level} {c.name}</div>
          {save.activeTitle && <div className="text-center text-xs mt-1 text-amber-300">「{save.activeTitle}」</div>}
        </div>
        <div className="ea-card p-3 mt-3 text-sm space-y-1">
          <div>💰 金幣 {save.gold.toLocaleString()}</div>
          <div>⚔️ 累積擊殺 {save.totalKills}</div>
          <div>🗼 深淵塔 {save.abyssFloor} 層</div>
          <div>🏆 成就 {save.achievements.length}/{ACHIEVEMENTS.length}</div>
        </div>
      </div>
      <div className="md:col-span-2">
        <h3 className="text-lg font-bold mb-2">前往地圖</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {MAPS.map(m=>{
            const locked = save.level < m.minLevel;
            return (
              <div key={m.id} className="map-tile" style={{background: m.bg, opacity: locked?0.5:1}}
                onClick={()=>{ if(locked) return; sfx("click"); save.mapId = m.id; setTab("dungeon"); }}>
                <div className="text-3xl">{m.emoji}</div>
                <div className="font-bold text-lg">{m.name}</div>
                <div className="text-xs">建議 Lv.{m.minLevel}+</div>
                <div className="text-xs mt-1">{m.monsters.length} 種怪物 ・ BOSS</div>
                {locked && <div className="absolute right-3 top-3 text-2xl">🔒</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============== Character / Stats ===============
function CharView({ save, update }: { save: PlayerSave; update: ()=>void }) {
  const d = computeDerived(save);
  const c = CLASSES[save.classKey];
  const StatRow = ({ label, k }: { label: string; k: keyof Stats }) => (
    <div className="flex items-center justify-between py-1">
      <span>{label} <span className="text-muted-foreground">{save.stats[k]}</span></span>
      <button className="ea-btn sm" disabled={save.statPoints<=0} onClick={()=>{ allocStat(save, k); sfx("click"); update(); }}>+</button>
    </div>
  );
  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="ea-card p-3">
        <div className="flex items-center gap-3 mb-3">
          <div className="text-4xl">{c.emoji[save.gender]}</div>
          <div>
            <div className="font-bold">{save.name}</div>
            <div className="text-xs text-muted-foreground">Lv.{save.level} {c.name}</div>
          </div>
          <div className="ml-auto text-xs">
            <div>剩餘屬性點: <b className="text-amber-300">{save.statPoints}</b></div>
            <div>剩餘技能點: <b className="text-amber-300">{save.skillPoints}</b></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 text-sm">
          <StatRow label="力量 STR" k="str" />
          <StatRow label="敏捷 AGI" k="agi" />
          <StatRow label="智力 INT" k="int" />
          <StatRow label="體力 VIT" k="vit" />
          <StatRow label="幸運 LUK" k="luk" />
        </div>
        <hr className="my-3 border-border" />
        <div className="grid grid-cols-2 gap-x-4 text-sm">
          <div>❤️ HP: <b>{d.hp}</b></div>
          <div>💙 MP: <b>{d.mp}</b></div>
          <div>⚔️ 物攻: <b>{d.patk}</b></div>
          <div>🔮 魔攻: <b>{d.matk}</b></div>
          <div>🛡 物防: <b>{d.pdef}</b></div>
          <div>🌀 魔防: <b>{d.mdef}</b></div>
          <div>💥 暴擊: <b>{d.crit.toFixed(1)}%</b></div>
          <div>💨 閃避: <b>{d.eva.toFixed(1)}%</b></div>
        </div>
      </div>
      <div className="ea-card p-3">
        <div className="font-bold mb-2">裝備</div>
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(SLOT_INFO.names) as EquipSlot[]).map(slot=>{
            const e = save.equipped[slot];
            return (
              <div key={slot} className="ea-slot" title={SLOT_INFO.names[slot]} onClick={()=>{ if (e) { unequip(save, slot); update(); }}}>
                {e ? (
                  <>
                    <div className="q" style={{background: QUALITY_COLOR[e.quality]}} />
                    <span>{e.icon}</span>
                  </>
                ) : <span className="opacity-40 text-base">{SLOT_INFO.icons[slot]}</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 font-bold mb-2">稱號</div>
        <div className="flex flex-wrap gap-2">
          <button className={`ea-btn sm ${!save.activeTitle?"":"secondary"}`} onClick={()=>{ save.activeTitle=undefined; update(); }}>無</button>
          {save.titles.map(t=>(
            <button key={t} className={`ea-btn sm ${save.activeTitle===t?"":"secondary"}`}
              onClick={()=>{ save.activeTitle=t; update(); }}>{t}</button>
          ))}
          {save.titles.length===0 && <div className="text-xs text-muted-foreground">完成成就以解鎖稱號</div>}
        </div>
      </div>
    </div>
  );
}

// =============== Bag ===============
function BagView({ save, update, toast }: { save: PlayerSave; update: ()=>void; toast: (m:string)=>void }) {
  const [filter, setFilter] = useState<"all"|"equip"|"consume"|"material"|"quest">("all");
  const [sel, setSel] = useState<InventoryStack | null>(null);
  const filtered = save.inventory.filter(s => filter==="all" ? true : s.item.kind===filter);
  const sort = () => { save.inventory.sort((a,b)=>{
    const order = { equip:0, consume:1, material:2, quest:3 } as any;
    return order[a.item.kind] - order[b.item.kind] || a.item.name.localeCompare(b.item.name);
  }); update(); sfx("click"); };
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div className="md:col-span-2 ea-card p-3">
        <div className="flex flex-wrap gap-2 mb-2">
          {[["all","全部"],["equip","裝備"],["consume","消耗"],["material","材料"],["quest","任務"]].map(([k,n])=>(
            <button key={k} onClick={()=>setFilter(k as any)} className={`ea-btn sm ${filter===k?"":"secondary"}`}>{n}</button>
          ))}
          <button className="ea-btn sm secondary ml-auto" onClick={sort}>排序</button>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
          {filtered.map(s=>{
            const q = s.item.kind === "equip" ? (s.item as EquipItem).quality : "normal";
            return (
              <div key={s.uid} className="ea-slot" onClick={()=>{ sfx("click"); setSel(s); }}
                style={{borderColor: s.item.kind==="equip" ? QUALITY_COLOR[(s.item as EquipItem).quality] : undefined}}>
                <div className="q" style={{background: QUALITY_COLOR[q]}} />
                <span>{s.item.icon}</span>
                {s.count>1 && <span className="count">{s.count}</span>}
              </div>
            );
          })}
          {filtered.length===0 && <div className="col-span-full text-center text-muted-foreground py-6 text-sm">背包是空的</div>}
        </div>
      </div>
      <div className="ea-card p-3 min-h-[200px]">
        {sel ? (
          <ItemDetail stack={sel} save={save} onAction={()=>{ setSel(null); update(); }} toast={toast} />
        ) : <div className="text-muted-foreground text-sm text-center pt-10">點選物品查看詳細</div>}
      </div>
    </div>
  );
}

function ItemDetail({ stack, save, onAction, toast }: { stack: InventoryStack; save: PlayerSave; onAction: ()=>void; toast:(m:string)=>void }) {
  const it = stack.item;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="text-3xl">{it.icon}</div>
        <div>
          <div className="font-bold" style={{color: it.kind==="equip"?QUALITY_COLOR[(it as EquipItem).quality]:undefined}}>
            {it.name}
            {it.kind==="equip" && <span className="text-xs ml-1">[{QUALITY_NAME[(it as EquipItem).quality]}]</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {it.kind==="equip" ? `${SLOT_INFO.names[(it as EquipItem).slot]} ・ Lv.${(it as EquipItem).level}` : (it as any).desc}
          </div>
        </div>
      </div>
      {it.kind==="equip" && (
        <div className="text-xs space-y-0.5">
          {Object.entries((it as EquipItem).base).map(([k,v])=>(
            <div key={k}>+{v} {statName(k)}</div>
          ))}
          {(it as EquipItem).affixes.map((a,i)=>(
            <div key={i} className="text-emerald-300">+{a.value} {statName(a.key)}</div>
          ))}
        </div>
      )}
      <div className="text-xs text-muted-foreground">售價: 💰{it.price}</div>
      <div className="flex flex-wrap gap-2 pt-2">
        {it.kind==="equip" && <button className="ea-btn sm" onClick={()=>{ equip(save, stack.uid); sfx("loot"); toast("已裝備"); onAction(); }}>裝備</button>}
        {it.kind==="consume" && <button className="ea-btn sm" onClick={()=>{ useConsume(save, stack.uid); sfx("heal"); toast("已使用"); onAction(); }}>使用</button>}
        <button className="ea-btn sm danger" onClick={()=>{ sellStack(save, stack.uid, 1); sfx("loot"); toast(`出售 +${it.price}`); onAction(); }}>出售1</button>
        {stack.count>1 && <button className="ea-btn sm danger" onClick={()=>{ const n=stack.count; sellStack(save, stack.uid, n); sfx("loot"); toast(`全部出售 +${it.price*n}`); onAction(); }}>全部出售</button>}
      </div>
    </div>
  );
}
function statName(k: string) {
  const m: Record<string,string> = { hp:"HP", mp:"MP", patk:"物攻", matk:"魔攻", pdef:"物防", mdef:"魔防", crit:"暴擊", eva:"閃避" };
  return m[k] || k;
}

// =============== Skill tree ===============
function SkillView({ save, update, toast }: { save: PlayerSave; update: ()=>void; toast: (m:string)=>void }) {
  const list = SKILLS[save.classKey];
  const tiers: Skill["tier"][] = ["basic","mid","high","ultimate"];
  const tierName = { basic:"初級", mid:"中級", high:"高級", ultimate:"終極" } as const;
  return (
    <div className="ea-card p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="font-bold">技能樹 ({CLASSES[save.classKey].name})</div>
        <div className="text-sm">剩餘技能點: <b className="text-amber-300">{save.skillPoints}</b></div>
      </div>
      <div className="space-y-4">
        {tiers.map(tier=>(
          <div key={tier}>
            <div className="text-sm font-bold mb-2 text-amber-300">{tierName[tier]}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {list.filter(s=>s.tier===tier).map(s=>{
                const lv = save.skills[s.id] || 0;
                const unmet = (s.requires||[]).some(r=>(save.skills[r.id]||0)<r.lv);
                return (
                  <div key={s.id} className={`ea-card p-2 ${unmet&&lv===0?"opacity-50":""}`}>
                    <div className="flex items-center gap-1">
                      <div className="text-xl">{s.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{s.name}</div>
                        <div className="text-[10px] text-muted-foreground">{s.type==="active"?"主動":"被動"} ・ {lv}/{s.maxLv}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground my-1 h-8 overflow-hidden">{s.desc(Math.max(1,lv))}</div>
                    <button className="ea-btn sm w-full" disabled={lv>=s.maxLv || save.skillPoints<=0 || unmet}
                      onClick={()=>{ const err=learnSkill(save, s.id); if (err) toast(err); else { sfx("levelup"); update(); } }}>
                      {lv===0?"學習":"升級"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============== Shop ===============
function ShopView({ save, update, toast }: { save: PlayerSave; update:()=>void; toast:(m:string)=>void }) {
  const [stock, setStock] = useState(()=>shopStock());
  const refresh = () => { if (save.gold<100) return toast("刷新需要 100 金"); save.gold-=100; setStock(shopStock()); sfx("click"); update(); };
  const buy = (it: Item) => {
    if (save.gold < it.price*2) return toast("金幣不足");
    save.gold -= it.price*2; addItem(save, it, 1); sfx("loot"); toast(`購買: ${it.name}`); update();
  };
  return (
    <div className="ea-card p-3">
      <div className="flex justify-between items-center mb-3">
        <div className="font-bold">商店</div>
        <button className="ea-btn sm secondary" onClick={refresh}>刷新裝備 (💰100)</button>
      </div>
      <div className="text-sm font-bold mb-1">消耗品</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
        {stock.consumes.map(c=>(
          <div key={c.id} className="ea-card p-2 flex items-center gap-2">
            <div className="text-2xl">{c.icon}</div>
            <div className="flex-1">
              <div className="text-sm font-bold">{c.name}</div>
              <div className="text-[11px] text-muted-foreground">{c.desc}</div>
              <div className="text-xs">💰{c.price*2}</div>
            </div>
            <button className="ea-btn sm" onClick={()=>buy(c)}>購買</button>
          </div>
        ))}
      </div>
      <div className="text-sm font-bold mb-1">裝備</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stock.equips.map(e=>(
          <div key={e.id} className="ea-card p-2 flex items-center gap-2" style={{borderColor: QUALITY_COLOR[e.quality]}}>
            <div className="text-2xl">{e.icon}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate" style={{color: QUALITY_COLOR[e.quality]}}>{e.name}</div>
              <div className="text-[11px]">Lv.{e.level} ・ {QUALITY_NAME[e.quality]}</div>
              <div className="text-xs">💰{e.price*2}</div>
            </div>
            <button className="ea-btn sm" onClick={()=>buy(e)}>購買</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============== Dungeon / Battle ===============
function DungeonView({ save, update, toast }: { save: PlayerSave; update:()=>void; toast:(m:string)=>void }) {
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [shake, setShake] = useState(false);
  const [floats, setFloats] = useState<{ id:number; v:number; crit?:boolean; isHeal?:boolean }[]>([]);
  const floatId = useRef(0);

  const map = MAP_INDEX[save.mapId] || MAPS[0];
  const startWith = (monsterId: string) => {
    const m = MONSTER_INDEX[monsterId];
    if (!m) return;
    sfx(m.kind==="boss"?"boss":"click");
    setBattle(startBattle(save, m));
  };

  const doAction = (act: any) => {
    if (!battle) return;
    const before = battle.enemy.hp;
    const next = playerAction(save, battle, act);
    const dmg = before - next.enemy.hp;
    if (dmg > 0) {
      floatId.current++;
      const last = next.log[next.log.length-1] || next.log[next.log.length-2];
      const crit = !!last?.crit;
      setFloats(f=>[...f, { id: floatId.current, v: dmg, crit }]);
      setShake(true); setTimeout(()=>setShake(false), 400);
      sfx(crit?"crit":"hit");
    }
    setBattle({...next});
    update();
  };

  // remove floats
  useEffect(()=>{
    if (floats.length===0) return;
    const t = setTimeout(()=>setFloats(f=>f.slice(1)), 1000);
    return ()=>clearTimeout(t);
  }, [floats]);

  if (battle) {
    const d = computeDerived(save);
    return (
      <div className="ea-card p-0 overflow-hidden">
        <div className="p-4 text-center" style={{background: map.bg, minHeight: 280, position:"relative"}}>
          <div className="text-sm text-white/90" style={{textShadow:"0 1px 2px #000"}}>{map.name}</div>
          <div className={`text-7xl mt-4 inline-block relative ${shake?"shake":""}`} style={{filter:"drop-shadow(0 6px 8px #000a)"}}>
            {battle.enemy.ref.icon}
            {floats.map(f=>(
              <span key={f.id} className={`float-dmg ${f.crit?"crit":""}`}>{f.v}</span>
            ))}
          </div>
          <div className="mt-3 text-white" style={{textShadow:"0 1px 2px #000"}}>
            <div className="font-bold">{battle.enemy.ref.name} Lv.{battle.enemy.ref.level}</div>
            <div className="ea-bar hp max-w-xs mx-auto mt-1"><span style={{width:`${battle.enemy.hp/battle.enemy.maxHp*100}%`}}/>
              <div className="label">{battle.enemy.hp}/{battle.enemy.maxHp}</div></div>
          </div>
        </div>
        <div className="p-3">
          <div className="h-28 overflow-y-auto text-xs space-y-1 ea-card p-2 mb-2">
            {battle.log.slice(-10).map((l,i)=>(
              <div key={i} className={l.isPlayer?"text-amber-200":"text-red-200"}>{l.text}</div>
            ))}
          </div>
          {battle.ended ? (
            <div className="space-y-2">
              <div className="text-center font-bold">{battle.victory ? "🎉 勝利！" : "💀 戰敗"}</div>
              {battle.victory && battle.rewards && (
                <div className="text-sm text-center">
                  +{battle.rewards.exp} EXP ・ +{battle.rewards.gold} 💰
                  {battle.rewards.items.length>0 && (
                    <div className="text-xs mt-1">
                      獲得: {battle.rewards.items.map((i,idx)=><span key={idx} className="mx-1">{i.icon}{i.name}</span>)}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <button className="ea-btn" onClick={()=>setBattle(null)}>返回</button>
                {battle.victory && <button className="ea-btn secondary" onClick={()=>startWith(battle.enemy.ref.id)}>再戰</button>}
              </div>
            </div>
          ) : (
            <ActionPanel save={save} onAct={doAction} />
          )}
        </div>
      </div>
    );
  }

  // pre-battle map view
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MAPS.map(m=>(
          <button key={m.id} onClick={()=>{ if (save.level<m.minLevel) return toast("等級不足"); save.mapId=m.id; update(); sfx("click"); }}
            className={`ea-btn sm ${save.mapId===m.id?"":"secondary"}`}>{m.emoji} {m.name}</button>
        ))}
      </div>
      <div className="ea-card p-3" style={{background: map.bg+",rgba(0,0,0,.3)"}}>
        <div className="font-bold text-white" style={{textShadow:"0 1px 2px #000"}}>{map.name} ・ 建議 Lv.{map.minLevel}+</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {map.monsters.map(id=>{
          const m = MONSTER_INDEX[id];
          return (
            <div key={id} className="ea-card p-2 flex items-center gap-2">
              <div className="text-3xl">{m.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold truncate">{m.name}{m.kind==="elite" && <span className="text-amber-300"> ★</span>}</div>
                <div className="text-[11px] text-muted-foreground">Lv.{m.level} ・ HP {m.hp}</div>
              </div>
              <button className="ea-btn sm" onClick={()=>startWith(id)}>挑戰</button>
            </div>
          );
        })}
        <div className="ea-card p-2 flex items-center gap-2 col-span-full border-amber-400 border-2">
          <div className="text-3xl">{MONSTER_INDEX[map.boss].icon}</div>
          <div className="flex-1">
            <div className="text-sm font-bold text-amber-300">BOSS ・ {MONSTER_INDEX[map.boss].name}</div>
            <div className="text-[11px] text-muted-foreground">Lv.{MONSTER_INDEX[map.boss].level} ・ HP {MONSTER_INDEX[map.boss].hp}</div>
          </div>
          <button className="ea-btn" onClick={()=>startWith(map.boss)}>挑戰 BOSS</button>
        </div>
      </div>
    </div>
  );
}

function ActionPanel({ save, onAct }: { save: PlayerSave; onAct: (a:any)=>void }) {
  const [showSkill, setShowSkill] = useState(false);
  const [showItem, setShowItem] = useState(false);
  const skills = SKILLS[save.classKey].filter(s=>s.type==="active" && (save.skills[s.id]||0)>0);
  const consumes = save.inventory.filter(s=>s.item.kind==="consume");
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button className="ea-btn flex-1" onClick={()=>onAct({kind:"attack"})}>普攻</button>
        <button className="ea-btn flex-1 secondary" onClick={()=>{ setShowSkill(s=>!s); setShowItem(false); }}>技能</button>
        <button className="ea-btn flex-1 secondary" onClick={()=>{ setShowItem(s=>!s); setShowSkill(false); }}>道具</button>
      </div>
      {showSkill && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {skills.length===0 && <div className="col-span-full text-xs text-muted-foreground text-center py-2">尚未學習主動技能</div>}
          {skills.map(s=>{
            const lv = save.skills[s.id]; const cost = s.cost!(lv);
            return (
              <button key={s.id} className="ea-btn sm" disabled={save.mp<cost} onClick={()=>{ onAct({kind:"skill", id:s.id}); setShowSkill(false); }}>
                {s.icon} {s.name}<span className="text-[10px] ml-1 opacity-80">MP{cost}</span>
              </button>
            );
          })}
        </div>
      )}
      {showItem && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
          {consumes.length===0 && <div className="col-span-full text-xs text-muted-foreground text-center py-2">沒有可用道具</div>}
          {consumes.map(s=>(
            <button key={s.uid} className="ea-btn sm secondary" onClick={()=>{ onAct({kind:"item", uid:s.uid}); setShowItem(false); }}>
              {s.item.icon} {s.item.name} x{s.count}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// =============== Abyss Tower ===============
function AbyssView({ save, update, toast }: { save: PlayerSave; update:()=>void; toast:(m:string)=>void }) {
  const [floor, setFloor] = useState(Math.min(100, save.abyssFloor+1));
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [shake, setShake] = useState(false);
  const [floats, setFloats] = useState<{ id:number; v:number; crit?:boolean }[]>([]);
  const floatId = useRef(0);

  const start = (f: number) => {
    const m = abyssMonster(f);
    sfx(f%10===0?"boss":"click");
    setBattle(startBattle(save, m));
    setFloor(f);
  };
  const doAction = (act: any) => {
    if (!battle) return;
    const before = battle.enemy.hp;
    const next = playerAction(save, battle, act);
    const dmg = before - next.enemy.hp;
    if (dmg>0) {
      floatId.current++;
      const crit = !!(next.log[next.log.length-1]?.crit || next.log[next.log.length-2]?.crit);
      setFloats(f=>[...f,{id:floatId.current, v:dmg, crit}]);
      setShake(true); setTimeout(()=>setShake(false), 400);
      sfx(crit?"crit":"hit");
    }
    if (next.ended && next.victory) {
      if (floor > save.abyssFloor) {
        save.abyssFloor = floor;
        if (!save.abyssClaims.includes(floor)) {
          save.abyssClaims.push(floor);
          save.gold += floor * 50;
          if (floor % 10 === 0) {
            const eq = (next.rewards?.items || []);
            toast(`首通第${floor}層！額外獎勵 ${floor*50} 金`);
          }
        }
        checkAchievements(save);
      }
    }
    setBattle({...next});
    update();
  };
  useEffect(()=>{
    if (floats.length===0) return;
    const t = setTimeout(()=>setFloats(f=>f.slice(1)), 1000);
    return ()=>clearTimeout(t);
  }, [floats]);

  if (battle) {
    return (
      <div className="ea-card p-0 overflow-hidden">
        <div className="p-4 text-center" style={{background:"linear-gradient(180deg,#1a0a1f,#4a1e5b)", minHeight: 280, position:"relative"}}>
          <div className="text-sm text-white/90">深淵塔 第 {floor} 層</div>
          <div className={`text-7xl mt-4 inline-block relative ${shake?"shake":""}`}>
            {battle.enemy.ref.icon}
            {floats.map(f=>(<span key={f.id} className={`float-dmg ${f.crit?"crit":""}`}>{f.v}</span>))}
          </div>
          <div className="mt-3 text-white">
            <div className="font-bold">{battle.enemy.ref.name}</div>
            <div className="ea-bar hp max-w-xs mx-auto mt-1"><span style={{width:`${battle.enemy.hp/battle.enemy.maxHp*100}%`}}/><div className="label">{battle.enemy.hp}/{battle.enemy.maxHp}</div></div>
          </div>
        </div>
        <div className="p-3">
          <div className="h-28 overflow-y-auto text-xs space-y-1 ea-card p-2 mb-2">
            {battle.log.slice(-10).map((l,i)=>(<div key={i} className={l.isPlayer?"text-amber-200":"text-red-200"}>{l.text}</div>))}
          </div>
          {battle.ended ? (
            <div className="text-center space-y-2">
              <div className="font-bold">{battle.victory?"🎉 通過！":"💀 戰敗"}</div>
              {battle.victory && battle.rewards && <div className="text-sm">+{battle.rewards.exp} EXP ・ +{battle.rewards.gold} 💰</div>}
              <div className="flex gap-2 justify-center">
                <button className="ea-btn secondary" onClick={()=>setBattle(null)}>返回</button>
                {battle.victory && floor<100 && <button className="ea-btn" onClick={()=>start(floor+1)}>下一層</button>}
              </div>
            </div>
          ) : <ActionPanel save={save} onAct={doAction} />}
        </div>
      </div>
    );
  }

  const next = Math.min(100, save.abyssFloor + 1);
  return (
    <div className="ea-card p-3">
      <div className="font-bold mb-1">🗼 永恆深淵塔</div>
      <div className="text-xs text-muted-foreground mb-3">最高紀錄：第 {save.abyssFloor} 層 / 100 ・ 每 10 層有 BOSS ・ 首通給予金幣獎勵</div>
      <div className="mb-3 flex gap-2">
        <button className="ea-btn" onClick={()=>start(next)}>挑戰第 {next} 層</button>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 max-h-72 overflow-y-auto">
        {Array.from({length:100},(_,i)=>i+1).map(f=>{
          const cleared = f<=save.abyssFloor;
          const boss = f%10===0;
          return (
            <button key={f} onClick={()=>{ if (f<=save.abyssFloor+1) start(f); else toast("尚未解鎖"); }}
              className={`aspect-square rounded text-xs font-bold ${cleared?"bg-amber-500/30 text-amber-200":"bg-black/30 text-muted-foreground"} ${boss?"border-2 border-red-400":""}`}>
              {f}{boss?"👑":""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============== Quest ===============
function QuestView({ save, update, toast }: { save: PlayerSave; update:()=>void; toast:(m:string)=>void }) {
  const today = new Date().toDateString();
  const cat = (type: "main"|"side"|"daily") => QUESTS.filter(q=>q.type===type);
  const status = (q: typeof QUESTS[number]) => {
    if (q.type==="daily" && save.questsClaimedDaily[q.id]===today) return "今日已完成";
    if (save.questsDone.includes(q.id)) return "已完成";
    const cur = save.questsActive[q.id];
    if (cur===undefined) return "未開放";
    return `${cur}/${q.target.count}`;
  };
  const canClaim = (q: typeof QUESTS[number]) => {
    const cur = save.questsActive[q.id]; if (cur===undefined) return false;
    return cur >= q.target.count;
  };
  const Row = ({q}:{q: typeof QUESTS[number]}) => (
    <div className="ea-card p-2 flex items-center gap-2">
      <div className="flex-1">
        <div className="font-bold text-sm">{q.name} <span className="text-[10px] text-muted-foreground">[{q.type==="main"?"主線":q.type==="side"?"支線":"每日"}]</span></div>
        <div className="text-xs text-muted-foreground">{q.desc}</div>
        <div className="text-xs">獎勵: {q.reward.exp?`${q.reward.exp} EXP `:""}{q.reward.gold?`${q.reward.gold} 💰 `:""}{q.reward.items?.map(i=>`${i.id} x${i.count}`).join(" ")}</div>
      </div>
      <div className="text-xs text-right">
        <div>{status(q)}</div>
        <button className="ea-btn sm mt-1" disabled={!canClaim(q)} onClick={()=>{ const e=claimQuest(save,q.id); if (e) toast(e); else { sfx("loot"); toast("領取獎勵！"); update(); } }}>領取</button>
      </div>
    </div>
  );
  return (
    <div className="space-y-3">
      <div>
        <div className="text-sm font-bold mb-1 text-amber-300">主線任務</div>
        <div className="space-y-1">{cat("main").map(q=><Row key={q.id} q={q}/>)}</div>
      </div>
      <div>
        <div className="text-sm font-bold mb-1 text-amber-300">支線任務</div>
        <div className="space-y-1">{cat("side").map(q=><Row key={q.id} q={q}/>)}</div>
      </div>
      <div>
        <div className="text-sm font-bold mb-1 text-amber-300">每日任務</div>
        <div className="space-y-1">{cat("daily").map(q=><Row key={q.id} q={q}/>)}</div>
      </div>
    </div>
  );
}

// =============== Achievements ===============
function AchvView({ save, update }: { save: PlayerSave; update:()=>void }) {
  return (
    <div className="space-y-3">
      <div className="ea-card p-3">
        <div className="font-bold mb-2">🏆 成就 ({save.achievements.length}/{ACHIEVEMENTS.length})</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {ACHIEVEMENTS.map(a=>{
            const done = save.achievements.includes(a.id);
            return (
              <div key={a.id} className={`ea-card p-2 ${done?"":"opacity-60"}`}>
                <div className="text-sm font-bold">{done?"✅":"⬜"} {a.name}</div>
                <div className="text-xs text-muted-foreground">{a.desc}</div>
                {a.reward?.title && <div className="text-xs text-amber-300">稱號：{a.reward.title}</div>}
                {a.reward?.gold && <div className="text-xs text-amber-300">+{a.reward.gold} 金幣</div>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="ea-card p-3">
        <div className="font-bold mb-2">🏷️ 我的稱號</div>
        <div className="grid sm:grid-cols-2 gap-2">
          {save.titles.length===0 && <div className="text-xs text-muted-foreground">尚未獲得任何稱號</div>}
          {save.titles.map(t=>{
            const def = TITLES[t];
            return (
              <div key={t} className={`ea-card p-2 ${save.activeTitle===t?"ring-2 ring-amber-400":""}`}>
                <div className="text-sm font-bold">{t}</div>
                <div className="text-xs text-muted-foreground">{def?.desc}</div>
                <button className="ea-btn sm mt-1" onClick={()=>{ save.activeTitle = save.activeTitle===t?undefined:t; update(); }}>
                  {save.activeTitle===t?"卸下":"配戴"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============== Settings ===============
function SettingsView({ save, settings, setSettings, toast }: { save: PlayerSave; settings: Settings; setSettings:(s:Settings)=>void; toast:(m:string)=>void }) {
  return (
    <div className="ea-card p-3 space-y-3">
      <div>
        <div className="font-bold mb-2">音效</div>
        <label className="flex items-center justify-between py-1">
          <span>背景音樂</span>
          <input type="checkbox" checked={settings.bgm} onChange={e=>setSettings({...settings, bgm:e.target.checked})} />
        </label>
        <label className="flex items-center justify-between py-1">
          <span>音效</span>
          <input type="checkbox" checked={settings.sfx} onChange={e=>setSettings({...settings, sfx:e.target.checked})} />
        </label>
      </div>
      <div>
        <div className="font-bold mb-2">畫質</div>
        <div className="flex gap-2">
          {(["low","mid","high"] as const).map(q=>(
            <button key={q} className={`ea-btn sm ${settings.quality===q?"":"secondary"}`} onClick={()=>setSettings({...settings, quality:q})}>{q==="low"?"低":q==="mid"?"中":"高"}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="font-bold mb-2">存檔管理</div>
        <div className="flex flex-wrap gap-2">
          <button className="ea-btn sm" onClick={()=>{ saveSlot(save); toast("已存檔"); sfx("click"); }}>立即存檔</button>
          <button className="ea-btn sm secondary" onClick={()=>{
            const s = exportSave(save);
            navigator.clipboard?.writeText(s);
            prompt("存檔字串已複製：", s);
          }}>匯出存檔</button>
          <button className="ea-btn sm danger" onClick={()=>{
            if (!confirm("確認刪除此存檔？")) return;
            deleteSlot(save.slot); location.reload();
          }}>刪除存檔</button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground pt-2 border-t border-border">
        永恆深淵 Eternal Abyss v1.0 ・ 純前端單機 ・ 資料儲存於本機 LocalStorage
      </div>
    </div>
  );
}
