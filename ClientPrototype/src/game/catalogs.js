// ============================================================
// 《营业！快门危机》React 原型 · 游戏目录（单一事实源）
// 依据：Doc/原型设定-V2.md（老板反馈循环 / 客人即可视化现金流 /
//       店铺等级五维天梯 / 设备与空间形态具象升级线 / 破产防线 /
//       两类员工 / 服务分级 / 微操收敛到锐评时刻）
// 数值为原型调参初值，全部可在此处调整。
// ============================================================

// ---------- 确定性随机（存档可复现；随机事件库除外） ----------
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function roll(st, salt) {
  // 由天数+盐派生的确定性 roll，不消费全局随机流
  return mulberry32((st.round * 100003 + salt * 7919 + st.seed) >>> 0)()
}

// ---------- 设施：6 分区 + 休息区 + 5 设备线（等级 1~5，上限 = 店铺等级+1） ----------
export const FACILITIES = [
  { key: 'reception', name: '接待区', cat: 'zone', upCost: [0, 1200, 2600, 5200, 9000], desc: '等待座位与时段上限：每级 +1 时段' },
  { key: 'makeup',    name: '化妆区', cat: 'zone', upCost: [0, 1500, 3000, 6000, 10000], desc: '上妆并发与妆效' },
  { key: 'studio',    name: '棚拍区', cat: 'zone', upCost: [0, 1600, 3400, 6800, 12000], desc: '拍摄并发与质量上限' },
  { key: 'retouch',   name: '后期区', cat: 'zone', upCost: [0, 1000, 2200, 4600, 8000], desc: '修图速度与交付' },
  { key: 'storage',   name: '储物区', cat: 'zone', upCost: [0, 600, 1400, 2800, 5000], desc: '耗材成本 -，设备故障 -' },
  { key: 'display',   name: '展示区', cat: 'zone', upCost: [0, 800, 1800, 3600, 6400], desc: '候诊客人烦躁 -，新客信任 +' },
  { key: 'rest',      name: '休息区', cat: 'zone', upCost: [0, 900, 2000, 4200, 7600], desc: '员工精力恢复（去留因子）', minGrade: 2 },
  { key: 'camera',    name: '机身',   cat: 'equip', upCost: [0, 2000, 4500, 9000, 18000], desc: '画质上限' },
  { key: 'lens',      name: '镜头',   cat: 'equip', upCost: [0, 1800, 4000, 8200, 16000], desc: '虚化与构图上限' },
  { key: 'light',     name: '灯光',   cat: 'equip', upCost: [0, 1600, 3600, 7400, 15000], desc: '光影质量' },
  { key: 'backdrop',  name: '背景',   cat: 'equip', upCost: [0, 1500, 3200, 7000, 14000], desc: '场景多样性' },
  { key: 'prop',      name: '道具',   cat: 'equip', upCost: [0, 700, 1600, 3400, 6600], desc: '特殊订单解锁（亲子/宠物）' },
  { key: 'retoucheq', name: '修图设备', cat: 'equip', upCost: [0, 900, 2000, 4300, 8800], desc: '交付提速' },
]

// 设备具象升级线（影射命名：哈苏→哈神，佳能→加能，尼康→尼辰，索尼→索灵，
// Profoto→宝富灯，Elinchrom→爱灵灯；不用商标图形，不宣称同款）
export const TIER_NAMES = {
  camera: ['二手入门机·灵光DC', '中端全画幅·加能 R8', '旗舰全画幅·加能 R1', '中画幅·哈神 907X', '旗舰中画幅·哈神 X2D'],
  lens:   ['套机标变', '大三元·尼辰 S 系列', '定焦军团·尼辰 58G', '电影镜头·灵眸 Cine', '顶级定焦·哈神 38V'],
  light:  ['杂牌灯架（亮就行）', '影室灯·爱灵灯 250', '影室灯·宝富灯 D2', '外拍电箱·宝富灯 Pro10', '全无线顶级·宝富灯 S500'],
  backdrop: ['背景纸卷 1.5m（换色靠手撕）', '背景纸卷 2.7m（宽幅）', '无影棚 + 主题布景', '商业影棚基础景', '顶级定制布景（实景搭建）'],
  prop:   ['基础道具箱', '儿童道具组', '宠物安抚套装', '商业布景道具组', '全套主题道具库'],
  retoucheq: ['家用电脑修图', '专业工作站·色准屏', '修图流水线 ×2', '后期工作室', '团队流水线 + AI 辅助位'],
}

// ---------- 空间形态改造（家具级 → 房间级 → VIP 级） ----------
// forms[key] = 0 家具级 / 1 房间级(3★解锁) / 2 VIP级(5★解锁)
export const FORMS = {
  makeup:    ['普通化妆桌（开放角落）', '独立化妆室（隔间 ×N）', '艺人独立化妆间（专属套房）'],
  reception: ['前台桌 + 站位', '接待厅（等候 + 选片角）', 'VIP 接待室（到店即入）'],
  studio:    ['一面背景墙', '独立影棚（可清场）', '多主题影棚群（商拍级）'],
  select:    ['选片桌（共用）', '独立选片室', 'VIP 选片室'],
  retouch:   ['角落工位', '修图室', '后期工作室'],
  rest:      ['休息角（椅子 + 饮水机）', '员工休息室', '员工休息室'],
}
export const FORM_RENOVATE = {
  // 目标形态 → { cost, days, 容量跳变 }
  1: { cost: 6000, days: 2, capBonus: 1 },
  2: { cost: 20000, days: 4, capBonus: 2 },
}

// ---------- 订单类型（10 种；stations 决定动线路径） ----------
export const ORDERS = [
  { key: 'id',     name: '证件照',   price: 100,    slots: 1, crowd: 0, stations: ['wait', 'shoot', 'deliver'], unlock: {} },
  { key: 'portrait', name: '标准写真', price: 500,  slots: 2, crowd: 1, stations: ['wait', 'consult', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: {} },
  { key: 'checkin', name: '网红打卡', price: 200,  slots: 1, crowd: 1, stations: ['wait', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: {} },
  { key: 'wedding', name: '婚纱',     price: 3000, slots: 4, crowd: 2, stations: ['wait', 'consult', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: { grade: 2, quals: ['婚纱'] } },
  { key: 'family',  name: '亲子',     price: 800,  slots: 2, crowd: 2, stations: ['wait', 'consult', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: { grade: 3, fac: { prop: 1 } } },
  { key: 'pet',     name: '宠物',     price: 700,  slots: 2, crowd: 2, stations: ['wait', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: { grade: 3, fac: { prop: 2 } } },
  { key: 'product', name: '商业产品', price: 2500, slots: 2, crowd: 3, stations: ['wait', 'consult', 'shoot', 'retouch', 'deliver'], unlock: { grade: 3, fac: { light: 3 } } },
  { key: 'corp',    name: '企业形象照', price: 4000, slots: 2, crowd: 3, stations: ['wait', 'consult', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: { grade: 3 } },
  { key: 'custom',  name: '高端定制', price: 8000, slots: 4, crowd: 4, stations: ['wait', 'consult', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: { grade: 4, quals: ['商业'] } },
  { key: 'ad',      name: '广告商拍', price: 15000, slots: 4, crowd: 4, stations: ['wait', 'consult', 'makeup', 'shoot', 'select', 'retouch', 'deliver'], unlock: { grade: 4, forms: ['studio'], quals: ['商业'] } },
]

// ---------- 客群 5 档（价格敏感 → 要求高；留存/传播参数） ----------
export const CROWDS = [
  { key: 'street', name: '街坊散客', priceMul: 0.8, patience: 2, trouble: 0.20, spread: 0.04, tip: 0.05, qualityBar: 0.35, desc: '价格敏感、耐心低、砍价狠、差评多' },
  { key: 'mass',   name: '大众写真客', priceMul: 1.0, patience: 2, trouble: 0.10, spread: 0.10, tip: 0.08, qualityBar: 0.45, desc: '看性价比、跟风打卡、传播力中' },
  { key: 'family', name: '品质家庭客', priceMul: 1.1, patience: 3, trouble: 0.06, spread: 0.16, tip: 0.12, qualityBar: 0.55, desc: '重服务与陪同、复购强、爱介绍客' },
  { key: 'corp',   name: '企业/专业客', priceMul: 1.3, patience: 3, trouble: 0.05, spread: 0.10, tip: 0.05, qualityBar: 0.68, desc: '价格不敏感、要求高、验收严' },
  { key: 'star',   name: '艺人团队/广告主', priceMul: 1.6, patience: 4, trouble: 0.04, spread: 0.25, tip: 0.15, qualityBar: 0.78, desc: '钱不是问题、要想法与执行、自带流量' },
]

// ---------- 定价 5 档 / walk-in 3 档 ----------
export const PRICING = [
  { key: 'low',    name: '低价引流', mul: 0.6, flow: 1.5, repDay: -0.01, brand: '亲民' },
  { key: 'normal', name: '市场均价', mul: 1.0, flow: 1.0, repDay: 0, brand: '亲民' },
  { key: 'mid',    name: '中高端',   mul: 1.5, flow: 0.7, repDay: 0.01, brand: '专业' },
  { key: 'high',   name: '高端定制', mul: 2.5, flow: 0.4, repDay: 0.02, brand: '艺术' },
  { key: 'lux',    name: '奢侈',     mul: 4.0, flow: 0.2, repDay: 0.03, brand: '艺术' },
]
export const WALKIN_POLICY = [
  { key: 'appoint', name: '预约优先', walkinMul: 0.5, desc: '动线稳，收益可预期（高端/婚纱路线）' },
  { key: 'balanced', name: '均衡', walkinMul: 1.0, desc: '默认' },
  { key: 'open',    name: '来者不拒', walkinMul: 1.8, desc: '散客多、排队风险高（亲民/网红路线）' },
]

// ---------- 广告渠道 6（解锁数随店铺等级） ----------
export const CHANNELS = [
  { key: 'flyer',   name: '社区传单', cost: 80,  fans: 4,   flow: 0.06, brand: '亲民', grade: 1 },
  { key: 'moments', name: '朋友圈',   cost: 120, fans: 8,   flow: 0.10, brand: '亲民', grade: 1 },
  { key: 'redbook', name: '小红书',   cost: 300, fans: 25,  flow: 0.15, brand: '网红', grade: 2 },
  { key: 'douyin',  name: '抖音',     cost: 350, fans: 30,  flow: 0.20, brand: '网红', grade: 2 },
  { key: 'magazine', name: '本地杂志', cost: 800, fans: 12, flow: 0.10, brand: '专业', grade: 3 },
  { key: 'partner', name: '异业合作', cost: 500, fans: 18, flow: 0.16, brand: '专业', grade: 3 },
]
export const CONTENT_TOPICS = [
  { key: 'work',    name: '作品分享', mul: 1.0 },
  { key: 'behind',  name: '拍摄花絮', mul: 1.2 },
  { key: 'tutorial', name: '摄影干货', mul: 1.1 },
  { key: 'daily',   name: '店招日常', mul: 0.8 },
  { key: 'hot',     name: '热点跟拍', mul: 1.4 },
]

// ---------- 岗位 / 特质 / 专精资格 ----------
export const POSTS = [
  { key: 'photographer', name: '摄影师', wage: 200, hire: 800 },
  { key: 'retoucher',    name: '修图师', wage: 160, hire: 600 },
  { key: 'makeup',       name: '化妆师', wage: 160, hire: 600 },
  { key: 'service',      name: '客服',   wage: 100, hire: 400 },
  { key: 'assistant',    name: '助理',   wage: 80,  hire: 300 },
]
export const TRAITS = [
  { key: 'perfect', name: '完美主义', err: -0.3, spd: -0.1, flavor: '质量高，速度慢' },
  { key: 'hasty',   name: '急性子',   err: 0.3,  spd: 0.15, flavor: '速度快，出错率高' },
  { key: 'social',  name: '社牛',     err: 0,    spd: 0,    flavor: '客人满意度 +，安抚排队' },
  { key: 'shy',     name: '社恐',     err: -0.1, spd: 0.05, flavor: '技术好，接待差' },
  { key: 'artist',  name: '艺术家',   err: 0,    spd: -0.05, flavor: '高难单质量 +，讨厌重复' },
  { key: 'solid',   name: '务实',     err: 0,    spd: 0,    flavor: '稳定，没有惊喜' },
  { key: 'owl',     name: '夜猫子',   err: 0,    spd: 0,    flavor: '后半天效率 +20%' },
  { key: 'lark',    name: '早起鸟',   err: 0,    spd: 0,    flavor: '前半天效率 +20%' },
  { key: 'clean',   name: '爱干净',   err: -0.15, spd: 0,   flavor: '设备故障率 -' },
  { key: 'lazy',    name: '懒散',     err: 0.2,  spd: -0.1, flavor: '更容易累' },
]
export const QUALS = ['婚纱', '亲子', '宠物', '商业', '修图']
export const QUAL_COST = 1200

// ---------- 员工成长进阶（仅成长型） ----------
export const STAGES = [
  { key: 'rookie',    name: '学徒', need: () => true },
  { key: 'backbone',  name: '骨干', need: (e) => e.skill >= 3 && e.quals.length >= 1 },
  { key: 'master',    name: '大师', need: (e) => e.skill >= 5 && e.quals.length >= 2 },
  { key: 'partner',   name: '合伙人', need: (e) => e.skill >= 5 && e.quals.length >= 2 && (e.served || 0) >= 15 },
]

// ---------- 工位（分区 + 岗位） ----------
export const STATIONS = [
  { key: 'wait',    name: '等待', zone: 'reception', post: 'service' },
  { key: 'consult', name: '咨询', zone: 'reception', post: 'service' },
  { key: 'makeup',  name: '化妆', zone: 'makeup',    post: 'makeup' },
  { key: 'shoot',   name: '拍摄', zone: 'studio',    post: 'photographer' },
  { key: 'select',  name: '选片', zone: 'reception', post: 'service' },
  { key: 'retouch', name: '修图', zone: 'retouch',   post: 'retoucher' },
  { key: 'deliver', name: '交付', zone: 'reception', post: 'service' },
]

// ---------- 店铺等级天梯（五维门槛：技术/金钱/场地/环境/声望，缺一不可） ----------
export const GRADES = [
  { grade: 1, name: '街角小店', plaque: '1★ 街角小店', crowdName: '街坊散客', cond: null, unlocks: ['证件照 / 标准写真 / 网红打卡', '设施上限 2 级', '员工上限 2', '无扩张'], reward: null },
  {
    grade: 2, name: '口碑相馆', plaque: '2★ 口碑相馆', crowdName: '大众写真客',
    cond: {
      tech: { label: '技术', text: '任一员工技能 ≥ 3', ok: (s) => s.staff.some((e) => e.skill >= 3) },
      money: { label: '金钱', text: '连续正现金流 ≥ 14 天', ok: (s) => s.streakPos >= 14 },
      venue: { label: '场地', text: '接待区 ≥2 且棚拍区 ≥2', ok: (s) => s.fac.reception >= 2 && s.fac.studio >= 2 },
      env: { label: '环境', text: '——', ok: () => true },
      rep: { label: '声望', text: '口碑 ≥3.0 且累计交付 ≥50 单', ok: (s) => s.reputation >= 3.0 && s.delivered >= 50 },
    },
    unlocks: ['向右扩店', '婚纱订单（需婚纱专精）', '设施上限 3 级', '员工上限 4', '广告渠道 4 个', '休息区', '空间形态·房间级预告'], reward: '粉丝 +200，技能点 +2',
  },
  {
    grade: 3, name: '社区名店', plaque: '3★ 社区名店', crowdName: '品质家庭客',
    cond: {
      tech: { label: '技术', text: '专精资格员工 ≥ 1', ok: (s) => s.staff.some((e) => e.quals.length >= 1) },
      money: { label: '金钱', text: '累计营收 ≥ 100,000', ok: (s) => s.totalRevenue >= 100000 },
      venue: { label: '场地', text: '化妆区 ≥ 3', ok: (s) => s.fac.makeup >= 3 },
      env: { label: '环境', text: '接待/化妆/棚拍/后期 均 ≥ 2', ok: (s) => ['reception', 'makeup', 'studio', 'retouch'].every((k) => s.fac[k] >= 2) },
      rep: { label: '声望', text: '口碑 ≥3.5 且粉丝 ≥1,000', ok: (s) => s.reputation >= 3.5 && s.fans >= 1000 },
    },
    unlocks: ['亲子/宠物订单', '企业形象照订单', '空间形态改造·房间级（化妆室/接待厅/独立选片室）', '向后扩张', '设施上限 4 级', '员工上限 6', '全渠道广告', '团建'], reward: '粉丝 +800，技能点 +5',
  },
  {
    grade: 4, name: '城市名店', plaque: '4★ 城市名店', crowdName: '企业/专业客',
    cond: {
      tech: { label: '技术', text: '高端定制交付 ≥ 5 单', ok: (s) => (s.deliveredBy.custom || 0) >= 5 },
      money: { label: '金钱', text: '不可替代度 > AI 替代能力', ok: (s) => s.irreplaceable > s.replacePower },
      venue: { label: '场地', text: '房间级形态 ≥ 2 处', ok: (s) => Object.values(s.forms).filter((v) => v >= 1).length >= 2 },
      env: { label: '环境', text: '接待/化妆/棚拍/后期 均 ≥ 3', ok: (s) => ['reception', 'makeup', 'studio', 'retouch'].every((k) => s.fac[k] >= 3) },
      rep: { label: '声望', text: '口碑 ≥4.0 且里程碑 ≥ 5 项', ok: (s) => s.reputation >= 4.0 && s.milestones.length >= 5 },
    },
    unlocks: ['二楼扩张', '大师设备（设施 5 级）', '广告商拍订单', '指名复购客', '员工上限 8'], reward: '粉丝 +3,000，品牌推力 +',
  },
  {
    grade: 5, name: '传奇影楼', plaque: '5★ 传奇影楼', crowdName: '艺人团队/广告主',
    cond: {
      tech: { label: '技术', text: '大师资格员工 ≥ 2', ok: (s) => s.staff.filter((e) => e.stage === 'master' || e.stage === 'partner').length >= 2 },
      money: { label: '金钱', text: '门店估值 ≥ 500,000', ok: (s) => storeValue(s) >= 500000 },
      venue: { label: '场地', text: 'VIP 级形态 ≥ 1 处', ok: (s) => Object.values(s.forms).some((v) => v >= 2) },
      env: { label: '环境', text: '接待/化妆/棚拍/后期 均 ≥ 4', ok: (s) => ['reception', 'makeup', 'studio', 'retouch'].every((k) => s.fac[k] >= 4) },
      rep: { label: '声望', text: '口碑 ≥4.8 且年度评奖 ≥ 3 项', ok: (s) => s.reputation >= 4.8 && s.awards.length >= 3 },
    },
    unlocks: ['全部订单与扩张', '空间形态改造·VIP 级（艺人独立化妆间/多主题影棚群/VIP 接待室）', '传奇里程碑（无限计数）'], reward: '传奇店牌',
  },
]
export function storeValue(s) {
  const invested = FACILITIES.reduce((sum, f) => {
    let v = 0
    for (let lv = 1; lv <= s.fac[f.key]; lv++) v += f.upCost[lv]
    return sum + v
  }, 0)
  const forms = Object.entries(s.forms).reduce((sum, [, lv]) => sum + (lv === 1 ? 6000 : lv === 2 ? 20000 : 0), 0)
  return Math.round(s.cash + (invested + forms) * 0.6)
}

// ---------- 吵架（5 手牌 × 7 顾客） ----------
export const HANDS = [
  { key: 'fact',   name: '讲事实', strong: ['蛮横型', '权力型'] },
  { key: 'reason', name: '讲道理', strong: ['网络型', 'AI质疑型'] },
  { key: 'emo',    name: '打感情', strong: ['情绪型'] },
  { key: 'shameless', name: '耍无赖', strong: ['精明型', '碰瓷型'] },
  { key: 'yield',  name: '认怂', strong: [] },
]
// 沟通方式情境话术（每回合从池中取，玩家选择的是"这句话怎么说"）
export const HAND_TALK = {
  fact: ['我们有全程底片和时间戳，逐张对。', '合同第七条写得很清楚，我念给您听。', '这是当时的沟通记录，您看一下时间。'],
  reason: ['咱们都冷静两分钟，把账算一遍就清楚了。', '您看，问题出在流程第三步，我给您捋一遍。', '这样解决对您对我都公平，您说是不是。'],
  emo: ['这组照片是您家人第一次拍全家福，我们比您还上心。', '您别急，今天这事我 personally 给您盯到满意。', '我知道您等了一下午，换我我也火大。'],
  shameless: ['行啊，那咱就耗着，看谁先关门。', '您去投诉吧，号码给您，顺便帮我们宣传了。', '这单我可以做亏，但话咱得说清楚。'],
  yield: ['……是我不对，给您打折，别生气了。', '算了算了，这单算我的。'],
}
export const QUARREL_CUSTOMERS = [
  { key: 'bossy',  name: '蛮横型', weak: '讲事实' },
  { key: 'shrewd', name: '精明型', weak: '耍无赖' },
  { key: 'emo',    name: '情绪型', weak: '打感情' },
  { key: 'net',    name: '网络型', weak: '讲道理' },
  { key: 'fraud',  name: '碰瓷型', weak: '耍无赖' },
  { key: 'power',  name: '权力型', weak: '讲事实' },
  { key: 'ai',     name: 'AI质疑型', weak: '讲道理' },
]

// ---------- 锐评（每周三投稿；深度微操时刻） ----------
export const REVIEWERS = [
  { key: 'master', name: '毒舌老法师', bias: -0.08, audience: '专业' },
  { key: 'abstract', name: '抽象艺术人', bias: 0, audience: '艺术' },
  { key: 'meme',   name: '沙雕网友', bias: 0.05, audience: '大众' },
  { key: 'gentle', name: '温柔鼓励型', bias: 0.10, audience: '全客群' },
  { key: 'ai',     name: '神秘AI评审', bias: 0, audience: '极客' },
]
export const REVIEW_TIERS = [
  { key: 'god',   name: '封神', fans: 400, rep: 0.3, skill: 2 },
  { key: 'good',  name: '好评', fans: 150, rep: 0.12, skill: 1 },
  { key: 'meme',  name: '有梗', fans: 300, rep: -0.05, skill: 2 },
  { key: 'trash', name: '毒舌', fans: 80, rep: -0.15, skill: 1 },
  { key: 'none',  name: '无人问津', fans: 0, rep: 0, skill: 0 },
]

// ---------- AI 冲击（5 阶段时间线） ----------
export const AI_STAGES = [
  { minDay: 1,   name: '萌芽', text: 'AI 证件照上线，证件照利润减半', hit: ['id'] },
  { minDay: 30,  name: '冲击', text: 'AI 标准写真，写真订单 -30%', hit: ['portrait', 'checkin'] },
  { minDay: 60,  name: '碾压', text: 'AI 婚纱精修，修图环节受压', hit: ['wedding'] },
  { minDay: 120, name: '逼宫', text: 'AI 商业图，商拍动摇', hit: ['product', 'corp'] },
  { minDay: 180, name: '共存', text: 'AI 接近专业，路线定型', hit: [] },
]
export const AI_SUB_COST = 150

// ---------- 救命大单（破产防线二道；看广告/付费解锁资格） ----------
export const RESCUE_DEALS = [
  { key: 'annual', name: '企业年会通宵跟拍', mult: 4, energyCost: 40, repCost: 0.05 },
  { key: 'crisis', name: '明星危机公关照', mult: 5, energyCost: 40, repCost: 0.05 },
  { key: 'rush',   name: '电商大促整组商拍', mult: 3, energyCost: 30, repCost: 0.04 },
]
export const RESCUE_COOLDOWN = 30

// ---------- 随机事件（每日电 chance 抽 1；语义即随机，不要求复现） ----------
export const EVENTS = [
  { key: 'newrival',  name: '隔壁开新店', text: '客流 -20%', days: 5, eff: { flowMul: 0.8 } },
  { key: 'influencer', name: '网红探店', text: '客流 +50%', days: 3, eff: { flowMul: 1.5 } },
  { key: 'camfix',    name: '相机故障', text: '拍摄效率 -50%（维修后恢复）', days: 2, eff: { shootMul: 0.5 } },
  { key: 'staffleave', name: '员工请假', text: '产能 -1 人', days: 2, eff: { staffOut: 1 } },
  { key: 'aireveal',  name: 'AI 平台降价', text: '低端订单利润 -30%', days: 9999, eff: { lowHit: 0.7 } },
  { key: 'rentraise', name: '房东涨租', text: '房租 +10%', days: 9999, eff: { rentMul: 1.1 } },
  { key: 'referral',  name: '老客户介绍', text: '新客 +2', days: 0, eff: { extraOrders: 2 } },
  { key: 'powerout',  name: '停电', text: '当天无法营业', days: 0, eff: { closed: 1 } },
  { key: 'famous',    name: '明星到店（VIP 打分）', text: '客流暴增 + 打分奖励', days: 2, eff: { flowMul: 1.6, vip: 1 } },
  { key: 'roadwork',  name: '市政施工', text: '客流 -30%', days: 4, eff: { flowMul: 0.7 } },
  { key: 'badreview', name: '同行恶意差评', text: '口碑 -0.2', days: 0, eff: { repHit: -0.2 } },
  { key: 'platinvite', name: '平台邀请入驻', text: '线上曝光 +20%', days: 9999, eff: { expoMul: 1.2 } },
  { key: 'hotsearch', name: '热搜事件', text: '客流 ×1.8 或 ×0.5', days: 2, eff: { flowMul: 1.8 } },
  { key: 'equipment', name: '设备被偷', text: '现金 -2000', days: 0, eff: { cashHit: -2000 } },
  { key: 'stafflove', name: '员工恋爱', text: '店里氛围 +（出勤更稳）', days: 5, eff: { stayPlus: 5 } },
]

// ---------- 客服事件模板（每条含 0 成本选项；成因来自动线失败） ----------
export const SERVICE_EVENTS = [
  {
    key: 'toofat', name: '客人说照片显胖', causes: ['quality'],
    opts: [
      { key: 'reshoot', name: '免费重拍', cost: 0, rep: 0.05, text: '消耗明天 1 个时段' },
      { key: 'refund', name: '部分退款', cost: 0.3, rep: 0.03, text: '退还三成尾款' },
      { key: 'explain', name: '耐心解释', cost: 0, rep: -0.02, text: '0 成本，客人可能不买账' },
    ],
  },
  {
    key: 'rushreq', name: '客人要求加急', causes: ['wait'],
    opts: [
      { key: 'pay', name: '加钱插队', cost: -0.2, rep: 0, text: '多收两成，明天排期优先' },
      { key: 'refuse', name: '拒绝', cost: 0, rep: -0.05, text: '0 成本，但口碑小扣' },
      { key: 'overtime', name: '全店加班', cost: 0, rep: 0.02, text: '员工精力 -20' },
    ],
  },
  {
    key: 'freeretouch', name: '要求免费加修', causes: ['quality'],
    opts: [
      { key: 'agree', name: '同意', cost: 0, rep: 0.04, text: '修图师明天多干一单' },
      { key: 'refuse', name: '拒绝', cost: 0, rep: -0.04, text: '0 成本' },
      { key: 'half', name: '折中：半价加修', cost: -0.1, rep: 0.01, text: '收一半加修费' },
    ],
  },
  {
    key: 'badthreat', name: '差评威胁', causes: ['wait', 'quality'],
    opts: [
      { key: 'comp', name: '补偿平息', cost: 0.2, rep: 0.02, text: '送加印券' },
      { key: 'hard', name: '硬刚', cost: 0, rep: -0.08, text: '0 成本，风险自负' },
      { key: 'talk', name: '协商', cost: 0, rep: -0.01, text: '0 成本，大概率平息' },
    ],
  },
  {
    key: 'resched', name: '客人要求改期', causes: ['wait'],
    opts: [
      { key: 'agree', name: '同意改期', cost: 0, rep: 0.02, text: '排期顺延一天' },
      { key: 'refuse', name: '拒绝', cost: 0, rep: -0.03, text: '0 成本' },
      { key: 'fee', name: '收费改期', cost: -0.1, rep: -0.02, text: '收改期费' },
    ],
  },
]

// ---------- 里程碑 / 年度评奖 ----------
// ---------- 地图：双点县式地点推进（1 星解锁下一地点；每地点三星任务） ----------
// 任务用 progress(s) 返回 [当前值, 目标值] 供 HUD 进度条；done(s) 判定达成
export const MAP = [
  {
    key: 'street', name: '老街影像社', x: 8, y: 62,
    desc: '一切开始的地方：证件照与街坊生意，磨技术、攒口碑。',
    unlock: null, cash: 10000, priceMul: 1.0,
    tasks: [
      { star: 1, items: [
        { text: '累计交付 15 单', progress: (s) => [s.delivered, 15], done: (s) => s.delivered >= 15 },
        { text: '口碑达到 2.5 星', progress: (s) => [Math.round(s.reputation * 10), 25], done: (s) => s.reputation >= 2.5 },
      ] },
      { star: 2, items: [
        { text: '累计交付 40 单', progress: (s) => [s.delivered, 40], done: (s) => s.delivered >= 40 },
        { text: '现金达到 ¥12,000', progress: (s) => [Math.round(s.cash / 100), 120], done: (s) => s.cash >= 12000 },
      ] },
      { star: 3, items: [
        { text: '店铺升上 2★', progress: (s) => [s.grade, 2], done: (s) => s.grade >= 2 },
        { text: '留存 5 名回头客', progress: (s) => [s.totalRetained, 5], done: (s) => s.totalRetained >= 5 },
      ] },
    ],
  },
  {
    key: 'campus', name: '大学城快闪店', x: 30, y: 40,
    desc: '学生客群：网红打卡与写真走量，传播是第一生产力。',
    unlock: { prev: 'street', stars: 1 }, cash: 8000, priceMul: 0.95, orderBoost: { checkin: 1.3, portrait: 1.1 },
    tasks: [
      { star: 1, items: [
        { text: '累计交付 25 单', progress: (s) => [s.delivered, 25], done: (s) => s.delivered >= 25 },
        { text: '粉丝达到 300', progress: (s) => [s.fans, 300], done: (s) => s.fans >= 300 },
      ] },
      { star: 2, items: [
        { text: '锐评拿到「好评」以上', progress: (s) => [s.goodReviews, 1], done: (s) => s.goodReviews >= 1 },
        { text: '专精员工 ≥ 1', progress: (s) => [s.staff.filter((e) => e.quals.length > 0).length, 1], done: (s) => s.staff.some((e) => e.quals.length > 0) },
      ] },
      { star: 3, items: [
        { text: '传播 8 次（客人分享）', progress: (s) => [s.totalSpread, 8], done: (s) => s.totalSpread >= 8 },
        { text: '店铺升上 2★', progress: (s) => [s.grade, 2], done: (s) => s.grade >= 2 },
      ] },
    ],
  },
  {
    key: 'mall', name: '商圈旗舰店', x: 55, y: 58,
    desc: '企业与品质家庭：婚纱与企业形象照登场，服务分级决定客单。',
    unlock: { prev: 'campus', stars: 1 }, cash: 15000, priceMul: 1.1, orderBoost: { wedding: 1.2, corp: 1.25 },
    tasks: [
      { star: 1, items: [
        { text: '累计交付 30 单', progress: (s) => [s.delivered, 30], done: (s) => s.delivered >= 30 },
        { text: '单日营收破 ¥8,000', progress: (s) => [Math.round(s.bestDayIncome / 100), 80], done: (s) => s.bestDayIncome >= 8000 },
      ] },
      { star: 2, items: [
        { text: '完成 1 场婚礼大单', progress: (s) => [s.deliveredBy.wedding || 0, 1], done: (s) => (s.deliveredBy.wedding || 0) >= 1 },
        { text: '接待/化妆/棚拍 均 ≥ 2 级', progress: (s) => [Math.min(s.fac.reception, s.fac.makeup, s.fac.studio), 2], done: (s) => ['reception', 'makeup', 'studio'].every((k) => s.fac[k] >= 2) },
      ] },
      { star: 3, items: [
        { text: '店铺升上 3★', progress: (s) => [s.grade, 3], done: (s) => s.grade >= 3 },
        { text: '留存 10 名回头客', progress: (s) => [s.totalRetained, 10], done: (s) => s.totalRetained >= 10 },
      ] },
    ],
  },
  {
    key: 'lot', name: '影视基地棚', x: 74, y: 34,
    desc: '商业摄制：无影棚与布景的天下，拼的是想法与团队执行。',
    unlock: { prev: 'mall', stars: 1 }, cash: 25000, priceMul: 1.2, orderBoost: { product: 1.3, ad: 1.3, custom: 1.2 },
    tasks: [
      { star: 1, items: [
        { text: '商业订单交付 5 单', progress: (s) => [(s.deliveredBy.product || 0) + (s.deliveredBy.corp || 0), 5], done: (s) => ((s.deliveredBy.product || 0) + (s.deliveredBy.corp || 0)) >= 5 },
        { text: '大师资格员工 ≥ 1', progress: (s) => [s.staff.filter((e) => e.stage === 'master' || e.stage === 'partner').length, 1], done: (s) => s.staff.some((e) => e.stage === 'master' || e.stage === 'partner') },
      ] },
      { star: 2, items: [
        { text: '空间形态改造 ≥ 2 处', progress: (s) => [Object.values(s.forms).filter((v) => v >= 1).length, 2], done: (s) => Object.values(s.forms).filter((v) => v >= 1).length >= 2 },
        { text: '门店估值 ¥80,000', progress: (s) => [Math.round(storeValue(s) / 1000), 80], done: (s) => storeValue(s) >= 80000 },
      ] },
      { star: 3, items: [
        { text: '广告商拍交付 2 单', progress: (s) => [s.deliveredBy.ad || 0, 2], done: (s) => (s.deliveredBy.ad || 0) >= 2 },
        { text: '口碑达到 4.2 星', progress: (s) => [Math.round(s.reputation * 10), 42], done: (s) => s.reputation >= 4.2 },
      ] },
    ],
  },
  {
    key: 'fashion', name: '时装周馆', x: 90, y: 16,
    desc: '传奇舞台：艺人团队与广告主指名而来，钱不是问题，想法是。',
    unlock: { prev: 'lot', stars: 1 }, cash: 40000, priceMul: 1.35, orderBoost: { ad: 1.4, custom: 1.4 },
    tasks: [
      { star: 1, items: [
        { text: '高端定制交付 3 单', progress: (s) => [s.deliveredBy.custom || 0, 3], done: (s) => (s.deliveredBy.custom || 0) >= 3 },
        { text: '粉丝达到 5,000', progress: (s) => [s.fans, 5000], done: (s) => s.fans >= 5000 },
      ] },
      { star: 2, items: [
        { text: 'VIP 级形态 ≥ 1 处', progress: (s) => [Object.values(s.forms).filter((v) => v >= 2).length, 1], done: (s) => Object.values(s.forms).some((v) => v >= 2) },
        { text: '大师资格员工 ≥ 2', progress: (s) => [s.staff.filter((e) => e.stage === 'master' || e.stage === 'partner').length, 2], done: (s) => s.staff.filter((e) => e.stage === 'master' || e.stage === 'partner').length >= 2 },
      ] },
      { star: 3, items: [
        { text: '年度评奖 ≥ 1 项', progress: (s) => [s.awards.length, 1], done: (s) => s.awards.length >= 1 },
        { text: '口碑达到 4.8 星', progress: (s) => [Math.round(s.reputation * 10), 48], done: (s) => s.reputation >= 4.8 },
      ] },
    ],
  },
]

export const MILESTONES = [
  { key: 'd50', name: '累计交付 50 单', ok: (s) => s.delivered >= 50 },
  { key: 'd200', name: '累计交付 200 单', ok: (s) => s.delivered >= 200 },
  { key: 'rev10k', name: '单日营收破 10,000', ok: (s) => s.todayIncome >= 10000 },
  { key: 'fans1k', name: '粉丝破 1,000', ok: (s) => s.fans >= 1000 },
  { key: 'fans1w', name: '粉丝破 10,000', ok: (s) => s.fans >= 10000 },
  { key: 'wed1', name: '首个婚礼大单', ok: (s) => (s.deliveredBy.wedding || 0) >= 1 },
  { key: 'god1', name: '首次锐评封神', ok: (s) => s.reviewTiers.includes('god') },
  { key: 'win3', name: '吵架三连胜', ok: (s) => s.quarrelWinStreak >= 3 },
  { key: 'grade3', name: '升上 3★', ok: (s) => s.grade >= 3 },
  { key: 'grade4', name: '升上 4★', ok: (s) => s.grade >= 4 },
]
export const AWARD_TYPES = [
  { key: 'photo', name: '年度照片奖', need: (s) => s.bestWorkQuality >= 0.8 },
  { key: 'rep',   name: '年度口碑奖', need: (s) => s.reputation >= 4.2 },
  { key: 'hot',   name: '年度网红店', need: (s) => s.fans >= 5000 },
  { key: 'serve', name: '年度服务奖', need: (s) => s.weekReflect && s.weekReflect.retention >= 0.5 },
]

// ---------- 员工姓名池 ----------
export const SURNAMES = ['林', '苏', '沈', '顾', '白', '江', '陆', '秦', '许', '程', '叶', '赵']
export const GIVEN = ['晚', '野', '桥', '一鸣', '知夏', '砚', '小满', '行舟', '见山', '南絮', '既白', '冉']
