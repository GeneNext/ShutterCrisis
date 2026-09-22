import React, { useState } from 'react'
import { fmt } from '../game/engine.js'
import {
  act, nextGradeInfo, stationWorkers, stationCapacity, fixedCostBreakdown, expandPreview,
  requirementMissing, isReviewDay, toneOf, qualityCeiling, refreshCandidates, hintOf, MAP,
  FACILITIES, TIER_NAMES, FORMS, FORM_RENOVATE, ORDERS, CROWDS, PRICING, WALKIN_POLICY,
  CHANNELS, CONTENT_TOPICS, POSTS, TRAITS, QUALS, STATIONS, HANDS, REVIEWERS,
  AI_STAGES, AI_SUB_COST,
  GEAR, gearMarketValue,
} from '../game/engine.js'
import { Bar, Chip, Section, Btn, TalentChip, StageChip } from './components.jsx'

const CROWD_NAMES = ['街坊散客', '大众写真客', '品质家庭客', '企业/专业客', '艺人团队']
const FORM_ZONE_NAMES = { makeup: '化妆区', reception: '接待区', studio: '棚拍区', select: '选片（接待区）', retouch: '后期区', rest: '休息区' }
function riskLabel(p) {
  if (p == null) return '低'
  if (p >= 0.18) return '高'
  if (p >= 0.1) return '中'
  return '低'
}

// 本店任务 HUD（双点医院式：全流程任务，达成 1 星解锁地图下一地点）
export function TasksHUD({ world }) {
  const g = world.locs[world.cur]
  const loc = MAP.find((m) => m.key === g.locKey)
  const stars = g.stars || 0
  const next = loc.tasks.find((t) => t.star > stars)
  return (
    <Section title={`本店任务 · ${loc.name}（${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}）`}
      right={<span className="sub">达成 1 星解锁地图下一地点</span>}>
      {!next && <div className="sub">本地点三星全达成——打开地图去下一站，或继续刷传奇里程碑。</div>}
      {next && next.items.map((it, i) => {
        const [cur, need] = it.progress(g)
        return (
          <div key={i} className="task-row">
            <span className="task-text">{it.text}</span>
            <div className="task-bar"><Bar v={Math.min(cur, need)} max={need} color={cur >= need ? 'green' : 'blue'} label={`${fmt(cur)}/${fmt(need)}`} /></div>
          </div>
        )
      })}
    </Section>
  )
}

// ================= 晨会（第一阶段：例行决策聚合，一键应用） =================
export function Briefing({ s, run, world }) {
  const grade = nextGradeInfo(s)
  const fb = fixedCostBreakdown(s)
  const recent = s.reportHistory.slice(0, 3)
  const avgIncome = recent.length ? Math.round(recent.reduce((a, r) => a + r.income, 0) / recent.length) : 0
  const warn = s.staff.filter((e) => e.energy < 40)
  const stay = s.stayReport || []
  const acceptAll = () => {
    for (const a of [...s.appointments]) {
      const r = act(s, 'takeOrder', a.id)
      if (!r.ok && r.err.includes('需要')) act(s, 'passOrder', a.id)
    }
    act(s, 'autoSchedule')
    run()
  }
  return (
    <div className="briefing">
      <TasksHUD world={world} />
      <div className="brief-head">
        <div>
          <h2>晨会 · 第 {s.round + 1} 天</h2>
          <div className="sub">{grade ? `距 ${grade.plaque}` : '已至传奇影楼'} · 今日主力客群：{CROWD_NAMES[Math.min(4, s.grade - 1)]}</div>
        </div>
        <div className="brief-cash">
          <div className="big">¥{fmt(s.cash)}</div>
          <div className="sub">现金流状态：{stateName(s)}</div>
        </div>
      </div>

      {grade && (
        <Section title={`距下一星：${grade.plaque}（五维门槛，缺一不可）`}>
          <div className="dims">
            {grade.dims.map((d, i) => (
              <div key={i} className={'dim ' + (d.ok ? 'ok' : 'no')}>
                <Chip kind={d.ok ? 'ok' : 'warn'}>{d.label}</Chip>
                <span>{d.text}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title="今日预约池（客人即可视化现金流：每张预约都是一笔待变现的钱）"
        right={<Btn onClick={acceptAll}>一键接单并自动排程（推荐）</Btn>}>
        <div className="appt-grid">
          {s.appointments.map((a) => {
            const miss = requirementMissing(s, ORDERS.find((o) => o.key === a.orderKey))
            return (
              <div key={a.id} className={'appt ' + (a.state === 'accepted' ? 'on' : '')}>
                <div className="appt-name">{a.name}{a.retained ? ' · 回头客' : ''}</div>
                <div className="appt-order">{ORDERS.find((o) => o.key === a.orderKey).name}</div>
                <div className="appt-price">¥{fmt(a.price)}</div>
                <div className="appt-meta">{CROWDS[a.crowdIdx].name} · 占 {a.slots} 时段</div>
                {a.appointment && (
                  <div className="appt-deposit">
                    定金 ¥{fmt(a.deposit || 0)} 已收（爽约不退）· 爽约风险 {riskLabel(a.noShowP)}
                  </div>
                )}
                {miss
                  ? <div className="appt-miss">{miss}</div>
                  : a.state === 'accepted'
                    ? <Chip kind="ok">已接单</Chip>
                    : (
                      <div className="row">
                        <Btn onClick={() => { act(s, 'takeOrder', a.id); run() }}>接单</Btn>
                        <Btn kind="ghost" onClick={() => { act(s, 'passOrder', a.id); run() }}>推掉</Btn>
                      </div>
                    )}
              </div>
            )
          })}
        </div>
        <div className="sub" style={{ marginTop: 8 }}>
          预计 walk-in 散客 ~{s.walkinForecast} 组 · 当前分流「{WALKIN_POLICY.find((w) => w.key === s.walkinPolicy).name}」
        </div>
      </Section>

      <Section title="员工预警（精力 / 去留）">
        {s.staff.length === 0 && <div className="sub">店里没有人。</div>}
        {s.staff.map((e) => (
          <div key={e.id} className="line">
            <b>{e.name}</b> <Chip>{POSTS.find((p) => p.key === e.post).name}</Chip>
            {e.energy < 40 && <Chip kind="warn">精力 {e.energy}</Chip>}
            {e.energy < 40 && <Btn onClick={() => { act(s, 'restStaff', e.id); run() }}>今日排休</Btn>}
            {stay.filter((r) => r.name === e.name && r.will < 60).map((r, i) => (
              <span key={i} className="row">
                <Chip kind="warn">去留意愿 {r.will}：{r.text}</Chip>
                <Btn onClick={() => { act(s, 'retainStaff', e.id); run() }}>加薪 20% 挽留</Btn>
              </span>
            ))}
          </div>
        ))}
        {(s.complaintsBacklog || 0) >= 2 && (
          <div className="line">
            <Chip kind="warn">客诉积压 {s.complaintsBacklog} 起</Chip>
            <span className="sub">建议招募客服，或升接待区（前台每 2 级分担 1 名客服职能）</span>
          </div>
        )}
        <div className="row" style={{ marginTop: 6 }}>
          <Btn onClick={() => { act(s, 'organizeTeamBuilding'); run() }}>团建（全员精力 +30，意愿 +）</Btn>
          {warn.length === 0 && stay.every((r) => r.will >= 60) && <span className="sub">全员状态正常</span>}
        </div>
      </Section>

      <Section title="现金流预测">
        <div className="cols">
          <div>近 3 日均收入：<b>¥{fmt(avgIncome)}</b></div>
          <div>今日固定支出：<b>¥{fmt(fb.total)}</b></div>
          <div className={avgIncome - fb.total >= 0 ? 'good' : 'bad'}>
            预计净流：<b>{avgIncome - fb.total >= 0 ? '+' : ''}¥{fmt(avgIncome - fb.total)}</b>
          </div>
        </div>
        {fb.total > avgIncome && <div className="warnline">固定支出高于近期收入：危险态可接「救命大单」（收件箱），或削减广告与人力。</div>}
      </Section>

      <Section title="今日广告（可选）">
        <div className="row wrap">
          {CHANNELS.filter((c) => s.grade >= c.grade).map((c) => (
            <Btn key={c.key} kind={s.adsToday.includes(c.key) ? 'on' : ''}
              onClick={() => { act(s, 'runAd', c.key); run() }}>
              {c.name} ¥{c.cost}（粉丝+{c.fans}）
            </Btn>
          ))}
          <span className="sub">品牌调性倾向：{toneOf(s)}</span>
        </div>
      </Section>

      <Section title="今日提示（不打断流程，仅供参考）">
        <div className="warnline">{hintOf(s)}</div>
      </Section>

      <Section title="经营策略（开始营业前定；定价现调，分流/老板风格立即生效）">
        <div className="row wrap">
          <span>定价：</span>
          {PRICING.map((p) => (
            <Btn key={p.key} kind={s.priceTier === p.key ? 'on' : ''} onClick={() => { act(s, 'setPrice', p.key); run() }}>
              {p.name} ×{p.mul}
            </Btn>
          ))}
        </div>
        <div className="row wrap">
          <span>walk-in 分流：</span>
          {WALKIN_POLICY.map((w) => (
            <Btn key={w.key} kind={s.walkinPolicy === w.key ? 'on' : ''} onClick={() => { act(s, 'setWalkInPolicy', w.key); run() }}>
              {w.name}
            </Btn>
          ))}
        </div>
        <div className="row wrap">
          <span>老板：</span>
          <Btn kind={s.boss.style === 'hands_on' ? 'on' : ''} onClick={() => { act(s, 'setBossStyle', 'hands_on'); run() }}>亲力亲为（可顶岗/亲自拍）</Btn>
          <Btn kind={s.boss.style === 'delegator' ? 'on' : ''} onClick={() => { act(s, 'setBossStyle', 'delegator'); run() }}>甩手掌柜</Btn>
          <span className="sub">精力 {s.boss.energy}/100</span>
        </div>
      </Section>

      <div className="brief-go">
        <Btn kind="primary" big onClick={() => run('startBusiness')}>开始营业（时段动线演出）</Btn>
        <span className="sub">例行一天 3 次点击：晨会一键 → 营业观看/干预 → 结算反思</span>
      </div>
    </div>
  )
}
export function stateName(s) {
  const st = { healthy: '健康', tight: '紧张', danger: '危险', broken: '断裂' }[cashState(s)]
  return st + (s.cash < 0 ? '（负现金）' : '')
}
function cashState(s) {
  if (s.cash < 0) return 'broken'
  const f = s.lastFixedCost || 1
  if (s.cash < f * 7) return 'danger'
  if (s.cash < f * 30) return 'tight'
  return 'healthy'
}

// ================= 门店（店内设计 / 动线演出 / 投资与升级） =================
export function Orders({ s }) {
  const total = s.slotsTotal
  return (
    <div className="orders">
      <Section title={`今日排期（${total} 时段 × 拍摄并发 ${Math.max(1, stationCapacity(s, 'shoot'))}）`}>
        <div className="slots">
          {Array.from({ length: total }).map((_, slot) => {
            const here = s.appointments.filter((a) => a.state === 'accepted' && s.schedule[a.id] && s.schedule[a.id].startSlot === slot)
            return (
              <div key={slot} className="slot-col">
                <div className="slot-n">时段 {slot + 1}</div>
                {here.map((a) => (
                  <div key={a.id} className="slot-item">{ORDERS.find((o) => o.key === a.orderKey).name}<br />¥{fmt(a.price)}</div>
                ))}
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="进行中的订单（动线位置实时更新）">
        {s.activeOrders.length === 0 && <div className="sub">当前没有在店客人。</div>}
        <div className="appt-grid">
          {s.activeOrders.map((o) => (
            <div key={o.id} className="appt on">
              <div className="appt-name">{o.name}</div>
              <div className="appt-order">{ORDERS.find((x) => x.key === o.orderKey).name}</div>
              <div className="appt-price">¥{fmt(o.price)}</div>
              <div className="sub">当前：{o.station}（等 {o.waitSlots} 时段）</div>
              <Bar v={Math.max(0, o.satisfaction) * 100} color={o.satisfaction > 0.5 ? 'green' : 'red'} label={`满意度 ${(o.satisfaction * 100) | 0}%`} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

// ================= 员工 =================
export function Staff({ s, run }) {
  const cap = [0, 2, 4, 6, 8, 10][s.grade]
  return (
    <div className="staff-page">
      <Section title={`花名册（${s.staff.length}/${cap} 人，升星扩编）`}
        right={<Btn onClick={() => { act(s, 'organizeTeamBuilding'); run() }}>团建</Btn>}>
        <div className="staff-grid">
          {s.staff.map((e) => {
            const trait = TRAITS.find((t) => t.key === e.trait)
            const leave = (s.stayReport || []).find((r) => r.name === e.name)
            return (
              <div key={e.id} className="staff-card">
                <div className="staff-head">
                  <b>{e.name}</b>
                  <Chip>{POSTS.find((p) => p.key === e.post).name}</Chip>
                  <Chip kind="stage">Lv {e.skill} / {e.potential}</Chip>
                  <TalentChip talent={e.talent} />
                  <StageChip stage={e.stage} />
                </div>
                <div className="sub">特质：{trait.name}（{trait.flavor}）· 日薪 ¥{e.wage} · 类型决定工位，等级决定质量上限</div>
                <Bar v={e.skill} max={e.potential} color="blue" label={`等级 ${e.skill}/${e.potential}（成长上限）`} />
                <Bar v={e.energy} color={e.energy > 40 ? 'green' : 'red'} label={`精力 ${e.energy}`} />
                {leave && <Bar v={leave.will} color={leave.will >= 60 ? 'green' : 'red'} label={`去留意愿 ${leave.will}：${leave.text}`} />}
                <div className="row wrap">
                  {e.quals.map((q) => <Chip key={q} kind="ok">专精·{q}</Chip>)}
                  {e.talent === 'growth' || e.quals.length === 0
                    ? QUALS.filter((q) => !e.quals.includes(q)).map((q) => (
                      <button key={q} className="mini" onClick={() => { act(s, 'trainStaff', e.id, q); run() }}>培训 {q}</button>
                    ))
                    : <span className="sub">普通员工至多 1 门专精</span>}
                  <button className="mini" onClick={() => { act(s, 'courseStaff', e.id); run() }} title="花钱涨技能，成长型可到 5 级">技能进修</button>
                  <button className="mini" onClick={() => { act(s, 'consoleStaff', e.id); run() }}>安抚</button>
                  {leave && leave.will < 60 && <button className="mini warn" onClick={() => { act(s, 'retainStaff', e.id); run() }}>加薪挽留</button>}
                  <button className="mini" onClick={() => { act(s, 'restStaff', e.id); run() }}>排休</button>
                  <button className="mini danger" onClick={() => { act(s, 'fireStaff', e.id); run() }}>解雇</button>
                </div>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="人才市场（成长型稀缺：遇到了就是机会；招聘费 ×2）">
        <div className="staff-grid">
          {s.candidates.map((c) => (
            <div key={c.id} className="staff-card">
              <div className="staff-head">
                <b>{c.name}</b>
                <Chip>{POSTS.find((p) => p.key === c.post).name}</Chip>
                <TalentChip talent={c.talent} />
              </div>
              <div className="sub">类型：{POSTS.find((p) => p.key === c.post).name} · 等级 Lv {c.skill}（上限 {c.potential}）· 日薪 ¥{c.wage} · 特质 {TRAITS.find((t) => t.key === c.trait).name}</div>
              <Btn onClick={() => { act(s, 'hireStaff', c.id); run() }}>
                招聘（¥{fmt(POSTS.find((p) => p.key === c.post).hire * (c.talent === 'growth' ? 2 : 1))}）
              </Btn>
            </div>
          ))}
          <Btn onClick={() => { refreshCandidates(s); run() }}>换一批（明晨也会自动刷新）</Btn>
        </div>
      </Section>
    </div>
  )
}

// ================= 线上 =================
export function Market({ s, run }) {
  const latest = s.reportHistory[0]
  return (
    <div className="market">
      <Section title={`线上账号（粉丝 ${fmt(s.fans)} · 品牌调性：${toneOf(s)}）`}>
        <div className="row wrap">
          {CONTENT_TOPICS.map((t) => <Chip key={t.key}>{t.name} ×{t.mul}</Chip>)}
        </div>
        <div className="row wrap">
          <select id="pub-work">
            {s.works.slice(-12).reverse().map((w) => (
              <option key={w.id} value={w.id}>第{w.day}天作品（质量 {(w.quality * 100) | 0} 分）</option>
            ))}
          </select>
          <select id="pub-topic">{CONTENT_TOPICS.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</select>
          <Btn onClick={() => {
            const w = document.getElementById('pub-work').value
            const t = document.getElementById('pub-topic').value
            act(s, 'publishContent', parseInt(w, 10), t); run()
          }} disabled={s.publishedDay === s.round + 1 || s.works.length === 0}>
            {s.publishedDay === s.round + 1 ? '今天已发（每天 1 条）' : '发布内容'}
          </Btn>
        </div>
      </Section>
      <Section title="AI 冲击（不可替代度 vs AI 替代能力）">
        <div className="ai-line">
          {AI_STAGES.map((a, i) => <Chip key={a.name} kind={i <= s.ai.stage ? 'stage' : ''}>{a.name}</Chip>)}
        </div>
        <div className="sub">{AI_STAGES[s.ai.stage].text}</div>
        <div className="cols">
          <div>不可替代度 <b>{s.irreplaceable}</b></div>
          <div>AI 替代能力 <b>{s.replacePower}</b></div>
          <div className={s.irreplaceable > s.replacePower ? 'good' : 'bad'}>
            {s.irreplaceable > s.replacePower ? '你在前面（真实体验是护城河）' : '正在被 AI 卷（动线满意度与关系是解法）'}
          </div>
        </div>
        <Btn kind={s.ai.subscribed ? 'on' : ''} onClick={() => { act(s, 'adoptAI', !s.ai.subscribed); run() }}>
          {s.ai.subscribed ? `取消 AI 修图订阅（¥${AI_SUB_COST}/天）` : `订阅 AI 修图（¥${AI_SUB_COST}/天：自动化但伤不可替代度）`}
        </Btn>
      </Section>
      <Section title="广告渠道（今日已选，明晨可再投）">
        <div className="row wrap">
          {CHANNELS.map((c) => (
            <span key={c.key} className="row">
              <Btn kind={s.adsToday.includes(c.key) ? 'on' : ''} disabled={s.grade < c.grade}
                onClick={() => { act(s, 'runAd', c.key); run() }}>
                {c.name}{s.grade < c.grade ? `（${c.grade}★）` : ` ¥${c.cost}`}
              </Btn>
            </span>
          ))}
        </div>
        {latest && <div className="sub">昨日：接待 {latest.served} · 入账 ¥{fmt(latest.income)} · 流失 ¥{fmt(latest.loss)}</div>}
      </Section>
    </div>
  )
}

// ================= 报表 =================
export function Report({ s, run }) {
  return (
    <div className="report">
      <Section title="日报表（最近 14 天）">
        <table className="tbl">
          <thead><tr><th>天</th><th>收入</th><th>固定</th><th>变动</th><th>净流</th><th>余额</th><th>接待</th><th>流失</th><th>留存</th><th>传播</th></tr></thead>
          <tbody>
            {s.reportHistory.slice(0, 14).map((r) => (
              <tr key={r.day} className={r.net >= 0 ? '' : 'neg'}>
                <td>{r.day}</td><td>{fmt(r.income)}</td><td>{fmt(r.fixed)}</td><td>{fmt(r.variable)}</td>
                <td className={r.net >= 0 ? 'good' : 'bad'}>{r.net >= 0 ? '+' : ''}{fmt(r.net)}</td>
                <td>{fmt(r.balance)}</td><td>{r.served}</td><td>{fmt(r.loss)}</td><td>{r.retained}</td><td>{r.spread}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
      <Section title="周反思（每 7 天：这周哪里在漏钱）">
        {s.weeklyReports.length === 0 && <div className="sub">第一个周反思将在第 7 天结算后出现。</div>}
        {s.weeklyReports.slice(0, 4).map((w) => (
          <div key={w.day} className="week-card">
            <b>第 {w.day} 天周反思</b>
            <div className="cols">
              <div>本周净流 <b className={w.net >= 0 ? 'good' : 'bad'}>{w.net >= 0 ? '+' : ''}{fmt(w.net)}</b></div>
              <div>上周 <b>{w.lastNet == null ? '—' : fmt(w.lastNet)}</b></div>
              <div>流失 <b className="bad">¥{fmt(w.loss)}</b></div>
              <div>留存 <b>{w.retained}</b></div>
              <div>传播 <b>{w.spread}</b></div>
            </div>
            <div>流失 Top：{w.lossTop.map((l) => `${l.cause} ¥${fmt(l.amount)}`).join(' / ') || '无'}</div>
            <div className="warnline">{w.advice}</div>
          </div>
        ))}
      </Section>
      <Section title="里程碑 / 年度评奖 / 传奇计数">
        <div className="row wrap">
          {s.milestones.length === 0 && <span className="sub">暂无里程碑</span>}
          {s.milestones.map((m) => <Chip key={m} kind="ok">{MILESTONE_NAME(m)}</Chip>)}
        </div>
        <div className="row wrap">
          {s.awards.map((a) => <Chip key={a} kind="stage">{a}</Chip>)}
        </div>
        <div className="sub">收店退休随时可做（单机原型没有胜利条件，玩到不想玩为止）。</div>
        <Btn kind="danger" onClick={() => { act(s, 'retire'); run() }}>收店退休（结局）</Btn>
      </Section>
    </div>
  )
}
function MILESTONE_NAME(key) {
  const map = {
    d50: '累计 50 单', d200: '累计 200 单', rev10k: '单日破万', fans1k: '粉丝破千', fans1w: '粉丝破万',
    wed1: '首个婚礼单', god1: '首次封神', win3: '吵架三连胜', grade3: '升上 3★', grade4: '升上 4★',
  }
  return map[key] || key
}

// ================= 器械库（Gear 资产经营） =================
const GEAR_CAT_NAMES = { camera: '相机', lens: '镜头', light: '灯光' }
function gearValue(s, m) { // 当前市场价
  const q = (s.gear && s.gear.quote) || {}
  return q[m.key] != null ? q[m.key] : m.base
}
// 我的器械总市值：买价总和 vs 现价总和（账面盈亏）
function gearPnl(s) {
  const owned = (s.gear && s.gear.owned) || []
  const invested = owned.reduce((a, it) => a + it.buyPrice, 0)
  const market = owned.reduce((a, it) => a + gearValue(s, geaModel(s, it)), 0)
  return { count: owned.length, invested, market, pnl: market - invested }
}
function geaModel(s, it) {
  const list = (GEAR[it.cat] || []).filter((m) => m.key === it.model)
  return list[0] || it
}
export function Gear({ s, run }) {
  const pnl = gearPnl(s)
  const dep = fixedCostBreakdown(s).gearDep
  return (
    <div className="gear">
      <Section title={`器械库 · 当前市值 ¥${fmt(pnl.market)} · 成本 ¥${fmt(pnl.invested)}`}>
        <div className="cols">
          <div>在库 <b>{pnl.count} 件</b></div>
          <div className={pnl.pnl >= 0 ? 'good' : 'bad'}>{pnl.pnl >= 0 ? '账面 +' : '账面 '}{fmt(pnl.pnl)}</div>
          <div>每日折旧 <b className="bad">¥{fmt(dep)}/天</b></div>
          <div>计入估值 <b>×0.7</b></div>
        </div>
      </Section>

      <Section title="我的器械（可卖出回笼现金）">
        {(s.gear && s.gear.owned.slice().reverse().map((it) => {
          const m = geaModel(s, it)
          const mv = gearValue(s, m)
          return (
            <div key={it.uid} className="row gear-item">
              <div style={{ flex: 1 }}>
                <b>{m.name}</b>
                <span className="sub"> 买入 ¥{fmt(it.buyPrice)} · 现价 ¥{fmt(mv)}</span>
              </div>
              <Btn kind="warn" onClick={() => { act(s, 'sellGear', it.uid); run() }}>卖出 ¥{fmt(Math.round(mv * m.keep))}</Btn>
            </div>
          )
        }))}
        {(!s.gear || s.gear.owned.length === 0) && <div className="sub">器械库空——去「选购器械」补几件主力干活机。</div>}
      </Section>

      <Section title="选购器械（现价波动，买后占用现金 + 每日折旧）">
        {Object.keys(GEAR).map((cat) => (
          <div key={cat} style={{ marginBottom: 6 }}>
            <b>{GEAR_CAT_NAMES[cat]}</b>
            <div className="row wrap">
              {GEAR[cat].map((m) => {
                const v = gearValue(s, m)
                const locked = s.grade < m.lock
                return (
                  <span key={m.key} className="row">
                    <Btn kind={locked ? '' : 'buy'} disabled={locked || s.cash < v}
                      title={locked ? `需店铺 ${m.lock}★` : m.note}
                      onClick={() => { act(s, 'buyGear', cat, m.key); run() }}>
                      {m.name} ¥{fmt(v)}{locked ? `（${m.lock}★）` : ''}
                    </Btn>
                    <span className="sub">{m.note}</span>
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </Section>

      <Section title="价格走势（近 14 天）" right={<span className="sub">区间 = 基准价 50%~150%</span>}>
        {Object.keys(GEAR).map((cat) => {
          const seen = new Set()
          const rows = ((s.gear && s.gear.owned) || []).filter((it) => {
            if (seen.has(it.model)) return false
            seen.add(it.model); return true
          }).filter((it) => it.cat === cat)
          if (rows.length === 0) return null
          return (
            <div key={cat} style={{ marginBottom: 6 }}>
              <b>{GEAR_CAT_NAMES[cat]}</b>
              {rows.map((it) => {
                const m = geaModel(s, it)
                const hist = ((s.gear.history && s.gear.history[it.model]) || []).slice(-14)
                const base = m.base || 1
                return (
                  <div key={it.uid} className="row trend-row">
                    <span style={{ width: 170 }}>{m.name}</span>
                    <span className="trend-bars">
                      {hist.map((v, i) => {
                        const up = i > 0 && v >= hist[i - 1]
                        return <span key={i} className={'tbar ' + (up ? 'up' : (i > 0 ? 'down' : ''))} style={{ height: Math.max(3, Math.round((v / (base * 1.5)) * 52)) }} title={`${fmt(v)}`} />
                      })}
                      {hist.length === 0 && <span className="sub">无记录</span>}
                    </span>
                    <span className="sub">¥{fmt(gearValue(s, m))}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </Section>
    </div>
  )
}
