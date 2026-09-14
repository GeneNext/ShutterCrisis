// ============================================================
// 游戏引擎（确定性模拟 · 与 UI 解耦，可在 Node 冒烟测试中直接驱动）
// 节奏：一天 = 一回合 = 8+ 个时段；四幕 = 晨会 / 营业 / 结算 / 深夜
// 回合钩子顺序对齐 Doc/原型设定-V2.md §9.2：
//   10 预约结转 → 20 员工日检 → 30 市场/AI → 40 事件生成 →
//   50 动线时段结算 → 60 店铺等级评审 → 100 现金流结算 → 随机事件
// 记账口径：行动支出（广告/团建/客服赔偿等）发生时即扣现金并计入
//   todayVar；夜间结算只补扣「固定成本 + 耗材」，避免重复扣款。
// ============================================================
import {
  mulberry32, roll, FACILITIES, TIER_NAMES, FORMS, FORM_RENOVATE, ORDERS, CROWDS,
  PRICING, WALKIN_POLICY, CHANNELS, CONTENT_TOPICS, POSTS, TRAITS, QUALS, QUAL_COST,
  STAGES as STAFF_STAGES, STATIONS, GRADES, storeValue, HANDS, QUARREL_CUSTOMERS,
  REVIEWERS, REVIEW_TIERS, AI_STAGES, AI_SUB_COST, RESCUE_DEALS, RESCUE_COOLDOWN,
  EVENTS, SERVICE_EVENTS, MILESTONES, AWARD_TYPES, SURNAMES, GIVEN, MAP, HAND_TALK,
} from './catalogs.js'

const SLOTS_BASE = 8
const RENT_PER_CELL = 2.5
const UTIL_PER_CELL = 0.8
const DEPRECIATION = 0.006
const AI_HIT_PRICE = { id: 0.5, portrait: 0.85, product: 0.9 }
const AI_HIT_FROM = { id: 0, portrait: 1, product: 3 }

// ---------------- 工具 ----------------
const find = (arr, k) => arr.find((x) => x.key === k)
const ordOf = (k) => find(ORDERS, k)
const crowdOf = (i) => CROWDS[i]
export const day = (s) => s.round + 1
const nameOf = (rnd) => SURNAMES[Math.floor(rnd() * SURNAMES.length)] + GIVEN[Math.floor(rnd() * GIVEN.length)]
export function fmt(n) { return Math.round(n).toLocaleString('en-US') }
function clampRep(v) { return Math.max(0, Math.min(5, v)) }
const eventEff = (s, key, dft) => {
  let v = dft
  for (const e of Object.values(s.timedEffects)) if (e.eff[key] != null) v *= e.eff[key]
  return v
}
const hasEvent = (s, key) => Object.values(s.timedEffects).some((e) => e.eff[key] != null)
export const cashflowState = (s) => {
  if (s.cash < 0) return 'broken'
  const fixed = s.lastFixedCost || 1
  if (s.cash < fixed * 7) return 'danger'
  if (s.cash < fixed * 30) return 'tight'
  return 'healthy'
}
export const slotsPerDay = (s) => Math.min(SLOTS_BASE + (s.fac.reception - 1), 12)
const marketWage = (postKey) => find(POSTS, postKey).wage
// 店面面积（格）：初始 6×8；向右 +2×8/次，向后 +6×3，二楼 +6×8
export function areaCells(s) {
  return s.grid.w * s.grid.h + s.grid.right * 16 + (s.grid.back ? 18 : 0) + (s.grid.second ? 48 : 0)
}
// 每日固定成本明细（成本计算单一出口，结算与 UI 预览共用）
export function fixedCostBreakdown(s) {
  const cells = areaCells(s)
  const rent = Math.round(cells * RENT_PER_CELL * eventEff(s, 'rentMul', 1))
  const formsRent = Object.values(s.forms).reduce((a, v) => a + (v === 1 ? 8 : v === 2 ? 22 : 0), 0)
  const utilities = Math.round(cells * UTIL_PER_CELL)
  const wages = s.staff.reduce((a, e) => a + e.wage, 0)
  let equipInvested = 0
  for (const f of FACILITIES) if (f.cat === 'equip') for (let lv = 2; lv <= s.fac[f.key]; lv++) equipInvested += f.upCost[lv]
  const depreciation = Math.round(equipInvested * DEPRECIATION)
  const ai = s.ai.subscribed ? AI_SUB_COST : 0
  return { cells, rent, formsRent, utilities, wages, depreciation, ai, total: rent + formsRent + utilities + wages + depreciation + ai }
}
// 扩张确认对照（§7.4 硬规则：一次性投入 / 新增日固定支出 vs 近 3 日均收入 / 回本天数）
export function expandPreview(s, dir) {
  const specs = {
    right:  { cost: 8000 * (1 + s.grid.right), needGrade: 2, days: 2, cellsAdd: 16, name: `向右扩店（第 ${s.grid.right + 1} 次，+2×8 格）` },
    back:   { cost: 20000, needGrade: 3, days: 3, cellsAdd: 18, name: '向后扩店（+6×3 格）' },
    second: { cost: 50000, needGrade: 4, days: 5, cellsAdd: 48, name: '加盖二楼（+6×8 格）' },
  }
  const spec = specs[dir]
  if (!spec) return null
  const addFixedPerDay = Math.round(spec.cellsAdd * RENT_PER_CELL + spec.cellsAdd * UTIL_PER_CELL)
  const n = Math.min(3, s.reportHistory.length)
  const recentDailyIncome = n ? Math.round(s.reportHistory.slice(0, n).reduce((a, r) => a + r.income, 0) / n) : 0
  const unavailable = (dir === 'back' && s.grid.back) || (dir === 'second' && s.grid.second)
    ? '已完成该方向扩张'
    : s.grade < spec.needGrade ? `需要店铺 ${spec.needGrade}★` : null
  return {
    dir, name: spec.name, cost: spec.cost, needGrade: spec.needGrade, days: spec.days,
    cellsAdd: spec.cellsAdd, addFixedPerDay, recentDailyIncome,
    paybackDays: recentDailyIncome > addFixedPerDay ? Math.ceil(spec.cost / (recentDailyIncome - addFixedPerDay)) : null,
    unavailable,
  }
}
const postStaff = (s, post) => s.staff.filter((e) => e.post === post && !e.resting && !e.dayOff)
// 老板亲自顶岗（§5.6 亲力亲为）：某岗位无人在岗时，老板顶一个工位（技能按 1 计，消耗精力）
function workersOf(s, post) {
  const list = postStaff(s, post)
  if (list.length > 0) return list
  if (s.boss.style === 'hands_on' && s.boss.energy > 0) {
    return [{ id: 0, skill: 1, name: '老板（亲自顶岗）', trait: 'solid', quals: [] }]
  }
  return []
}
const inConstruct = (s, zone) => s.renovations.some((r) => r.zone === zone)
const effMul = (s) => (s.constructionDays > 0 ? 0.5 : 1)
const zoneCapOf = (s, zone) => {
  const bonus = s.forms[zone] === 1 ? FORM_RENOVATE[1].capBonus : s.forms[zone] === 2 ? FORM_RENOVATE[2].capBonus : 0
  return (s.fac[zone] || 0) + bonus
}
function toast(s, kind, text, money) {
  s.toasts.push({ id: s.seq++, kind, text, money: money || 0, day: day(s) })
}

// ---------------- 新档 ----------------
export function createGame(seed = 20260914) {
  const s = {
    seed, seq: 1, round: 0, phase: 'briefing', slot: 0, ended: null,
    cash: 10000, reputation: 2.0, fans: 0, grade: 1,
    fac: {}, forms: {}, renovations: [],
    grid: { w: 6, h: 8, right: 0, back: false, second: false },
    constructionDays: 0,
    priceTier: 'normal', walkinPolicy: 'balanced',
    staff: [], candidates: [], staffSeq: 0, orderSeq: 0,
    appointments: [], schedule: {},
    activeOrders: [], works: [], workSeq: 0,
    todayIncome: 0, todayFixed: 0, todayVar: 0, todayLoss: 0, lastFixedCost: 200,
    lossCauses: [], todayServed: 0, todayRetained: 0, todaySpread: 0, todaySpreads: [],
    pendingRetained: [],
    reportHistory: [], weeklyReports: [], lastWeekNet: null,
    weekAcc: { income: 0, loss: 0, retained: 0, spread: 0, days: 0 },
    streakPos: 0, negativeDays: 0, totalRevenue: 0, delivered: 0, deliveredBy: {}, bestWorkQuality: 0,
    inbox: [], inboxSeq: 1, quarrelsToday: 0, quarrelWinStreak: 0, quarrel: null, lastQuarrelDay: -9,
    reviewDoneDay: -9, reviewTiers: [], serviceEventFallback: 0, reviewPulse: 0,
    ai: { stage: 0, subscribed: false }, irreplaceable: 10, replacePower: 0,
    adsToday: [], publishedDay: -9, consolesToday: 0, skillPoints: 0,
    timedEffects: {}, rescue: { entitled: false, cooldownUntil: 0, usedCount: 0 },
    boss: { energy: 100, style: 'hands_on' },
    milestones: [], awards: [], lastAwardDay: 0,
    toasts: [], celebrate: [], frames: [], slotIncome: [], manualShot: {},
    stayReport: [], walkinForecast: 0, slotsTotal: SLOTS_BASE, reshootPending: 0,
    totalRetained: 0, totalSpread: 0, goodReviews: 0, bestDayIncome: 0,
    complaintsBacklog: 0, complaintsToday: 0, autoCalmed: 0, complaintAlertDay: 0,
    locKey: 'street', locPriceMul: 1, orderBoost: {}, stars: 0,
  }
  for (const f of FACILITIES) s.fac[f.key] = 1
  for (const z of Object.keys(FORMS)) s.forms[z] = 0
  s.roomsBuilt = {}
  for (const z of Object.keys(FORMS)) s.roomsBuilt[z] = 1
  s.pendingRush = false
  s.pendingQuarrel = null
  // 开局班底：1 名成长型摄影师（教学锚）+ 1 名普通客服
  hireGenerated(s, 'photographer', 'growth'); s.staff[0].skill = 2
  hireGenerated(s, 'service', 'normal')
  refreshCandidates(s)
  genIntake(s)
  return s
}

// ---------------- 员工生成 ----------------
function makeStaff(s, post, talent, rnd) {
  s.staffSeq++
  const trait = TRAITS[Math.floor(rnd() * TRAITS.length)]
  const skill = 1 + Math.floor(rnd() * 2)
  const pot = talent === 'growth' ? 5 : 2 + Math.floor(rnd() * 2)
  return {
    id: s.staffSeq, name: nameOf(rnd), post, skill, potential: pot, quals: [],
    energy: 100, wage: Math.round(marketWage(post) * (talent === 'growth' ? 1.4 : 1)),
    trait: trait.key, talent, stage: 'rookie', served: 0,
    hiredDay: day(s), resting: false, dayOff: false, leaving: false, retained: false,
  }
}
function hireGenerated(s, post, talent) {
  const rnd = mulberry32((s.seed + s.staffSeq * 131 + s.round * 17) >>> 0)
  s.staff.push(makeStaff(s, post, talent, rnd))
}
export function refreshCandidates(s) {
  const rnd = mulberry32((s.seed + 7777 + s.round * 31) >>> 0)
  s.candidates = []
  for (let i = 0; i < 3; i++) {
    const post = POSTS[Math.floor(rnd() * POSTS.length)].key
    const talent = rnd() < 0.18 ? 'growth' : 'normal'
    s.candidates.push(makeStaff(s, post, talent, rnd))
  }
}
function restage(s, e) {
  for (const st of STAFF_STAGES) if (st.need(e)) e.stage = st.key
}

// ---------------- 产能 ----------------
export function stationCapacity(s, stationKey) {
  const st = find(STATIONS, stationKey)
  const rooms = (s.roomsBuilt && s.roomsBuilt[st.zone]) != null ? s.roomsBuilt[st.zone] : 1
  const constructMul = inConstruct(s, st.zone) ? 0.5 : 1
  return Math.min(Math.floor(rooms * constructMul), workersOf(s, st.post).length)
}
export function roomsCapLeft(s, zone) {
  const cap = Math.min(s.grade + 1, 5)
  return cap - ((s.roomsBuilt && s.roomsBuilt[zone]) || 0)
}
export function qualityCeiling(s) {
  return Math.min(1, 0.3 + (s.fac.camera + s.fac.lens + s.fac.light + s.fac.backdrop) * 0.045 + (s.forms.studio || 0) * 0.06)
}
export function requirementMissing(s, o) {
  if (o.unlock.grade && s.grade < o.unlock.grade) return `需要店铺 ${o.unlock.grade}★`
  if (o.unlock.fac) for (const [k, v] of Object.entries(o.unlock.fac)) if ((s.fac[k] || 0) < v) return `需要 ${find(FACILITIES, k).name} ≥${v} 级`
  if (o.unlock.quals) for (const q of o.unlock.quals) if (!s.staff.some((e) => e.quals.includes(q))) return `需要持「${q}」专精的员工（员工页培训解锁）`
  if (o.unlock.forms) for (const z of o.unlock.forms) if ((s.forms[z] || 0) < 1) return `需要「${FORMS[z][1]}」（场地页形态改造）`
  return null
}
export function isReviewDay(s) { return day(s) % 7 === 3 }
export function toneOf(s) {
  const brand = { 亲民: 0, 专业: 0, 艺术: 0, 网红: 0, 硬气: 0 }
  for (const k of s.adsToday) { const ch = find(CHANNELS, k); if (ch) brand[ch.brand] += 1 }
  brand[find(PRICING, s.priceTier).brand] += 2
  if (s.forms.makeup >= 1) brand['专业'] += 1
  if (s.reviewTiers.includes('god')) brand['艺术'] += 1
  return Object.entries(brand).sort((a, b) => b[1] - a[1])[0][0]
}
function locPrice(s, orderKey, base) {
  return Math.round(base * (s.locPriceMul || 1) * (s.orderBoost && s.orderBoost[orderKey] ? s.orderBoost[orderKey] : 1))
}
function noShowRisk(s, crowd) {
  let p = 0.12
  if (crowd.key === 'street') p += 0.08
  if (crowd.key === 'star') p -= 0.05
  if (s.reputation >= 4) p -= 0.05
  return Math.max(0.03, Math.min(0.35, p))
}
function aiPriceMul(s, orderKey) {
  const from = AI_HIT_FROM[orderKey]
  if (from != null && s.ai.stage >= from) return AI_HIT_PRICE[orderKey] ?? 1
  return 1
}
function avgOrderPrice(s) {
  const pool = ORDERS.filter((o) => !requirementMissing(s, o))
  return Math.round((pool.reduce((a, o) => a + o.price, 0) / Math.max(1, pool.length)) * find(PRICING, s.priceTier).mul)
}

// ---------------- 老板行动 ----------------
export function act(s, action, ...args) {
  if (s.ended) return { ok: false, err: '游戏已结束' }
  const A = ACTIONS[action]
  if (!A) return { ok: false, err: '未知行动: ' + action }
  return A(s, ...args)
}

const ACTIONS = {
  setPrice(s, tierKey) {
    if (!find(PRICING, tierKey)) return { ok: false, err: '未知定价档' }
    s.priceTier = tierKey
    return { ok: true }
  },
  setWalkInPolicy(s, key) {
    if (!find(WALKIN_POLICY, key)) return { ok: false, err: '未知分流档' }
    s.walkinPolicy = key
    return { ok: true }
  },
  upgradeFacility(s, key) {
    const f = find(FACILITIES, key)
    const lv = s.fac[key]
    const cap = Math.min(s.grade + 1, 5)
    if (lv >= 5) return { ok: false, err: '已满级' }
    if (lv >= cap) return { ok: false, err: `${f.name} 受店铺等级限制（当前上限 ${cap} 级，升星解锁）` }
    if (f.minGrade && s.grade < f.minGrade) return { ok: false, err: `需要店铺 ${f.minGrade}★` }
    const cost = f.upCost[lv + 1]
    if (s.cash < cost) return { ok: false, err: '现金不足' }
    s.cash -= cost
    s.fac[key] = lv + 1
    const nextName = TIER_NAMES[key] ? TIER_NAMES[key][lv] : null
    const inc = f.cat === 'zone' ? (key === 'reception' ? '每日时段 +1' : key === 'rest' ? '精力恢复 +1/时段' : '并发容量 +1') : '质量上限 +'
    toast(s, 'buy', `${f.name} → ${lv + 1} 级${nextName ? '：' + nextName : ''}（${inc}）`, -cost)
    return { ok: true, text: `${f.name} → ${lv + 1} 级`, inc }
  },
  renovateFacility(s, zone, to) {
    if (!FORMS[zone] || to < 1 || to > 2) return { ok: false, err: '未知形态' }
    if (s.forms[zone] >= to) return { ok: false, err: '已是该形态' }
    const needGrade = to === 1 ? 3 : 5
    if (s.grade < needGrade) return { ok: false, err: `需要店铺 ${needGrade}★` }
    if (inConstruct(s, zone)) return { ok: false, err: '该分区施工中' }
    const spec = FORM_RENOVATE[to]
    if (s.cash < spec.cost) return { ok: false, err: '现金不足' }
    s.cash -= spec.cost
    s.renovations.push({ zone, to, daysLeft: spec.days })
    toast(s, 'buy', `开工：${FORMS[zone][to]}（工期 ${spec.days} 天，施工期该分区降效 50%）`, -spec.cost)
    return { ok: true }
  },
  buildRoom(s, key) {
    const f = FACILITIES.find((x) => x.key === key)
    if (!f || f.cat !== 'zone') return { ok: false, err: '该处不可建造房间' }
    const built = (s.roomsBuilt && s.roomsBuilt[key]) || 0
    const cap = Math.min(s.grade + 1, 5)
    if (built >= cap) return { ok: false, err: `房间数受店铺等级限制（当前上限 ${cap} 间，升星解锁）` }
    const cost = Math.round((f.upCost[2] || 900) * Math.pow(1.6, Math.max(0, built - 1)))
    if (s.cash < cost) return { ok: false, err: '现金不足' }
    s.cash -= cost
    s.roomsBuilt[key] = built + 1
    toast(s, 'buy', `${f.name} 新房间建成：并发容量 +1（现 ${built + 1} 间）`, -cost)
    return { ok: true }
  },
  sellEquipment(s, key) {
    const f = find(FACILITIES, key)
    if (!f || f.cat !== 'equip') return { ok: false, err: '只能变卖设备线' }
    const lv = s.fac[key]
    if (lv <= 1) return { ok: false, err: '已是最基础型号，无可卖' }
    const refund = Math.round(f.upCost[lv] * 0.4)
    s.fac[key] = lv - 1
    s.cash += refund
    toast(s, 'sell', `变卖 ${f.name}（${TIER_NAMES[key][lv - 1]}），回收 40%：+${refund}`, refund)
    return { ok: true, refund }
  },
  expandStudio(s, dir) {
    const costs = { right: 8000 * (1 + s.grid.right), back: 20000, second: 50000 }
    const grades = { right: 2, back: 3, second: 4 }
    if (!costs[dir]) return { ok: false, err: '未知方向' }
    if (s.grade < grades[dir]) return { ok: false, err: `需要店铺 ${grades[dir]}★` }
    if (dir === 'back' && s.grid.back) return { ok: false, err: '已向后扩张' }
    if (dir === 'second' && s.grid.second) return { ok: false, err: '已有二楼' }
    if (s.cash < costs[dir]) return { ok: false, err: '现金不足' }
    s.cash -= costs[dir]
    if (dir === 'right') s.grid.right++
    if (dir === 'back') s.grid.back = true
    if (dir === 'second') s.grid.second = true
    s.constructionDays = dir === 'right' ? 2 : dir === 'back' ? 3 : 5
    toast(s, 'buy', `扩店开工（工期 ${s.constructionDays} 天，全店降效 50%）`, -costs[dir])
    return { ok: true }
  },
  runAd(s, key) {
    const ch = find(CHANNELS, key)
    if (!ch) return { ok: false, err: '未知渠道' }
    if (s.grade < ch.grade) return { ok: false, err: `需要店铺 ${ch.grade}★ 解锁` }
    if (s.adsToday.includes(key)) return { ok: false, err: '今日已投放' }
    if (s.cash < ch.cost) return { ok: false, err: '现金不足' }
    s.cash -= ch.cost
    s.adsToday.push(key)
    s.todayVar += ch.cost
    s.fans += ch.fans
    toast(s, 'money', `投放 ${ch.name}：粉丝 +${ch.fans}`, -ch.cost)
    return { ok: true }
  },
  publishContent(s, workId, topicKey) {
    if (s.publishedDay === day(s)) return { ok: false, err: '每天只能发 1 条' }
    const w = s.works.find((x) => x.id === workId)
    if (!w) return { ok: false, err: '选择相册作品' }
    const topic = find(CONTENT_TOPICS, topicKey) || CONTENT_TOPICS[0]
    const gained = Math.round((10 + w.quality * 90) * topic.mul * (1 + s.fans / 4000))
    s.fans += gained
    s.publishedDay = day(s)
    toast(s, 'fans', `发布「${topic.name}」：粉丝 +${gained}`, 0)
    return { ok: true }
  },
  adoptAI(s, on) {
    s.ai.subscribed = !!on
    toast(s, on ? 'warn' : 'money', on ? '订阅 AI 修图（每日固定支出，修图环节自动化，不可替代度 -）' : '取消 AI 订阅', 0)
    return { ok: true }
  },
  hireStaff(s, candId) {
    const c = s.candidates.find((x) => x.id === candId)
    if (!c) return { ok: false, err: '候选人不存在' }
    const cap = [0, 2, 4, 6, 8, 10][s.grade]
    if (s.staff.length >= cap) return { ok: false, err: `员工上限 ${cap} 人（升星解锁）` }
    const hireCost = find(POSTS, c.post).hire * (c.talent === 'growth' ? 2 : 1)
    if (s.cash < hireCost) return { ok: false, err: '招聘费不足' }
    s.cash -= hireCost
    s.candidates = s.candidates.filter((x) => x.id !== candId)
    s.staff.push(c)
    toast(s, 'buy', `入职 ${c.name}（${find(POSTS, c.post).name}${c.talent === 'growth' ? '·成长型' : ''}）`, -hireCost)
    return { ok: true }
  },
  fireStaff(s, id) {
    const e = s.staff.find((x) => x.id === id)
    if (!e) return { ok: false, err: '员工不存在' }
    const severance = e.wage * 3
    if (s.cash < severance) return { ok: false, err: '遣散费不足（3 个月工资）' }
    s.cash -= severance
    s.staff = s.staff.filter((x) => x.id !== id)
    toast(s, 'sell', `解雇 ${e.name}，遣散费 ${severance}`, -severance)
    return { ok: true }
  },
  trainStaff(s, id, qual) {
    const e = s.staff.find((x) => x.id === id)
    if (!e) return { ok: false, err: '员工不存在' }
    if (!QUALS.includes(qual)) return { ok: false, err: '未知专精' }
    if (e.quals.includes(qual)) return { ok: false, err: '已持该专精' }
    const qualsCap = e.talent === 'growth' ? QUALS.length : 1
    if (e.quals.length >= qualsCap) return { ok: false, err: e.talent === 'growth' ? '专精已满' : '普通员工至多 1 门专精（成长型员工不限）' }
    if (e.skill < 2) return { ok: false, err: '技能 ≥2 才能进修' }
    if (s.cash < QUAL_COST) return { ok: false, err: '现金不足' }
    s.cash -= QUAL_COST
    e.quals.push(qual)
    restage(s, e)
    toast(s, 'buy', `${e.name} 修得「${qual}」专精${e.stage !== 'rookie' ? '，晋升' + find(STAFF_STAGES, e.stage).name : ''}`, -QUAL_COST)
    return { ok: true }
  },
  courseStaff(s, id) {
    const e = s.staff.find((x) => x.id === id)
    if (!e) return { ok: false, err: '员工不存在' }
    if (e.skill >= e.potential) return { ok: false, err: e.talent === 'growth' ? '技能未满前不设上限；已达当前成长上限' : '已达成长上限（普通员工上限低）' }
    const cost = 500 * e.skill
    if (s.cash < cost) return { ok: false, err: '现金不足' }
    s.cash -= cost
    e.skill++
    restage(s, e)
    toast(s, 'buy', `${e.name} 技能进修 → ${e.skill} 级`, -cost)
    return { ok: true }
  },
  retainStaff(s, id) {
    const e = s.staff.find((x) => x.id === id)
    if (!e) return { ok: false, err: '员工不存在' }
    e.wage = Math.round(e.wage * 1.2)
    e.retained = true
    toast(s, 'money', `给 ${e.name} 加薪 20%：对方决定留下来`, 0)
    return { ok: true }
  },
  restStaff(s, id) {
    const e = s.staff.find((x) => x.id === id)
    if (!e) return { ok: false, err: '员工不存在' }
    e.dayOff = true
    e.energy = Math.min(100, e.energy + 40)
    toast(s, 'money', `${e.name} 今日排休（精力 +40）`, 0)
    return { ok: true }
  },
  organizeTeamBuilding(s) {
    const cost = 300 * Math.max(1, s.staff.length)
    if (s.cash < cost) return { ok: false, err: '现金不足' }
    s.cash -= cost
    s.todayVar += cost
    for (const e of s.staff) { e.energy = Math.min(100, e.energy + 30); e.tbPlus = (e.tbPlus || 0) + 8 }
    toast(s, 'money', '团建完成：全员精力 +30，去留意愿 +', -cost)
    return { ok: true }
  },
  consoleStaff(s, id) {
    if (s.consolesToday >= 3) return { ok: false, err: '每天至多安抚 3 次' }
    const e = s.staff.find((x) => x.id === id)
    if (!e) return { ok: false, err: '员工不存在' }
    s.consolesToday++
    e.tbPlus = (e.tbPlus || 0) + 5
    toast(s, 'money', `安抚了 ${e.name}`, 0)
    return { ok: true }
  },
  takeOrder(s, apptId) {
    const a = s.appointments.find((x) => x.id === apptId)
    if (!a) return { ok: false, err: '预约不存在' }
    const miss = requirementMissing(s, ordOf(a.orderKey))
    if (miss) return { ok: false, err: miss }
    a.state = 'accepted'
    if (!a.depositPaid) {
      a.depositPaid = true
      const dep = a.deposit || 0
      s.cash += dep
      s.todayIncome += dep
      s.totalRevenue += dep
      if (dep > 0) toast(s, 'money', `收下 ${a.name} 的预约定金 ¥${fmt(dep)}（爽约不退）`, dep)
    }
    return { ok: true }
  },
  passOrder(s, apptId) {
    s.appointments = s.appointments.filter((x) => x.id !== apptId)
    return { ok: true }
  },
  autoSchedule(s) {
    const accepted = s.appointments.filter((a) => a.state === 'accepted')
    accepted.sort((a, b) => b.slots - a.slots)
    s.schedule = {}
    const load = {}
    for (const a of accepted) {
      const o = ordOf(a.orderKey)
      const ph = postStaff(s, 'photographer').sort((x, y) => (y.skill + y.energy / 200) - (x.skill + x.energy / 200))[0]
      const startSlot = bestSlot(s, o, load)
      load[startSlot] = (load[startSlot] || 0) + o.slots
      s.schedule[a.id] = { staffId: ph ? ph.id : 0, startSlot }
    }
    return { ok: true }
  },
  manualShoot(s, orderId, comp, timing, sharp) {
    const v = (comp + timing + sharp) / 3
    s.manualShot[orderId] = v
    s.boss.energy = Math.max(0, s.boss.energy - 15)
    return { ok: true }
  },
  acceptRush(s, msgId) {
    const card = s.inbox.find((m) => m.kind === 'rushoffer' && (msgId == null || m.id === msgId))
    if (!card) return { ok: false, err: '加急请求不存在或已过期' }
    s.inbox = s.inbox.filter((m) => m !== card)
    s.rushAccepted = true // 下一个时段到店，插队最前
    toast(s, 'money', '接下加急单：下一时段到店，插队处理（+50% 加急费）', 0)
    return { ok: true }
  },
  declineRush(s, msgId) {
    const card = s.inbox.find((m) => m.kind === 'rushoffer' && (msgId == null || m.id === msgId))
    if (!card) return { ok: false, err: '加急请求不存在或已过期' }
    s.inbox = s.inbox.filter((m) => m !== card)
    s.reputation = clampRep(s.reputation - 0.02)
    toast(s, 'warn', '婉拒了加急请求（口碑 -0.02）')
    return { ok: true }
  },
  // 严重投诉升级：老板花钱亲自平息一半积压
  dismissComplaint(s) {
    const cost = 200
    if (s.cash < cost) return { ok: false, err: '现金不足' }
    s.cash -= cost; s.todayVar += cost
    s.complaintsBacklog = Math.ceil((s.complaintsBacklog || 0) / 2)
    s.complaintAlertDay = day(s)
    s.inbox = s.inbox.filter((m) => m.kind !== 'complaint')
    toast(s, 'money', '老板亲自出面平息客诉（积压减半）', -cost)
    return { ok: true }
  },
  clearPendingQuarrel(s) { s.pendingQuarrel = null; return { ok: true } },
  clearQuarrel(s) { s.quarrel = null; return { ok: true } },
  watchAd(s) { s.rescue.entitled = true; toast(s, 'money', '看完广告：解锁本次救命大单接单资格', 0); return { ok: true } },
  payUnlock(s) { s.rescue.entitled = true; toast(s, 'money', '付费解锁：本次救命大单资格已生效', 0); return { ok: true } },
  takeRescueDeal(s, dealKey) {
    const deal = find(RESCUE_DEALS, dealKey)
    if (!deal) return { ok: false, err: '未知救命单' }
    if (day(s) < s.rescue.cooldownUntil) return { ok: false, err: '冷却中（救急不救穷：每 30 天至多一次）' }
    if (!s.rescue.entitled) return { ok: false, err: '需要先解锁资格（看广告或付费）' }
    const amount = Math.round(avgOrderPrice(s) * deal.mult)
    s.cash += amount
    s.todayIncome += amount
    s.boss.energy = Math.max(0, s.boss.energy - deal.energyCost)
    for (const e of s.staff) e.energy = Math.max(0, e.energy - 20)
    s.reputation = clampRep(s.reputation - deal.repCost)
    s.rescue.usedCount++
    s.rescue.cooldownUntil = day(s) + RESCUE_COOLDOWN
    s.rescue.entitled = false
    s.inbox = s.inbox.filter((m) => m.kind !== 'rescue')
    toast(s, 'money', `救命大单「${deal.name}」交付：+${amount}（全店通宵：精力 -20，口碑 -${deal.repCost}）`, amount)
    return { ok: true, amount }
  },
  startQuarrel(s, ref) {
    if (s.quarrelsToday >= 2) return { ok: false, err: '今天已经吵过 2 场了' }
    const rnd = mulberry32((s.seed + s.round * 53 + s.seq) >>> 0)
    const ct = QUARREL_CUSTOMERS[Math.floor(rnd() * QUARREL_CUSTOMERS.length)]
    s.quarrelsToday++
    s.quarrel = { ct: ct.key, my: 50, foe: 50, roundIdx: 0, refPrice: ref && ref.price ? ref.price : 500, log: [`${ct.name}的客人拍了桌子……`] }
    return { ok: true }
  },
  // 当前回合可选择的沟通方式（每回合从 5 类中确定性抽 3 个，附情境话术）
  quarrelOptions(s) {
    if (!s.quarrel) return []
    const q = s.quarrel
    const pool = HANDS.filter((h) => h.key !== 'yield')
    const r = mulberry32((s.seed + q.roundIdx * 613 + q.ct.length * 17) >>> 0)
    const picks = []
    const bag = [...pool]
    while (picks.length < 3 && bag.length > 0) {
      picks.push(bag.splice(Math.floor(r() * bag.length), 1)[0])
    }
    if (q.roundIdx >= 3) picks.push(HANDS.find((h) => h.key === 'yield')) // 后期始终给台阶
    return picks.map((h) => {
      const talks = HAND_TALK[h.key]
      const talk = talks[q.roundIdx % talks.length]
      const strong = h.strong.includes(find(QUARREL_CUSTOMERS, q.ct).name)
      return { key: h.key, name: h.name, talk, strong }
    })
  },
  quarrelMove(s, handKey) {
    if (!s.quarrel) return { ok: false, err: '没有进行中的论战' }
    const hand = find(HANDS, handKey)
    const ct = find(QUARREL_CUSTOMERS, s.quarrel.ct)
    const q = s.quarrel
    const strong = hand.strong.includes(ct.name)
    const dMe = strong ? 25 : hand.key === 'yield' ? -30 : 10 + Math.floor(roll(s, q.roundIdx * 7 + 1) * 10)
    const dFoe = strong ? 18 : 12 + Math.floor(roll(s, q.roundIdx * 11 + 2) * 10)
    q.my += dMe; q.foe += dFoe
    q.roundIdx++
    const talk = HAND_TALK[hand.key] ? HAND_TALK[hand.key][q.roundIdx % HAND_TALK[hand.key].length] : ''
    q.log.push(`你：「${talk}」${strong ? '——正中软肋！' : ''}（气势 ${q.my}）`)
    if (q.roundIdx >= 5 || q.my >= 100 || q.foe >= 100) return resolveQuarrel(s)
    return { ok: true, ongoing: true }
  },
  quarrelYield(s) {
    if (!s.quarrel) return { ok: false, err: '没有进行中的论战' }
    s.quarrel.log.push('你选择认怂，客人打折离场。')
    return resolveQuarrel(s, true)
  },
  submitReview(s, workId, retouch, reviewerKey) {
    if (!isReviewDay(s)) return { ok: false, err: '今天不是锐评日（每周三）' }
    const w = s.works.find((x) => x.id === workId)
    if (!w) return { ok: false, err: '选择投稿作品' }
    const reviewer = find(REVIEWERS, reviewerKey) || REVIEWERS[0]
    const crowd = crowdOf(w.crowdIdx)
    const pref = 40 + crowd.qualityBar * 30
    const over = Math.abs(retouch - pref) / 100
    const score = Math.max(0, Math.min(1, w.quality * (1 - over * 0.35) + reviewer.bias + (roll(s, 991) - 0.5) * 0.1))
    let tier
    if (score >= 0.85) tier = REVIEW_TIERS[0]
    else if (score >= 0.7) tier = REVIEW_TIERS[1]
    else if (score >= 0.55) tier = REVIEW_TIERS[2]
    else if (score >= 0.4) tier = REVIEW_TIERS[3]
    else tier = REVIEW_TIERS[4]
    s.fans += tier.fans
    s.reputation = clampRep(s.reputation + tier.rep)
    s.skillPoints += tier.skill
    s.reviewTiers.push(tier.key)
    if (tier.key === 'god' || tier.key === 'good') s.goodReviews = (s.goodReviews || 0) + 1
    s.reviewDoneDay = day(s)
    if (tier.key === 'god') s.reviewPulse = 4
    toast(s, tier.rep >= 0 ? 'fans' : 'warn', `锐评「${tier.name}」：粉丝 +${tier.fans}，口碑 ${tier.rep >= 0 ? '+' : ''}${tier.rep}`, 0)
    return { ok: true, tier: tier.key, score }
  },
  resolveServiceEvent(s, msgId, optKey) {
    const msg = s.inbox.find((m) => m.id === msgId && m.kind === 'service')
    if (!msg) return { ok: false, err: '事件不存在' }
    const tpl = find(SERVICE_EVENTS, msg.eventKey)
    const opt = tpl.opts.find((o) => o.key === optKey)
    if (!opt) return { ok: false, err: '未知选项' }
    let cost = 0
    if (opt.cost > 0) cost = Math.round((msg.refPrice || 500) * opt.cost)
    if (opt.cost < 0) cost = -Math.round((msg.refPrice || 500) * -opt.cost)
    if (cost > 0 && s.cash < cost) return { ok: false, err: '现金不足' }
    s.cash -= cost
    if (cost > 0) s.todayVar += cost
    if (cost < 0) s.todayIncome += -cost
    s.reputation = clampRep(s.reputation + opt.rep)
    if (optKey === 'overtime') for (const e of s.staff) e.energy = Math.max(0, e.energy - 20)
    if (optKey === 'reshoot') s.reshootPending++
    s.inbox = s.inbox.filter((m) => m.id !== msgId)
    toast(s, 'money', `客服事件「${tpl.name}」：${opt.name}`, -cost)
    return { ok: true }
  },
  dismissInbox(s, msgId) {
    const m = s.inbox.find((x) => x.id === msgId)
    if (m && m.kind === 'service') return { ok: false, err: '客服事件必须处理后才能忽略' }
    s.inbox = s.inbox.filter((x) => x.id !== msgId)
    return { ok: true }
  },
  setBossStyle(s, style) {
    if (!['hands_on', 'delegator'].includes(style)) return { ok: false, err: '未知风格' }
    s.boss.style = style
    return { ok: true }
  },
  retire(s) {
    s.ended = { type: 'retire', text: `第 ${day(s)} 天，你把店牌摘下来，换上了「传奇影楼」荣誉铭牌。现金 ${fmt(s.cash)}，口碑 ${s.reputation.toFixed(1)} 星，粉丝 ${fmt(s.fans)}。` }
    s.phase = 'ended'
    return { ok: true }
  },
}

function resolveQuarrel(s, yielded = false) {
  const q = s.quarrel
  const ct = find(QUARREL_CUSTOMERS, q.ct)
  let outcome
  if (yielded) outcome = 'draw'
  else if (q.my > q.foe + 10) outcome = 'win'
  else if (q.foe > q.my + 10) outcome = 'lose'
  else outcome = 'draw'
  if (outcome === 'win') {
    s.reputation = clampRep(s.reputation + 0.08)
    s.quarrelWinStreak++
    q.log.push('你赢了：客人按原价买单，围观客人都觉得这家店有原则。（口碑 +0.08）')
  } else if (outcome === 'lose') {
    const cut = Math.round(q.refPrice * 0.5)
    s.cash -= cut; s.todayVar += cut
    s.reputation = clampRep(s.reputation - 0.08)
    s.quarrelWinStreak = 0
    q.log.push(`你输了：赔了 ${cut}。（口碑 -0.08）`)
  } else {
    const cut = Math.round(q.refPrice * 0.2)
    s.cash -= cut; s.todayVar += cut
    q.log.push(`各退一步：打折 ${cut}，口碑不变。`)
  }
  q.result = { outcome, log: q.log, name: ct.name }
  return { ok: true, ...q.result }
}

// 全自动晨会：接下所有能接的单、自动排程（流畅流程的引擎侧；广告/定价仍手动）
export function autoMorning(s) {
  for (const a of [...s.appointments]) {
    const miss = requirementMissing(s, ordOf(a.orderKey))
    if (miss) act(s, 'passOrder', a.id)
    else act(s, 'takeOrder', a.id)
  }
  return act(s, 'autoSchedule')
}
function bestSlot(s, o, load) {
  const total = slotsPerDay(s)
  const cap = Math.max(1, stationCapacity(s, 'shoot')) // 排期用真实拍摄并发，避免虚增排队
  for (let slot = 0; slot < total; slot++) {
    const used = load[slot] || 0
    if (used + o.slots <= cap) return slot
  }
  return 0
}

// ---------------- 今日预约池生成（order=10） ----------------
function genIntake(s) {
  const rnd = mulberry32((s.seed + s.round * 211) >>> 0)
  const pr = find(PRICING, s.priceTier)
  let flow = pr.flow * eventEff(s, 'flowMul', 1) * effMul(s)
  if (s.ai.stage >= 2) flow *= 0.85
  const nAppo = Math.max(1, Math.round((1.6 + s.reputation * 0.6 + Math.min(s.fans, 3000) / 1200) * flow * (rnd() * 0.3 + 0.85)))
  s.appointments = []
  for (let i = 0; i < nAppo; i++) {
    const o = pickOrderType(s, rnd)
    const c = crowdOf(o.crowd)
    const price = locPrice(s, o.key, o.price * pr.mul * c.priceMul * aiPriceMul(s, o.key))
    s.appointments.push({
      id: s.orderSeq++, orderKey: o.key, crowdIdx: o.crowd, price,
      deposit: Math.round(price * 0.25),
      noShowP: noShowRisk(s, c),
      slots: o.slots, state: 'waiting', name: nameOf(rnd), retained: false, appointment: true,
    })
  }
  for (const r of s.pendingRetained) {
    s.appointments.push({ ...r, id: s.orderSeq++ })
  }
  s.pendingRetained = []
  const pol = find(WALKIN_POLICY, s.walkinPolicy)
  s.walkinForecast = Math.max(0, Math.round((0.5 + s.fans / 2500 + (s.adsToday.length ? 0.8 : 0)) * pol.walkinMul * flow))
  s.slotsTotal = slotsPerDay(s)
}
function pickOrderType(s, rnd) {
  const pool = ORDERS.filter((o) => !requirementMissing(s, o))
  const tone = toneOf(s)
  const weights = pool.map((o) => {
    let w = 1 / Math.sqrt(o.price)
    if (tone === '网红' && o.key === 'checkin') w *= 2.5
    if (tone === '专业' && o.crowd >= 3) w *= 1.6
    if (tone === '艺术' && o.crowd >= 4) w *= 1.6
    if (tone === '亲民' && o.crowd <= 1) w *= 1.4
    return w
  })
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = rnd() * sum
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i] }
  return pool[0]
}

// ---------------- 时段动线结算（order=50） ----------------
function simulateSlot(s, slot) {
  const frame = { slot, arrived: [], left: [], served: [], income: 0, loss: 0, stations: {} }
  if (hasEvent(s, 'closed')) {
    s.frames.push(frame)
    return
  }
  const rnd = mulberry32((s.seed + s.round * 997 + slot * 97) >>> 0)
  const pol = find(WALKIN_POLICY, s.walkinPolicy)
  const pr = find(PRICING, s.priceTier)

  // 0) 营业中加急机会：进入收件箱即时卡 + 轻提示，不打断营业（24 小时内有效=当日可接）
  if (roll(s, slot * 131 + 5) < 0.10 && !s.inbox.some((m) => m.kind === 'rushoffer')) {
    s.inbox.push({ id: s.inboxSeq++, kind: 'rushoffer', name: '加急请求', level: 'now', refPrice: avgOrderPrice(s) })
    toast(s, 'money', '有加急请求进来了——收件箱可接（当日有效，+50% 加急费）', 0)
  }
  // 1) 到店：预约客可能爽约（定金不退）；到店即为高优先级
  for (const a of [...s.appointments]) {
    const sc = s.schedule[a.id]
    if (a.state === 'accepted' && sc && sc.startSlot === slot) {
      const rndNS = mulberry32((s.seed + a.id * 631 + s.round * 77) >>> 0)
      if (rndNS() < (a.noShowP || 0.12)) {
        a.noShow = true
        s.appointments = s.appointments.filter((x) => x.id !== a.id)
        s.schedule[a.id] = null
        toast(s, 'money', `${a.name} 预约爽约，定金 ¥${fmt(a.deposit)} 不退`, a.deposit)
        continue
      }
      spawnOrder(s, a, slot, frame, false)
    }
  }
  let walkProb = (0.15 + Math.min(s.fans, 5000) / 10000 + (s.adsToday.length ? 0.08 : 0) + (s.reviewPulse ? 0.15 : 0)) * pol.walkinMul
  walkProb *= pr.flow * eventEff(s, 'flowMul', 1) * effMul(s)
  if (toneOf(s) === '网红') walkProb *= 1.3
  if (rnd() < walkProb) {
    const o = pickOrderType(s, rnd)
    const c = crowdOf(o.crowd)
    spawnOrder(s, {
      id: s.orderSeq++, orderKey: o.key, crowdIdx: o.crowd,
      price: locPrice(s, o.key, o.price * pr.mul * c.priceMul * aiPriceMul(s, o.key)),
      slots: o.slots, name: nameOf(rnd), state: 'accepted', walkin: true,
    }, slot, frame, true)
  }
  // 已接的加急单：下一时段到店（插队）
  if (s.rushAccepted) {
    s.rushAccepted = false
    const pool = ORDERS.filter((o) => !requirementMissing(s, o))
    const o = pool.reduce((a, b) => (b.price > a.price ? b : a), pool[0])
    const c = crowdOf(o.crowd)
    spawnOrder(s, {
      id: s.orderSeq++, orderKey: o.key, crowdIdx: o.crowd,
      price: Math.round(locPrice(s, o.key, o.price * pr.mul * c.priceMul) * 1.5),
      slots: o.slots, name: nameOf(rnd) + '（加急）', state: 'accepted', walkin: true, rush: true,
    }, slot, frame, true)
  }

  // 2) 前台现场调度：扫一遍队列，把快流失的客人插到队首（挽留）、大客单标记优先
  const dispatchPower = postStaff(s, 'service').length + Math.floor((s.fac.reception || 0) / 2)
  let dispatched = 0
  for (const o of s.activeOrders) {
    if (o.done || o.rescued) continue
    const crowd = crowdOf(o.crowdIdx)
    if (o.waitSlots >= Math.max(1, crowd.patience - 1) && dispatched < dispatchPower) {
      o.rescued = true
      dispatched++
      o.satisfaction += 0.05
      if ((s.dispatchShown || 0) < 2) {
        s.dispatchShown = (s.dispatchShown || 0) + 1
        toast(s, 'warn', `前台把等急了的 ${o.name} 提前安排（挽留）`)
      }
    }
  }
  // 2) 工位推进：并发 = 已建房间数（房间实例制）∩ 在岗员工；老板可顶岗；阻塞则等待
  const servingCount = {}   // stationKey -> 本时段已服务数
  const assignedPost = {}   // post -> 本时段已占用的员工数
  s.bossCovered = 0
  const rank = (o) => (o.rush ? 0 : o.rescued ? 1 : o.appointment ? 2 : o.vipQueue ? 3 : 4)
  const sorted = [...s.activeOrders]
    .filter((o) => !o.done)
    .sort((a, b) => rank(a) - rank(b) || a.arriveSlot - b.arriveSlot) // 先到先服务
  for (const o of sorted) {
    if (o.done) continue
    const st = find(STATIONS, o.station)
    const workers = workersOf(s, st.post)
    const rooms = (s.roomsBuilt && s.roomsBuilt[st.zone]) != null ? s.roomsBuilt[st.zone] : 1
    const cap = Math.min(Math.floor(rooms * (inConstruct(s, st.zone) ? 0.5 : 1)), workers.length)
    const used = servingCount[st.key] || 0
    const usedPost = assignedPost[st.post] || 0
    if (used < cap && usedPost < workers.length) {
      servingCount[st.key] = used + 1
      assignedPost[st.post] = usedPost + 1
      if (workers[usedPost] && workers[usedPost].id === 0) s.bossCovered++
      o.waitedHere = false
      advanceStation(s, o, st, rnd)
    } else {
      o.waitSlots++
      o.waitedHere = true
      o.satisfaction -= 0.08
      if (st.zone === 'reception' && s.fac.display >= 2) o.satisfaction += 0.03
      const crowd = crowdOf(o.crowdIdx)
      // 客诉归客服系统：有客服在岗（或接待区 ≥2 级的前台职能）→ 客服自动安抚，不打扰老板
      if (o.waitSlots >= 2 && crowd.trouble >= 0.1 && roll(s, o.id * 41 + slot) < crowd.trouble) {
        const svcOn = postStaff(s, 'service').length > 0
        if (svcOn || s.fac.reception >= 2) {
          if ((s.autoCalmed || 0) < 3) {
            s.autoCalmed++
            const tip = Math.round(o.price * 0.1)
            s.todayVar += tip
            s.cash -= tip
            o.satisfaction += 0.12
            toast(s, 'warn', `客服上前安抚了不满的客人（补偿 ¥${fmt(tip)}，客诉未升级）`, -tip)
          }
        } else if (s.quarrelsToday < 2 && s.round - s.lastQuarrelDay >= 3 && !s.pendingQuarrel) {
          s.pendingQuarrel = { price: o.price, name: o.name } // 没有客服：只能老板亲自出面
          s.lastQuarrelDay = s.round
        }
      }
      if (o.waitSlots > crowd.patience + 1) angryLeave(s, o, frame, '等待过久')
    }
  }
  s.activeOrders = s.activeOrders.filter((o) => !o.done)

  // 2.5) 客服消化投诉积压：客服在岗数 + 前台等级折算（接待区每 2 级承担 1 名客服职能）
  const digest = postStaff(s, 'service').length + Math.floor((s.fac.reception || 0) / 2)
  s.complaintsBacklog = Math.max(0, (s.complaintsBacklog || 0) - digest)

  // 3) 员工精力（服务分级重体力：多环节大单 -10）
  const heavy = s.activeOrders.some((o) => o.crowdIdx >= 2 && ordOf(o.orderKey).stations.length >= 6)
  for (const e of s.staff) {
    if (e.resting) { e.energy = Math.min(100, e.energy + 30); if (e.energy >= 60) e.resting = false; continue }
    if (e.dayOff) continue
    let drain = 7 + (heavy ? 3 : 0) + (e.trait === 'lazy' ? 2 : 0)
    if (s.fac.rest >= 2) drain -= 1
    e.energy = Math.max(0, e.energy - drain)
    if (e.energy < 30) { e.resting = true; e.restCount = (e.restCount || 0) + 1 }
  }
  // 老板顶岗耗神（§5.6：亲自上阵的代价）
  if (s.bossCovered > 0) s.boss.energy = Math.max(0, s.boss.energy - 5 * s.bossCovered)

  // 4) 记录帧（UI 演出用）
  for (const st of STATIONS) {
    frame.stations[st.key] = {
      serving: s.activeOrders.filter((o) => o.station === st.key && !o.waitedHere && !o.done).map((o) => o.id),
      queue: s.activeOrders.filter((o) => o.station === st.key && o.waitedHere && !o.done).length,
    }
  }
  s.slotIncome[slot] = frame.income
  s.frames.push(frame)
}

function spawnOrder(s, a, slot, frame, walkin) {
  const o = ordOf(a.orderKey)
  s.activeOrders.push({
    id: a.id, orderKey: a.orderKey, crowdIdx: a.crowdIdx, name: a.name, price: a.price,
    stations: o.stations, station: o.stations[0], stationIdx: 0,
    waitSlots: 0, satisfaction: 0.65 + s.reputation * 0.04, clarity: null,
    quality: 0, retouchQ: 0, arriveSlot: slot, walkin, rush: !!a.rush, done: false,
    appointment: !!a.appointment,
    vipQueue: !a.appointment && a.price >= avgOrderPrice(s) * 2,
    retained: !!a.retained, reShots: 0, makeupeBonus: 0,
  })
  frame.arrived.push({ id: a.id, name: a.name, price: a.price, walkin })
}

function advanceStation(s, o, st, rnd) {
  const crowd = crowdOf(o.crowdIdx)
  if (st.key === 'wait') { nextStation(s, o); return }
  if (st.key === 'consult') {
    const svc = workersOf(s, 'service').sort((a, b) => b.skill - a.skill)[0]
    o.clarity = 0.5 + (svc ? svc.skill * 0.06 : -0.15) + (s.fac.reception >= 2 ? 0.1 : 0) + (s.forms.reception >= 1 ? 0.08 : 0)
    o.satisfaction += 0.05
    nextStation(s, o)
    return
  }
  if (st.key === 'makeup') {
    const mk = workersOf(s, 'makeup').sort((a, b) => b.skill - a.skill)[0]
    o.makeupBonus = mk ? mk.skill * 0.05 : 0
    // 陪同人数随形态升级（§4.7 服务分级的显性表达）
    const escort = s.forms.makeup >= 2 ? 3 : s.forms.makeup >= 1 ? 2 : 1
    o.satisfaction += 0.024 * escort
    nextStation(s, o)
    return
  }
  if (st.key === 'shoot') {
    const ph = workersOf(s, 'photographer').sort((a, b) => b.skill - a.skill)[0]
    o.staffId = ph ? ph.id : 0
    let q = 0.25 + (ph ? ph.skill * 0.07 : 0.05) + (o.makeupBonus || 0)
    q += (s.fac.camera + s.fac.lens + s.fac.light) * 0.025
    q += (o.clarity != null ? o.clarity : 0.45) * 0.2
    q += s.forms.studio * 0.05
    if (ph && ph.trait === 'artist' && crowd.qualityBar >= 0.6) q += 0.05
    if (hasEvent(s, 'shootMul')) q *= eventEff(s, 'shootMul', 1)
    const manual = s.manualShot[o.id]
    if (manual != null) { q += manual * 0.12; delete s.manualShot[o.id] }
    if (rnd() < crowd.trouble * 0.5 && (o.clarity != null ? o.clarity : 0.45) < 0.5) o.reShots++
    o.quality = Math.max(0.05, Math.min(1, q))
    o.shootSlots = (o.shootSlots || 0) + 1
    const need = ordOf(o.orderKey).slots > 2 ? 2 : 1
    if (o.shootSlots >= need) nextStation(s, o)
    return
  }
  if (st.key === 'select') {
    o.satisfaction += 0.04 + (s.forms.select || 0) * 0.03
    nextStation(s, o)
    return
  }
  if (st.key === 'retouch') {
    if (s.ai.subscribed) { o.retouchQ = 0.6 + s.fac.retoucheq * 0.06; nextStation(s, o); return }
    const rt = workersOf(s, 'retoucher').sort((a, b) => b.skill - a.skill)[0]
    o.retouchQ = 0.4 + (rt ? rt.skill * 0.08 : 0.1) + s.fac.retoucheq * 0.05 + (rt && rt.quals.includes('修图') ? 0.1 : 0)
    nextStation(s, o)
    return
  }
  if (st.key === 'deliver') deliverOrder(s, o)
}
function nextStation(s, o) {
  o.stationIdx++
  if (o.stationIdx >= o.stations.length) o.done = true
  else o.station = o.stations[o.stationIdx]
}
function deliverOrder(s, o) {
  const crowd = crowdOf(o.crowdIdx)
  const quality = Math.max(0.05, Math.min(1, (o.quality || 0.3) * 0.75 + (o.retouchQ || 0.4) * 0.25))
  const satis = Math.max(0, Math.min(1, o.satisfaction + quality * 0.4 - o.reShots * 0.05))
  const qualityOK = quality >= crowd.qualityBar
  let pay = Math.round(o.price * (0.85 + 0.3 * satis) * (qualityOK ? 1 : 0.6))
  s.cash += pay
  s.todayIncome += pay
  s.totalRevenue += pay
  s.delivered++
  s.deliveredBy[o.orderKey] = (s.deliveredBy[o.orderKey] || 0) + 1
  s.todayServed++
  if (!qualityOK) s.complaintsBacklog = (s.complaintsBacklog || 0) + 1
  const tip = Math.round(pay * crowd.tip * satis * 2)
  if (tip > 0) { s.cash += tip; s.todayIncome += tip }
  s.workSeq++
  s.works.push({ id: s.workSeq, quality, orderKey: o.orderKey, crowdIdx: o.crowdIdx, day: day(s), name: o.name })
  s.bestWorkQuality = Math.max(s.bestWorkQuality, quality)
  s.bestDayIncome = Math.max(s.bestDayIncome || 0, s.todayIncome)
  // 成长型员工经验（进阶线燃料）
  const ph = s.staff.find((e) => e.id === o.staffId)
  if (ph) {
    ph.served++
    if (ph.skill < ph.potential && ph.served % 6 === 0) { ph.skill++; restage(s, ph) }
  }
  // 留存 / 传播（离店即判定，确定性）
  const rnd = mulberry32((s.seed + s.round * 313 + o.id * 29) >>> 0)
  const retainP = 0.2 + satis * 0.4 + (crowd.key === 'family' ? 0.1 : 0) - (crowd.key === 'star' ? 0.1 : 0)
  if (rnd() < retainP) {
    s.todayRetained++
    s.totalRetained = (s.totalRetained || 0) + 1
    s.weekAcc.retained++
    s.pendingRetained.push({ orderKey: o.orderKey, crowdIdx: o.crowdIdx, price: o.price, deposit: Math.round(o.price * 0.25), slots: ordOf(o.orderKey).slots, name: o.name + '（回头客）', state: 'waiting', retained: true })
  }
  const spreadP = 0.05 + Math.max(0, satis - 0.6) * 0.3 + crowd.spread
  if (rnd() < spreadP) {
    const gain = Math.round(20 + quality * 80)
    s.fans += gain
    s.todaySpread++
    s.totalSpread = (s.totalSpread || 0) + 1
    s.todaySpreads.push({ name: o.name, gain })
    s.weekAcc.spread++
    toast(s, 'fans', `${o.name} 把照片分享到了朋友圈 / 平台：粉丝 +${gain}`, 0)
  }
  if (qualityOK) {
    const add = satis >= 0.85 ? 0.05 : satis >= 0.7 ? 0.04 : satis >= 0.55 ? 0.03 : satis >= 0.4 ? 0.02 : 0
    if (add) s.reputation = clampRep(s.reputation + add)
  }
  s.irreplaceable += qualityOK ? 1 : -1
  o.done = true
  s.lastDeliver = { id: o.id, name: o.name, pay: pay + tip }
}
function angryLeave(s, o, frame, cause) {
  o.done = true
  s.complaintsBacklog = (s.complaintsBacklog || 0) + 1
  s.complaintsToday = (s.complaintsToday || 0) + 1
  s.todayLoss += o.price
  s.weekAcc.loss += o.price
  s.lossCauses.push({ cause, amount: o.price, name: o.name, crowd: crowdOf(o.crowdIdx).name })
  frame.left.push({ id: o.id, name: o.name, price: o.price, cause })
  frame.loss += o.price
  toast(s, 'loss', `${o.name} 愤然离店（${cause}）：流失 ¥${fmt(o.price)}`, -o.price)
  s.reputation = clampRep(s.reputation - 0.01)
}

// ---------------- 回合推进 ----------------
export function nextDay(s) {
  if (s.ended) return
  s.round++
  s.phase = 'briefing'
  s.slot = 0
  s.frames = []
  s.slotIncome = []
  s.manualShot = {}
  s.todayIncome = 0; s.todayFixed = 0; s.todayVar = 0; s.todayLoss = 0
  s.lossCauses = []; s.todayServed = 0; s.todayRetained = 0; s.todaySpread = 0; s.todaySpreads = []
  s.quarrelsToday = 0; s.consolesToday = 0
  s.pendingQuarrel = null; s.rushAccepted = false
  s.autoCalmed = 0; s.complaintsToday = 0; s.dispatchShown = 0
  s.toasts = []
  s.adsToday = []
  s.reviewPulse = 0
  // 持续效果到期 / 施工推进
  for (const k of Object.keys(s.timedEffects)) if (day(s) > s.timedEffects[k].until) delete s.timedEffects[k]
  s.renovations = s.renovations.filter((r) => {
    r.daysLeft--
    if (r.daysLeft <= 0) {
      s.forms[r.zone] = r.to
      toast(s, 'buy', `改造完成：${FORMS[r.zone][r.to]} 正式启用（并发容量跳档）`)
      return false
    }
    return true
  })
  if (s.constructionDays > 0) s.constructionDays--
  // 离职兑现
  for (const e of [...s.staff]) {
    if (e.leaving) {
      s.staff = s.staff.filter((x) => x.id !== e.id)
      toast(s, 'warn', `${e.name} 离职了（产能空缺，记得补招）`)
    }
  }
  genIntake(s)
  for (const e of s.staff) { e.resting = false; e.dayOff = false }
  s.boss.energy = Math.min(100, s.boss.energy + 60) // 老板睡一觉回神
  refreshCandidates(s)
}

export function startBusiness(s) {
  s.phase = 'business'
  s.slot = 0
  s.frames = []
  s.slotIncome = []
}

export function stepSlot(s) {
  simulateSlot(s, s.slot)
  s.slot++
  if (s.slot >= slotsPerDay(s)) { finishDay(s); return false }
  return true
}

export function skipDay(s) {
  while (s.phase === 'business') { if (!stepSlot(s)) break }
}

// ---------------- 夜间结算 ----------------
function finishDay(s) {
  // 打烊清场：没能服务完的客人带着歉意离店（补偿券，记流失）
  for (const o of s.activeOrders.filter((x) => !x.done)) {
    const lost = Math.round(o.price * 0.3)
    s.todayLoss += lost
    s.weekAcc.loss += lost
    s.lossCauses.push({ cause: '打烊未服务完', amount: lost, name: o.name, crowd: crowdOf(o.crowdIdx).name })
    toast(s, 'loss', `打烊：${o.name} 改天再来（补偿券 ¥${fmt(lost)}）`, -lost)
  }
  s.activeOrders = []
  // order=20 员工出错（确定性）
  for (const e of s.staff) {
    if (e.dayOff) continue
    const trait = find(TRAITS, e.trait)
    if (roll(s, e.id * 13) < 0.08 + trait.err * 0.1) {
      const cut = Math.round(50 + roll(s, e.id * 17) * 200)
      s.cash -= cut; s.todayVar += cut
      s.reputation = clampRep(s.reputation - 0.01)
      toast(s, 'warn', `${e.name} 出错了：赔偿 ${cut}（${trait.name}）`, -cut)
    }
  }
  // order=30 市场 / AI
  s.fans += Math.round(s.fans * 0.004 + s.todayServed * 0.5)
  s.replacePower = s.ai.stage * 18
  const avgSatis = s.todayServed ? Math.min(1, 0.5 + s.todayRetained * 0.1) : 0.4
  s.irreplaceable = Math.max(0, s.irreplaceable + Math.round((avgSatis - 0.5) * 8) - (s.ai.subscribed ? 2 : 0))
  let stage = 0
  for (let i = 0; i < AI_STAGES.length; i++) if (day(s) >= AI_STAGES[i].minDay) stage = i
  if (stage !== s.ai.stage) {
    s.ai.stage = stage
    toast(s, 'warn', `AI 冲击进入「${AI_STAGES[stage].name}」阶段：${AI_STAGES[stage].text}`)
  }
  // order=40 客服事件（动线失败驱动；5 天保底）与吵架触发
  s.serviceEventFallback++
  const worst = s.lossCauses[0]
  const svcCount = s.inbox.filter((m) => m.kind === 'service').length
  if (svcCount < 2 && (worst || s.serviceEventFallback >= 5)) {
    const tpl = worst && worst.cause === '等待过久'
      ? find(SERVICE_EVENTS, 'rushreq')
      : find(SERVICE_EVENTS, s.serviceEventFallback % 2 === 0 ? 'toofat' : 'badthreat')
    s.inbox.push({
      id: s.inboxSeq++, kind: 'service', eventKey: tpl.key, name: tpl.name,
      cause: worst ? `${worst.cause}（${worst.name}，流失 ¥${fmt(worst.amount)}）` : '例行回访',
      refPrice: worst ? worst.amount : 500, level: 'now',
    })
    s.serviceEventFallback = 0
  }
  if (worst && s.quarrelsToday < 2 && s.round - s.lastQuarrelDay >= 3 && roll(s, 771) < 0.3) {
    s.lastQuarrelDay = s.round
    s.inbox.push({ id: s.inboxSeq++, kind: 'quarrel', name: '有客人不服，要讨说法', level: 'now', ref: { price: worst.amount } })
  }
  // order=60 店铺等级评审（五维缺一不可）
  if (s.grade < 5) {
    const next = GRADES[s.grade]
    if (next && Object.values(next.cond).every((c) => c.ok(s))) {
      s.grade++
      const m = next.reward && next.reward.match(/粉丝 \+([\d,]+)/)
      if (m) s.fans += parseInt(m[1].replace(',', ''), 10)
      const msk = next.reward && next.reward.match(/技能点 \+(\d+)/)
      if (msk) s.skillPoints += parseInt(msk[1], 10)
      s.celebrate.push({ type: 'grade', plaque: next.plaque, unlocks: next.unlocks, reward: next.reward, crowdName: next.crowdName })
      toast(s, 'buy', `升级评审通过：${next.plaque}`)
    }
  }
  // 里程碑
  for (const m of MILESTONES) {
    if (!s.milestones.includes(m.key) && m.ok(s)) {
      s.milestones.push(m.key)
      s.celebrate.push({ type: 'milestone', text: `里程碑达成：${m.name}` })
    }
  }
  // 成长型员工晋升合伙人
  for (const e of s.staff) {
    if (e.stage !== 'partner' && find(STAFF_STAGES, 'partner').need(e)) {
      e.stage = 'partner'
      s.celebrate.push({ type: 'partner', text: `${e.name} 晋升合伙人！班底成型，可以共进退了。` })
    }
  }
  // order=100 现金流结算（最后）：只补扣固定成本 + 耗材（今日已扣款项在 todayVar）
  const fb = fixedCostBreakdown(s)
  const fixed = fb.total
  const materials = s.todayServed * 8
  const variable = s.todayVar + materials
  s.cash -= fixed + materials
  s.todayFixed = fixed
  s.todayVar = variable
  s.lastFixedCost = fixed
  // 零投诉日奖励：一整天没让客人愤然离店、且交付 ≥3 单，口碑 +0.06（正向激励：口碑累积靠服务好而非只靠锐评）
  if (s.todayLoss === 0 && s.todayServed >= 3) {
    s.reputation = clampRep(s.reputation + 0.06)
    toast(s, 'fans', '今天零投诉、零流失：口碑 +0.06（好服务攒口碑）', 0)
  }
  const net = s.todayIncome - fixed - variable
  const report = {
    day: day(s), income: s.todayIncome, fixed, variable, net, balance: s.cash,
    rep: s.reputation, fans: s.fans, served: s.todayServed, loss: s.todayLoss,
    retained: s.todayRetained, spread: s.todaySpread,
    lossCauses: [...s.lossCauses], spreads: [...s.todaySpreads], flowTop: flowTopWaits(s),
  }
  s.reportHistory.unshift(report)
  if (s.reportHistory.length > 30) s.reportHistory.pop()
  s.lastReport = report
  if (net > 0) { s.streakPos++; s.negativeDays = 0 } else if (net < 0) { s.negativeDays++; s.streakPos = 0 }
  s.weekAcc.income += s.todayIncome
  s.weekAcc.loss += s.todayLoss
  s.weekAcc.days++
  // 客诉积压：≥3 提示（收件箱可攒卡），≥5 严重升级（必须处理）
  if ((s.complaintsBacklog || 0) >= 3 && day(s) > (s.complaintAlertDay || 0)) {
    s.complaintAlertDay = day(s)
    s.inbox.push({
      id: s.inboxSeq++, kind: 'complaint', name: '客诉积压', level: (s.complaintsBacklog || 0) >= 5 ? 'must' : 'later',
      backlog: s.complaintsBacklog,
    })
    toast(s, 'warn', `客诉积压 ${s.complaintsBacklog} 起——建议招募客服，或升接待区分担`)
  }
  // 破产防线（第二道）：危险/断裂 → 收件箱救命单
  const state = cashflowState(s)
  if ((state === 'danger' || state === 'broken') && day(s) >= s.rescue.cooldownUntil && !s.inbox.some((m) => m.kind === 'rescue')) {
    s.inbox.push({ id: s.inboxSeq++, kind: 'rescue', name: '救命稻草来了', level: 'must', deals: RESCUE_DEALS })
  }
  // 破产防线（第三道）：被动收缩
  if (s.cash < 0) {
    const sellable = FACILITIES.filter((f) => f.cat === 'equip' && s.fac[f.key] > 1).sort((a, b) => s.fac[a.key] - s.fac[b.key])[0]
    if (sellable) {
      const refund = Math.round(sellable.upCost[s.fac[sellable.key]] * 0.2)
      s.fac[sellable.key]--
      s.cash += refund
      toast(s, 'warn', `现金断裂：被动变卖 ${sellable.name}，废品价回收 ${refund}`)
    }
  }
  if (s.cash < 0 && s.negativeDays >= 7) {
    s.ended = { type: 'bankrupt', text: `连续 7 天净现金流为负，第 ${day(s)} 天，店关门了。三道防线都没能救回来。` }
    s.phase = 'ended'
    return
  }
  // 深夜：员工去留结算（两因子 + 成长空间第三因子）
  staySettle(s, state)
  // 周反思（每 7 天）
  if (day(s) % 7 === 0) {
    const wr = {
      day: day(s), net, loss: s.weekAcc.loss, retained: s.weekAcc.retained, spread: s.weekAcc.spread,
      lossTop: topLosses(s, 3), lastNet: s.lastWeekNet, advice: adviceOf(s),
    }
    s.weeklyReports.unshift(wr)
    s.lastWeekNet = wr.net
    s.weekAcc = { income: 0, loss: 0, retained: 0, spread: 0, days: 0 }
    s.celebrate.push({ type: 'week', report: wr })
  }
  // 年度评奖（每 90 天）
  if (day(s) - s.lastAwardDay >= 90) {
    s.lastAwardDay = day(s)
    for (const a of AWARD_TYPES) {
      if (a.need(s) && !s.awards.includes(a.name)) {
        s.awards.push(a.name)
        s.fans += 500
        s.celebrate.push({ type: 'award', text: `年度评奖：「${a.name}」（粉丝 +500）` })
      }
    }
  }
  // 随机事件抽取（语义即随机，不要求复现）
  drawEvent(s)
  s.phase = 'settle'
}

function drawEvent(s) {
  if (Math.random() >= 0.25) return
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)]
  if (ev.days > 0) {
    s.timedEffects[ev.key] = { until: day(s) + ev.days, eff: ev.eff }
    toast(s, 'warn', `事件：${ev.name} —— ${ev.text}（持续 ${ev.days} 天）`)
  } else {
    if (ev.eff.cashHit) { s.cash += ev.eff.cashHit; s.todayVar -= ev.eff.cashHit }
    if (ev.eff.repHit) s.reputation = clampRep(s.reputation + ev.eff.repHit)
    if (ev.eff.extraOrders) {
      for (let i = 0; i < ev.eff.extraOrders; i++) {
        const o = pickOrderType(s, Math.random)
        s.pendingRetained.push({ orderKey: o.key, crowdIdx: o.crowd, price: o.price, deposit: Math.round(o.price * 0.25), slots: o.slots, name: nameOf(Math.random), state: 'waiting' })
      }
    }
    toast(s, 'warn', `事件：${ev.name} —— ${ev.text}`)
  }
}

function flowTopWaits(s) {
  const waits = {}
  for (const fr of s.frames) for (const [k, v] of Object.entries(fr.stations)) waits[k] = (waits[k] || 0) + v.queue
  return Object.entries(waits).sort((a, b) => b[1] - a[1]).slice(0, 3)
}
function topLosses(s, n) {
  const by = {}
  for (const l of s.lossCauses) by[l.cause] = (by[l.cause] || 0) + l.amount
  return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, n).map(([cause, amount]) => ({ cause, amount }))
}
function adviceOf(s) {
  const top = topLosses(s, 1)[0]
  if (!top) return '本周零流失，保持现状。'
  if (top.cause === '等待过久') return '流失主因是等待：优先升接待区容量，或把分流调回「预约优先」。'
  return '流失主因是质量：优先升机身/灯光，或安排员工进修专精。'
}
function staySettle(s, state) {
  s.stayReport = []
  for (const e of s.staff) {
    const underpaid = e.wage < marketWage(e.post) * 0.95
    const overworked = (e.restCount || 0) > 2
    let will = 55
    will += underpaid ? -14 : 10
    will += overworked ? -10 : 5
    will += state === 'healthy' ? 8 : state === 'danger' || state === 'broken' ? -6 : 0
    will += s.fac.rest >= 1 ? 4 : 0
    will += e.tbPlus || 0
    if (e.talent === 'growth') will += 6 * Math.min(e.quals.length, 2) + (s.grade >= 3 ? 6 : 0)
    if (e.retained) will = Math.max(will, 75)
    e.stayWill = Math.max(0, Math.min(100, Math.round(will)))
    e.restCount = 0; e.tbPlus = 0
    const row = { name: e.name, talent: e.talent, will: e.stayWill }
    if (e.stayWill < 40) {
      if (e.talent === 'growth' && s.grade >= 3 && roll(s, e.id * 31) < 0.6) row.text = '想走，但觉得这店还能让他变强——暂留观望'
      else { e.leaving = true; row.text = '明天离职' }
    } else if (e.stayWill < 60) row.text = '想走预警（可加薪挽留）'
    else row.text = '状态稳定'
    s.stayReport.push(row)
  }
}


// ---------------- World 层：地图多地点推进（双点县式） ----------------
export function makeLocation(locKey, seed) {
  const loc = MAP.find((m) => m.key === locKey)
  const g = createGame((seed + locKey.length * 977 + locKey.charCodeAt(0) * 31) >>> 0)
  g.locKey = locKey
  g.cash = loc.cash
  g.locPriceMul = loc.priceMul || 1
  g.orderBoost = loc.orderBoost || {}
  g.totalRetained = 0; g.totalSpread = 0; g.goodReviews = 0; g.bestDayIncome = 0
  g.stars = 0
  return g
}
export function createWorld(seed = 20260914) {
  const street = makeLocation('street', seed)
  return { seed, cur: 'street', locs: { street }, stars: { street: 0 } }
}
export function locUnlocked(world, key) {
  const loc = MAP.find((m) => m.key === key)
  if (!loc || !loc.unlock) return true
  return (world.stars[loc.unlock.prev] || 0) >= loc.unlock.stars
}
export function ensureLocation(world, key) {
  if (!world.locs[key]) world.locs[key] = makeLocation(key, world.seed)
}
export function switchLocation(world, key) {
  if (!MAP.some((m) => m.key === key)) return { ok: false, err: '未知地点' }
  if (!locUnlocked(world, key)) return { ok: false, err: '地点未解锁：先在上一地点拿到 1 星' }
  ensureLocation(world, key)
  const sim = world.locs[key]
  if (sim.phase === 'business') sim.phase = 'settle' // 跨地点切走时视为当日收工
  world.cur = key
  return { ok: true }
}
export function evalTasks(world) {
  const s = world.locs[world.cur]
  const loc = MAP.find((m) => m.key === s.locKey)
  const had = s.stars || 0
  for (const tier of loc.tasks) {
    if ((s.stars || 0) >= tier.star) continue
    if (tier.items.every((it) => it.done(s))) {
      s.stars = tier.star
      world.stars[s.locKey] = tier.star
      const idx = MAP.findIndex((m) => m.key === loc.key)
      const next = MAP[idx + 1]
      if (tier.star === 1) { s.fans += 300; s.cash += 1000 }
      if (tier.star === 2) s.cash += 2000
      if (tier.star === 3) { s.fans += 500; s.cash += 5000 }
      s.celebrate.push({
        type: 'task',
        text: `${loc.name} ${'★'.repeat(tier.star)} 任务达成！` +
          (tier.star === 1 && next ? ` 解锁新地点：${next.name}` : ''),
      })
    }
  }
  return (s.stars || 0) - had
}
// 晨会「今日提示」：一行轻提示，取代流程化复盘
export function hintOf(s) {
  if (s.lossCauses && s.lossCauses.length > 0) {
    const l = s.lossCauses[0]
    if (l.cause === '等待过久') return '昨天有客人等太久走了——升接待区或把分流调回「预约优先」。'
    return '昨天有客人对成片不满意——升机身/灯光，或让员工进修专精。'
  }
  const tired = s.staff.find((e) => e.energy < 40)
  if (tired) return `${tired.name} 精力不足——排休一天，或建休息区。`
  if (s.cash < (s.lastFixedCost || 1) * 10) return '现金偏紧——危险态可接救命大单，先别扩张。'
  const nextT = nextGradeInfo(s)
  if (nextT) {
    const near = nextT.dims.find((d) => !d.ok)
    if (near) return `距下一星差「${near.label}」：${near.text}。`
  }
  return '状态良好——投个广告或发条内容，把客流再拉一档。'
}

// ---------------- UI 查询接口 ----------------
export function stationWorkers(s, stationKey) {
  const st = find(STATIONS, stationKey)
  return workersOf(s, st.post).map((w) => ({ id: w.id, name: w.name, skill: w.skill, boss: w.id === 0 }))
}
export function nextGradeInfo(s) {
  if (s.grade >= 5) return null
  const next = GRADES[s.grade]
  const dims = Object.values(next.cond).map((c) => ({ label: c.label, text: c.text, ok: !!c.ok(s) }))
  return { grade: next.grade, name: next.name, plaque: next.plaque, dims, allOk: dims.every((d) => d.ok) }
}
// 目录再导出（UI 统一从引擎取）
export {
  FORMS, TIER_NAMES, FORM_RENOVATE, FACILITIES, ORDERS, CROWDS, PRICING, WALKIN_POLICY,
  CHANNELS, CONTENT_TOPICS, POSTS, TRAITS, QUALS, QUAL_COST, STATIONS, GRADES, HANDS,
  QUARREL_CUSTOMERS, REVIEWERS, REVIEW_TIERS, AI_STAGES, AI_SUB_COST, RESCUE_DEALS,
  SERVICE_EVENTS, MILESTONES, storeValue, MAP,
}

// ---------------- 存档（localStorage） ----------------
const SAVE_KEY = 'ShutterCrisis_Proto_Save'
export function saveGame(s) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)) } catch (e) { /* 忽略 */ } }
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) { return null }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY) } catch (e) { /* 忽略 */ } }
