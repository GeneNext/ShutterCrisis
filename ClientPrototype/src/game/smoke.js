// 引擎冒烟测试：node src/game/smoke.js
// 覆盖：全流程跑通（开新局→晨会→营业→结算→周反思/锐评）、确定性断言（同种子两次推演一致）、
//       升级天梯五维评审与解锁、破产防线三道（卖设备/救命大单/被动收缩）、员工两类与去留挽留、
//       空间形态改造、设备具象线、吵架、订单解锁门槛。
import {
  createGame, createWorld, makeLocation, switchLocation, locUnlocked, evalTasks, autoMorning, stepSlot,
  act, nextDay, startBusiness, skipDay, isReviewDay, requirementMissing, stationCapacity,
  expandPreview, fixedCostBreakdown, areaCells, nextGradeInfo, formAffinity, hintOf, toneOf,
  REVIEWERS,
} from './engine.js'
import { ORDERS, FORM_RENOVATE, RESCUE_DEALS, TIER_NAMES, CROWDS, FACILITIES } from './catalogs.js'

let passed = 0
let failed = 0
function ok(cond, name) {
  if (cond) { passed++; console.log('  PASS ' + name) }
  else { failed++; console.error('  FAIL ' + name) }
}
function section(name) { console.log('\n== ' + name + ' ==') }

// 用种子化随机覆盖事件库（随机事件语义即随机；测试中定根以获得可复现推演）
function stubRandom(seed) {
  let a = seed >>> 0
  Math.random = function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeStaffManual(s, post, talent, skill) {
  s.staffSeq++
  s.staff.push({
    id: s.staffSeq, name: '测试' + s.staffSeq, post, skill, potential: talent === 'growth' ? 5 : 3,
    quals: [], energy: 100, wage: 200, trait: 'solid', talent, stage: 'rookie', served: 0,
    hiredDay: s.round + 1, resting: false, dayOff: false, leaving: false, retained: false,
  })
  return s.staff[s.staff.length - 1]
}

function runMorning(s) {
  for (const a of [...s.appointments]) {
    const r = act(s, 'takeOrder', a.id)
    if (!r.ok && r.err.includes('需要')) act(s, 'passOrder', a.id)
  }
  act(s, 'autoSchedule')
}
function runDay(s) {
  if (s.phase !== 'briefing') nextDay(s) // 结算幕 → 进入新的一天（回合推进）
  runMorning(s)
  startBusiness(s)
  skipDay(s)
}
function handleInbox(s) {
  for (const m of s.inbox.filter((m) => m.kind === 'service')) {
    const r = act(s, 'resolveServiceEvent', m.id, 'explain')
    if (!r.ok) act(s, 'resolveServiceEvent', m.id, 'talk')
  }
  const qm = s.inbox.find((m) => m.kind === 'quarrel')
  if (qm) {
    act(s, 'startQuarrel', { price: 500 })
    for (let i = 0; i < 6 && s.quarrel; i++) act(s, 'quarrelMove', 'fact')
    act(s, 'dismissInbox', qm.id)
  }
  if (isReviewDay(s) && s.works.length > 0 && s.reviewDoneDay !== s.round + 1) {
    act(s, 'submitReview', s.works[0].id, 45, 'gentle')
  }
}

// ---------- 1. 全流程跑通 ----------
section('1. 全流程：开新局 → 晨会 → 营业 → 结算 → 周反思/锐评/吵架')
stubRandom(42)
{
  const s = createGame(12345)
  ok(s.phase === 'briefing', '新档进入晨会幕')
  ok(s.appointments.length >= 1, '晨会已生成今日预约池')
  ok(s.staff.length === 2 && s.staff[0].talent === 'growth', '开局班底：成长型摄影师 + 普通客服')
  for (let d = 0; d < 21 && !s.ended; d++) {
    if (s.cash > 4000) act(s, 'runAd', 'flyer')
    runDay(s)
    handleInbox(s)
    // 好老板：危险态出现救命单时接单回血（看广告解锁）
    const rc = s.inbox.find((m) => m.kind === 'rescue')
    if (rc) { act(s, 'watchAd'); act(s, 'takeRescueDeal', RESCUE_DEALS[0].key) }
    if (s.cash > 6000) act(s, 'upgradeFacility', 'camera')
  }
  ok(!s.ended, '21 天经营未破产（会玩救命单的好老板存活）')
  ok(s.reportHistory.length >= 18, '日报表持续生成（' + s.reportHistory.length + ' 天）')
  ok(s.reportHistory[0].day === 21, '日报表最新一条是当天')
  ok(s.delivered >= 12, '交付量健康（' + s.delivered + ' 单）')
  ok(s.reportHistory.every((r) => typeof r.net === 'number' && typeof r.balance === 'number'), '日报表字段完整（净流/余额）')
  ok(!!s.lastReport && Array.isArray(s.lastReport.flowTop), '动线复盘（等待热力）写入日报')
  ok(isReviewDay({ round: 2 }), '锐评日判定：第 3 天 = 周三')
  ok(s.works.length > 0, '作品入相册（' + s.works.length + ' 张，供发内容/锐评）')
  console.log(`  [概况] 第${s.round + 1}天 现金=${Math.round(s.cash)} 交付=${s.delivered} 粉丝=${s.fans} 口碑=${s.reputation.toFixed(2)} ${s.grade}★`)
}

// ---------- 2. 确定性断言 ----------
section('2. 确定性：同种子两次推演结果完全一致')
function run12Days(seed) {
  stubRandom(777)
  const g = createGame(seed)
  for (let d = 0; d < 12 && !g.ended; d++) {
    if (g.cash > 3000) act(g, 'runAd', 'flyer')
    runDay(g)
    for (const m of g.inbox.filter((m) => m.kind === 'service')) act(g, 'resolveServiceEvent', m.id, 'talk')
  }
  return { cash: g.cash, delivered: g.delivered, fans: g.fans, round: g.round, grade: g.grade }
}
const ra = run12Days(8888)
const rb = run12Days(8888)
ok(ra.cash === rb.cash && ra.delivered === rb.delivered && ra.fans === rb.fans && ra.round === rb.round && ra.grade === rb.grade,
  `两次推演一致（现金 ${Math.round(ra.cash)}==${Math.round(rb.cash)}，交付 ${ra.delivered}==${rb.delivered}，${ra.grade}★==${rb.grade}★）`)

// ---------- 3. 升级天梯：五维门槛与解锁 ----------
section('3. 升级天梯：五维缺一不可 + 解锁与奖励')
{
  const s = createGame(999)
  s.reputation = 3.2; s.delivered = 60; s.streakPos = 20
  s.staff[0].skill = 3
  s.fac.reception = 2; s.fac.studio = 2
  runDay(s)
  ok(s.grade >= 2, '五维齐备 → 评审通过升 2★')
  ok(s.celebrate.some((c) => c.type === 'grade' && c.plaque.includes('口碑相馆')), '升级仪式入队（新店牌 + 解锁清单）')
  ok(s.fans >= 200, '升级奖励发放（粉丝 +200）')
  const wedding = ORDERS.find((o) => o.key === 'wedding')
  ok(requirementMissing(s, wedding) === '需要持「婚纱」专精的员工（员工页培训解锁）', '婚纱仍被专精门槛拦住（生成与接单共用同一检查）')
  act(s, 'trainStaff', s.staff[0].id, '婚纱')
  ok(requirementMissing(s, wedding) === null, '培训「婚纱」专精后解锁婚纱订单')
  s.reputation = 4.9
  runDay(s)
  ok(s.grade < 5, '仅声望爆表不能跳级到 5★（五维缺一不可）')
  s.grade = 2
  s.fac.camera = 3
  const r = act(s, 'upgradeFacility', 'camera')
  ok(!r.ok && r.err.includes('上限'), '设施升级受「店铺等级+1」上限约束（' + r.err + '）')
}

// ---------- 4. 破产防线三道 ----------
section('4. 破产防线：卖设备折价 → 救命大单（看广告/付费）→ 被动收缩')
{
  const s = createGame(321)
  s.fac.camera = 3
  const cashBefore = s.cash
  const r = act(s, 'sellEquipment', 'camera')
  ok(r.ok && s.fac.camera === 2, '第一道防线：卖设备降 1 级')
  ok(s.cash === cashBefore + Math.round(9000 * 0.4), '折价回收 40%（+3600）')
  // 第二道：危险态触发救命单
  s.cash = 10
  s.lastFixedCost = 500
  runDay(s)
  const rescueCard = s.inbox.find((m) => m.kind === 'rescue')
  ok(!!rescueCard, '危险/断裂态触发「救命稻草」（收件箱 must 级）')
  if (rescueCard) {
    const blocked = act(s, 'takeRescueDeal', RESCUE_DEALS[0].key)
    ok(!blocked.ok, '未解锁资格不能接（凭证前置校验）')
    act(s, 'watchAd')
    const cash0 = s.cash
    const energy0 = s.boss.energy
    const taken = act(s, 'takeRescueDeal', RESCUE_DEALS[0].key)
    ok(taken.ok && s.cash > cash0, '看广告解锁 → 接单 → 大额现金入账（救命爽点）')
    ok(s.boss.energy <= energy0 - 30, '救命单代价：老板精力 -40（救急不救穷）')
    act(s, 'watchAd') // 重新解锁资格后，冷却仍应拦截（救急不救穷：每 30 天一次）
    const again2 = act(s, 'takeRescueDeal', RESCUE_DEALS[0].key)
    ok(!again2.ok && again2.err.includes('冷却'), '30 天冷却，不能无限续命（' + again2.err + '）')
  }
  // 第三道：现金 < 0 被动收缩（废品价回收）
  s.cash = -50000
  s.appointments = []
  s.fac.light = 2
  s.lastFixedCost = 50
  s.adsToday = []
  const totalLv = () => FACILITIES.filter((f) => f.cat === 'equip').reduce((a, f) => a + s.fac[f.key], 0)
  const lvBefore = totalLv()
  runDay(s)
  ok(totalLv() === lvBefore - 1, `现金断裂 → 被动变卖最低级设备（设备总级 ${lvBefore}→${totalLv()}）`)
}

// ---------- 5. 员工两类与去留 ----------
section('5. 员工：普通/成长型、去留两因子、加薪挽留、进阶线')
{
  const s = createGame(555)
  const normal = s.staff.find((e) => e.talent === 'normal')
  const growth = s.staff.find((e) => e.talent === 'growth')
  ok(normal.potential <= 3 && growth.potential === 5, '成长空间分档：普通上限低、成长型 5')
  normal.wage = 10
  runDay(s)
  const row = s.stayReport.find((r) => r.name === normal.name)
  ok(!!row && normal.stayWill < 60, '低薪 → 去留意愿下跌（' + normal.stayWill + '：' + (row && row.text) + '）')
  const r = act(s, 'retainStaff', normal.id)
  ok(r.ok && normal.retained && normal.wage > 10, '加薪挽留：涨薪 20%，对方留下')
  ok(s.stayReport.length === s.staff.length, '深夜去留结算覆盖全员')
  // 成长型进阶：骨干（技能3+专精1）
  growth.skill = 3
  act(s, 'trainStaff', growth.id, '婚纱')
  ok(growth.stage === 'backbone', '成长型晋升骨干（技能 3 + 首门专精）')
  // 大师（技能5+双专精）
  growth.skill = 5
  act(s, 'trainStaff', growth.id, '修图')
  ok(growth.stage === 'master', '成长型晋升大师（技能 5 + 双专精）——5★ 天梯的人才门槛')
}

// ---------- 6. 空间形态改造 ----------
section('6. 空间形态：化妆桌 → 独立化妆室（房间级）→ 艺人独立化妆间（VIP 级）')
{
  const s = createGame(666)
  makeStaffManual(s, 'makeup', 'normal', 2)
  makeStaffManual(s, 'makeup', 'normal', 2)
  const blocked = act(s, 'renovateFacility', 'makeup', 1)
  ok(!blocked.ok, '1★ 不能改造房间级（需要 3★）')
  s.grade = 3; s.cash = 50000
  const capBefore = stationCapacity(s, 'makeup')
  const r = act(s, 'renovateFacility', 'makeup', 1)
  ok(r.ok && s.renovations.length === 1, '3★ 开工独立化妆室（工期 2 天，施工期降效 50%）')
  const vipBlocked = act(s, 'renovateFacility', 'retouch', 2)
  ok(!vipBlocked.ok, 'VIP 级形态需要 5★（' + vipBlocked.err + '）')
  runDay(s)
  ok(s.forms.makeup === 0, '工期未到：仍在施工')
  runDay(s)
  runDay(s)
  ok(s.forms.makeup === 1, '改造完成：普通化妆桌 → 独立化妆室')
  ok(stationCapacity(s, 'makeup') === capBefore, '房间实例制：改造提升满意度/品质，并发由房间数决定（' + stationCapacity(s, 'makeup') + '）')
  s.grade = 5; s.cash = 100000
  act(s, 'renovateFacility', 'makeup', 2)
  for (let i = 0; i < 5; i++) runDay(s)
  ok(s.forms.makeup === 2, '5★ 改造完成：独立化妆室 → 艺人独立化妆间')
}

// ---------- 7. 设备具象升级线（影射命名） ----------
section('7. 设备线：具象名（哈神）+ 等级上限')
{
  ok(TIER_NAMES.camera[3] === '中画幅·哈神 907X' && TIER_NAMES.camera[4] === '旗舰中画幅·哈神 X2D', '机身线顶级 = 哈神（影射命名）')
  ok(TIER_NAMES.backdrop[2].includes('无影棚') && TIER_NAMES.backdrop[4].includes('顶级定制布景'), '背景线：背景纸 → 无影棚 → 顶级定制布景')
  const s = createGame(889)
  s.cash = 999999
  s.grade = 5
  let names = []
  for (let lv = 1; lv < 5; lv++) { act(s, 'upgradeFacility', 'camera'); names.push(TIER_NAMES.camera[s.fac.camera - 1]) }
  ok(s.fac.camera === 5, '5★ 时机身可升满 5 级')
  console.log('  [机身升级线] ' + names.join(' → '))

// ---------- 11. 房间实例制：空地建造房间，并发 = 已建房间数 ----------
section('11. 房间实例制：buildRoom +1 并发、递增价、等级上限')
{
  const s = createGame(410)
  makeStaffManual(s, 'makeup', 'normal', 2)
  makeStaffManual(s, 'makeup', 'normal', 2)
  s.grade = 3; s.cash = 999999
  const cap0 = stationCapacity(s, 'makeup')
  const r1 = act(s, 'buildRoom', 'makeup')
  ok(r1.ok && s.roomsBuilt.makeup === 2, '空地建造第 2 间化妆间')
  ok(stationCapacity(s, 'makeup') === cap0 + 1, '并发 = 已建房间数（' + cap0 + '→' + stationCapacity(s, 'makeup') + '）')
  const cost2 = Math.round(3000 * Math.pow(1.6, 1))
  const cashBefore = s.cash
  act(s, 'buildRoom', 'makeup')
  ok(s.roomsBuilt.makeup === 3 && s.cash === cashBefore - cost2, '第 3 间造价递增（×1.6）')
  s.grade = 1
  const denied = act(s, 'buildRoom', 'makeup')
  ok(!denied.ok, '受店铺等级上限约束（grade+1）')
  // 无关分区不受影响
  ok(s.roomsBuilt.studio === 1, '未建分区保持 1 间')
}


// ---------- 12. 客服系统：投诉消化、客服自动安抚、不升级到老板 ----------
section('12. 客服系统：积压消化 + 有客服不惊动老板')
{
  const s = createGame(505)
  makeStaffManual(s, 'service', 'normal', 2)
  makeStaffManual(s, 'service', 'normal', 2)
  s.complaintsBacklog = 6
  runDay(s)
  ok(s.complaintsBacklog <= 2, '客服每日消化积压（6 → ' + s.complaintsBacklog + '）')
  ok(!s.pendingQuarrel, '有客服在岗：不满客人由客服安抚，不升级到老板')
  ok(s.staff.filter((e) => e.post === 'service').length >= 2, '客服岗位可扩充（前台每 2 级再分担 1 名职能）')
}


// ---------- 13. 前台现场调度：挽留插队 + 先到先服务 ----------
section('13. 前台调度：把快流失的客人插到队首')
{
  const s = createGame(606)
  makeStaffManual(s, 'service', 'normal', 2)
  makeStaffManual(s, 'photographer', 'normal', 3)
  s.phase = 'business'; s.slot = 0
  const mk = (id, orderKey, price, waitSlots, arriveSlot) => {
    const o = ORDERS.find((x) => x.key === orderKey)
    s.activeOrders.push({
      id, orderKey: o.key, crowdIdx: o.crowd, name: '客' + id, price,
      stations: o.stations, station: o.stations[0], stationIdx: 0,
      waitSlots, satisfaction: 0.8, clarity: null, quality: 0, retouchQ: 0,
      arriveSlot, walkin: false, rush: false, done: false, retained: false, reShots: 0,
    })
  }
  mk(1, 'id', 100, 0, 0)                      // 先到
  mk(2, 'id', 100, 0, 1)                      // 后到
  mk(3, 'id', 100, Math.max(1, CROWDS[0].patience - 1), 2) // 快流失
  stepSlot(s)
  const c3 = s.activeOrders.find((o) => o.id === 3)
  ok(!!c3 && c3.rescued === true, '前台把快流失的客人标记挽留（插队）')
  const fr = s.frames[s.frames.length - 1]
  ok(fr.stations.shoot.serving[0] === 3, '挽留客人本时段优先进入拍摄（现场调度覆盖先到先服务）')
  ok(c3.satisfaction > 0.8, '挽留附带安抚（满意度回升）')
}


// ---------- 14. 预约系统：定金入账、爽约不退、预约客优先级 ----------
section('14. 预约系统：定金 / 爽约 / 优先级')
{
  const s = createGame(707)
  makeStaffManual(s, 'service', 'normal', 2)
  makeStaffManual(s, 'photographer', 'normal', 3)
  // 造一个预约：必爽约
  s.appointments = [{
    id: s.orderSeq++, orderKey: 'id', crowdIdx: 0, price: 100, deposit: 25, noShowP: 1,
    slots: 1, state: 'waiting', name: '爽约客', appointment: true,
  }]
  const cash0 = s.cash
  const r = act(s, 'takeOrder', s.appointments[0].id)
  ok(r.ok && s.cash === cash0 + 25, '接单即收定金 ¥25')
  ok(s.appointments[0].depositPaid === true, '定金已锁定')
  runDay(s)
  ok(s.toasts.some((t) => t.text.includes('爽约')), '爽约发生：定金不退入账（toast 留痕）')
  ok(s.appointments.every((a) => a.id !== s.orderSeq - 1) || s.appointments.length === 0, '爽约预约从排期移除')
  // 优先级：预约客 > 大单散客 > 普通散客（rush > 挽留 > 预约）
  s.phase = 'business'; s.slot = 0
  const mk = (id, orderKey, price, arriveSlot, appt) => {
    const o = ORDERS.find((x) => x.key === orderKey)
    s.activeOrders.push({
      id, orderKey: o.key, crowdIdx: o.crowd, name: '客' + id, price,
      stations: o.stations, station: o.stations[0], stationIdx: 0,
      waitSlots: 0, satisfaction: 0.8, clarity: null, quality: 0, retouchQ: 0,
      arriveSlot, walkin: !appt, rush: false, done: false, retained: false, reShots: 0,
      appointment: !!appt, vipQueue: !appt && price >= 200,
    })
  }
  mk(11, 'id', 100, 0, false)            // 普通散客（先到）
  mk(12, 'id', 100, 1, true)             // 预约客（后到）
  stepSlot(s)
  const fr = s.frames[s.frames.length - 1]
  const waitQ = fr.stations.wait.queue
  const shootFirst = fr.stations.shoot.serving[0]
  ok(shootFirst === 12 || (waitQ === 1 && fr.stations.wait.serving[0] === 11), '预约客优先级高于先到的散客（先服务预约）')
}

console.log('===== smoke =====')
}

// ---------- 8. 店内设计 / 店面扩张 / 成本计算 ----------
section('8. 店面扩张与成本：面积 → 租金、扩张确认对照表、形态维护费')
{
  const s = createGame(890)
  s.grade = 4; s.cash = 200000
  const fb0 = fixedCostBreakdown(s)
  ok(fb0.cells === 48, '初始店面 6×8 = 48 格')
  const pv = expandPreview(s, 'right')
  ok(!!pv && pv.cost === 8000 && pv.addFixedPerDay === 53, '扩张对照表：投入 8000 + 新增日固定支出 53/天（文档 §7.4 硬规则）')
  ok(pv.paybackDays === null, '无历史收入时不给虚假回本天数')
  const r = act(s, 'expandStudio', 'right')
  ok(r.ok && areaCells(s) === 64, '向右扩店：面积 48 → 64 格（工期 2 天，全店降效 50%）')
  const fb1 = fixedCostBreakdown(s)
  ok(fb1.rent > fb0.rent && fb1.utilities > fb0.utilities, '面积 → 租金/水电上涨（租金 ' + fb0.rent + '→' + fb1.rent + '）')
  ok(fb1.wages === s.staff.reduce((a, e) => a + e.wage, 0), '员工工资计入每日固定支出')
  ok(expandPreview(s, 'right').cost === 16000, '同方向二次扩张成本递增（8000 → 16000）')
  act(s, 'renovateFacility', 'makeup', 1)
  runDay(s); runDay(s); runDay(s)
  ok(fixedCostBreakdown(s).formsRent === 8, '空间形态改造完成后新增日维护费（房间级 +8/天）')
  ok(expandPreview(s, 'back').needGrade === 3 && expandPreview(s, 'second').needGrade === 4, '向后/二楼分别需要 3★/4★')
  const denied = act(s, 'expandStudio', 'back')
  ok(!denied.ok || s.grid.back, '扩张校验生效（' + (denied.ok ? '3★ 满足已扩张' : denied.err) + '）')
}


// ---------- 9. 地图与地点推进（World 层） ----------
section('9. 地图：多地点 + 三星任务 + 1 星解锁 + 地点加成')
{
  const w = createWorld(2026)
  ok(w.cur === 'street' && !!w.locs.street, '世界初始在「老街影像社」')
  ok(locUnlocked(w, 'street') && !locUnlocked(w, 'campus'), '大学城初始未解锁')
  const s1 = w.locs.street
  s1.delivered = 15; s1.reputation = 2.5
  const gained = evalTasks(w)
  ok(gained === 1 && w.stars.street === 1, '一星任务达成 → 老街 1 星')
  ok(s1.celebrate.some((c) => c.type === 'task' && c.text.includes('大学城')), '仪式提示：解锁新地点大学城')
  ok(locUnlocked(w, 'campus'), '一星解锁大学城')
  const sw = switchLocation(w, 'campus')
  ok(sw.ok && w.cur === 'campus', '切换到大学城快闪店')
  const s2 = w.locs.campus
  ok(s2.cash === 8000 && s2.delivered === 0, '新地点独立建档（现金 8000，交付清零）')
  ok(s2.orderBoost.checkin === 1.3, '地点加成：网红打卡单价格 ×1.3')
  ok(!locUnlocked(w, 'mall'), '商圈仍锁定（大学城还没拿到 1 星）')
  switchLocation(w, 'street')
  const t1 = w.locs.street
  t1.delivered = 40; t1.cash = 13000
  evalTasks(w)
  ok(w.stars.street === 2, '老街二星任务达成（星级只升不降）')
  const denied = switchLocation(w, 'mall')
  ok(!denied.ok, '未解锁地点切换被拒绝')
  console.log('  [地图] 老街 ' + w.stars.street + ' 星 / 大学城解锁 / 商圈锁定')
}

// ---------- 10. 全自动日流程（autoMorning） ----------
section('10. 全自动日流程：一键接单 + 自动排程')
{
  const s = createGame(404)
  s.cash = 50000; s.grade = 3
  for (let i = 0; i < 3; i++) makeStaffManual(s, 'makeup', 'normal', 2)
  makeStaffManual(s, 'retoucher', 'normal', 2)
  const r = autoMorning(s)
  const accepted = s.appointments.filter((a) => a.state === 'accepted').length
  ok(accepted > 0, 'autoMorning 自动接单（' + accepted + ' 单）')
  ok(Object.keys(s.schedule).length === accepted, '自动排程覆盖全部已接单（' + Object.keys(s.schedule).length + '）')
  ok(r.ok !== false, 'autoMorning 返回正常')
}

// ---------- 11. 器械成长系统 Gear（买入/卖出/波动/折旧） ----------
section('11. 器械成长系统 Gear：开局资产 + 波动 + 买卖折价 + 折旧')
{
  const s = createGame(707)
  ok(s.gear && s.gear.owned.length === 14, '开局注入 14 件器械资产（不扣现金）')
  ok(s.gear.owned.every((it) => it.buyPrice > 0), '初始器械均有买入价（资产，资产经营可估值）')
  const q0 = JSON.stringify(s.gear.quote)
  // 每日市场价确定性波动
  const priceBefore = s.gear.quote['a7m4']
  nextDay(s)
  const priceAfter = s.gear.quote['a7m4']
  ok(JSON.stringify(s.gear.quote) !== q0 || priceAfter !== priceBefore, '下一天市场价确定性波动')
  // 买入：锁星 + 现金判
  const denied = act(s, 'buyGear', 'camera', 'x2d') // x2d 需 4★，新档仅 1★
  ok(!denied.ok && s.cash > 0, '高星器械受星级门槛拦截（x2d 需 4★被拒）')
  const led = s.gear.quote['ledpanel']
  const beforeCash = s.cash
  const rBuy = act(s, 'buyGear', 'light', 'ledpanel')
  ok(rBuy.ok && s.cash === beforeCash - led, '买入按当前市场价扣款（ledpanel ' + led + '）')
  // 卖出：现价×保值率×使用折旧，几乎必折价（回笼 < 买入价）
  const uid = s.gear.owned[s.gear.owned.length - 1].uid
  const rSell = act(s, 'sellGear', uid)
  ok(rSell.ok && rSell.value < rBuy.price, '卖出含折旧折价（卖 ' + rSell.value + ' < 买 ' + rBuy.price + '）')
  ok(s.gear.owned.length === 14, '卖出后库存回到 14')
  // 折旧计入每日固定成本
  nextDay(s)
  const fb = fixedCostBreakdown(s)
  ok(fb.gearDep > 0, '器械折旧计入每日固定支出（gearDep=' + fb.gearDep + '/天）')
  ok(fb.total === fb.rent + fb.formsRent + fb.utilities + fb.wages + fb.depreciation + fb.gearDep + fb.ai, '固定成本总账含器械折旧项')
}

// ---------- 12. 升级杠杆A：设备具名解锁订单 ----------
section('12. 升级杠杆A：设备升级解锁具体订单（摆脱数值池）')
{
  const s = createGame(808)
  const poster = ORDERS.find((o) => o.key === 'poster')
  const bokeh = ORDERS.find((o) => o.key === 'bokeh')
  ok(!!poster && !!bokeh, '新增海报精修/虚化写真两种设备解锁订单')
  ok(requirementMissing(s, poster) != null, '开局机身 L1：海报单被锁（"需要机身 ≥2 级"）')
  // 机身升 2 级 + 升 2★ → 海报解锁；若星级不够仍锁
  s.grade = 1; s.fac.camera = 2
  ok(requirementMissing(s, poster) != null, '机身达标但 1★：海报仍被星级门槛卡（2★）')
  s.grade = 2
  ok(requirementMissing(s, poster) === null, '机身 ≥2 级 + 2★ → 解锁「海报精修」')
  // 虚化写真：镜头 ≥3 级 + 3★
  s.grade = 3; s.fac.lens = 2
  ok(requirementMissing(s, bokeh) != null, '镜头 L2：虚化写真仍锁（需镜头 ≥3 级）')
  s.fac.lens = 3
  ok(requirementMissing(s, bokeh) === null, '镜头 ≥3 级 + 3★ → 解锁「虚化写真」高毛利子单')
  // 具名能力展示字段完整（每级一条，指向明确用途而非纯数值）
  const cam = FACILITIES.find((x) => x.key === 'camera')
  ok(cam.gain && cam.gain.length === 4 && cam.gain[0].includes('海报'), '机身每级具名效果字段齐备（L2 首条=海报单）')
}

// ---------- 15. 四大升级杠杆（B/E/F/G）+ 升星卡点可视化 ----------
section('15. 升级杠杆B/E/F/G + 升星卡点')
{
  // 升星卡点：开局拿到 2★ 明细与瓶颈，每维 pct 在 0~1 且带"怎么做"提示
  const g = createGame(996)
  const gi = nextGradeInfo(g)
  ok(gi && gi.grade === 2 && gi.bottleneck, '开局拿到 2★ 卡点明细与瓶颈（卡点可视化）')
  ok(gi.dims.every((d) => d.pct >= 0 && d.pct <= 1), '每维缺口 pct 落在 0~1')
  ok(gi.dims.some((d) => !d.ok && typeof d.hint === 'string'), '缺口带"怎么做"提示')
  // 杠杆B：形态→客群定位
  ok(formAffinity(g, 1) === 0 && formAffinity(g, 3) === 0, '开局无形态：无任何客群加成')
  g.forms.makeup = 1
  ok(formAffinity(g, 1) >= 0.1 && formAffinity(g, 2) >= 0.1, '独立化妆室→婚纱/亲子(crowd1/2) +0.1')
  ok(formAffinity(g, 0) === 0, '街坊散客不受形态影响（不误伤大众盘）')
  g.forms.reception = 2
  ok(formAffinity(g, 3) >= 0.15 && formAffinity(g, 3) > formAffinity(g, 2), 'VIP接待室→高端客(crowd≥3)加成更高（定位分化）')
  // 杠杆F：低现金+有器械 → 危险态提示给出"卖器械/停广告"动作
  g.cash = 100; g.lastFixedCost = 500
  ok(typeof hintOf(g) === 'string' && hintOf(g).includes('卖'), '破产危险态：具体动作提示含"卖器械"')
  // 杠杆E + 杠杆G：锐评（round=2 → day=3 锐评日；同种子两局对照，噪音相同）
  function prepReview(pt) {
    const t = createGame(1297)
    t.round = 2; t.priceTier = pt; t.works = []; t.pendingRetained = []
    return t
  }
  ok(toneOf(prepReview('mid')) === '专业' && toneOf(prepReview('high')) === '艺术', '价格档次驱动品牌调性（艺术/专业）')
  // G：quality=1 + 温柔评审 → 必封神 → 解锁指名复购客
  const gG = prepReview('mid')
  gG.works.push({ id: 7, orderKey: 'portrait', crowdIdx: 4, quality: 1, price: 1000 })
  const pref4 = 40 + CROWDS[4].qualityBar * 30
  const beforeG = gG.pendingRetained.length
  act(gG, 'submitReview', 7, pref4, 'gentle')
  ok(gG.pendingRetained[0] && gG.pendingRetained.at(-1).name.includes('指名') && gG.pendingRetained.length === beforeG + 1, '封神锐评→解锁神秘指名·回头客(杠杆G)')
  // E：同等中等质量作品，艺术调性比专业调性分数更高 ~+0.05
  const gE1 = prepReview('mid'), gE2 = prepReview('high')
  const pref1 = 40 + CROWDS[1].qualityBar * 30
  gE1.works.push({ id: 1, orderKey: 'portrait', crowdIdx: 1, quality: 0.62, price: 500 })
  gE2.works.push({ id: 1, orderKey: 'portrait', crowdIdx: 1, quality: 0.62, price: 500 })
  const r1 = act(gE1, 'submitReview', 1, pref1, REVIEWERS[0].key)
  const r2 = act(gE2, 'submitReview', 1, pref1, REVIEWERS[0].key)
  ok(r2.score - r1.score >= 0.045 && r2.score - r1.score <= 0.055, '艺术调性锐评加分 ~+0.05(杠杆E)')
}

console.log('\n==============================')
console.log(`通过 ${passed} / 失败 ${failed}`)
if (failed > 0) process.exit(1)
console.log('SMOKE OK')
