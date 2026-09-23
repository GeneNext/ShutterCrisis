import React, { useState } from 'react'
import { fmt } from '../game/engine.js'
import {
  act, isReviewDay, hintOf, locUnlocked, MAP, REVIEWERS, RESCUE_DEALS, SERVICE_EVENTS,
  PRICING, WALKIN_POLICY, POSTS, strategyUnlock, setStaffCount,
} from '../game/engine.js'
import { Bar, Chip, Section, Btn } from './components.jsx'
import { I, LOC_I, ORDER_I, CROWD_I, PRICE_I, WALKIN_I, BOSS_I, POST_I, TIER_I } from './icons.js'

// ---------------- 轻结算：一条提示 + 继续（弱化复盘，详情在报表页） ----------------
export function SettleLite({ s, run, hint, onReview }) {
  const r = s.lastReport
  if (!r) return null
  const reviewDay = isReviewDay(s) && !s.reviewTiers.some((_, i) => false) && s.reviewDoneDay !== s.round + 1
  return (
    <div className="overlay lite" >
      <div className="settle-lite">
        <div className="sl-line">
          <b>{I.settle} 第 {r.day} 天结束</b>
          <span className={r.net >= 0 ? 'good' : 'bad'}>{I.cash} 净流 {r.net >= 0 ? '+' : ''}{fmt(r.net)}</span>
          <span>余额 {I.cash}¥{fmt(r.balance)}</span>
          {r.loss > 0 && <span className="bad">流失 ¥{fmt(r.loss)}</span>}
          <span className="sub">📋 {r.served} 单 · 留存 {r.retained} · 传播 {r.spread}</span>
        </div>
        <div className="sl-hint">{hint}</div>
        <div className="row end">
          {reviewDay && <Btn onClick={onReview}>🌙 锐评日 · 去投稿</Btn>}
          <Btn kind="primary" onClick={() => run('nextDay')}>{I.next} 继续 · 第 {r.day + 1} 天</Btn>
        </div>
      </div>
    </div>
  )
}

// ---------------- 锐评弹窗（周三特殊时刻） ----------------
export function ReviewModal({ s, run, onClose }) {
  return (
    <div className="overlay">
      <div className="modal wide">
        <ReviewInner s={s} run={run} onClose={onClose} />
      </div>
    </div>
  )
}
function ReviewInner({ s, run, onClose }) {
  const [workId, setWorkId] = useState(s.works.length ? s.works[s.works.length - 1].id : 0)
  const [retouch, setRetouch] = useState(40)
  const [reviewer, setReviewer] = useState('gentle')
  const [result, setResult] = useState(null)
  const done = s.reviewDoneDay === s.round + 1
  if (done || s.works.length === 0) {
    return (
      <div>
        <h2>{TIER_I.none} 锐评时刻（每周三）</h2>
        <div className="sub">{s.works.length === 0 ? '相册还没有作品，先交付几张照片。' : '本周已投稿，下周三再来。'}</div>
        <div className="row end"><Btn onClick={onClose}>关闭</Btn></div>
      </div>
    )
  }
  const w = s.works.find((x) => x.id === workId)
  const crowdPref = [40, 50, 57, 65, 75][w ? w.crowdIdx : 1] || 50
  return (
    <div>
      <h2>🎬 锐评时刻（选片 + 精修定档）</h2>
      <div className="row wrap" style={{ margin: '8px 0' }}>
        <select value={workId} onChange={(e) => setWorkId(parseInt(e.target.value, 10))}>
          {s.works.slice(-12).reverse().map((wk) => (
            <option key={wk.id} value={wk.id}>第{wk.day}天 · 质量 {(wk.quality * 100) | 0} 分</option>
          ))}
        </select>
        <select value={reviewer} onChange={(e) => setReviewer(e.target.value)}>
          {REVIEWERS.map((rv) => <option key={rv.key} value={rv.key}>{rv.name}（{rv.audience}）</option>)}
        </select>
        <span className="sub">客群偏好精修 ~{crowdPref}；过度修图会翻车</span>
      </div>
      <Bar v={retouch} label={`精修强度 ${retouch}`} color="blue" />
      <input type="range" min="0" max="100" value={retouch} onChange={(e) => setRetouch(parseInt(e.target.value, 10))} style={{ width: '100%' }} />
      {!result ? (
        <div className="row end">
          <Btn onClick={onClose}>算了</Btn>
          <Btn kind="primary" onClick={() => setResult(act(s, 'submitReview', workId, retouch, reviewer))}>投稿锐评</Btn>
        </div>
      ) : (
        <div className="review-result">
          <div className="big">{TIER_I[result.tier] || ''} {TIER_NAME(result.tier)}</div>
          <div className="sub">锐评评分 {(result.score * 100) | 0}</div>
          <div className="row end"><Btn kind="primary" onClick={() => { setResult(null); run(); onClose() }}>收下结果</Btn></div>
        </div>
      )}
    </div>
  )
}
function TIER_NAME(k) { return { god: '封神！', good: '好评', meme: '有梗', trash: '被毒舌了', none: '无人问津' }[k] }

// ---------------- 地图（双点县式：地点推进，1 星解锁下一地点） ----------------
export function MapModal({ world, onEnter, onClose }) {
  return (
    <div className="overlay map" onClick={onClose}>
      <div className="map-board" onClick={(e) => e.stopPropagation()}>
        <h2>{I.map} 快门县地图</h2>
        <div className="sub">每地点三星任务；1 星解锁下一地点。品牌（粉丝/技能）全县共享。</div>
        <div className="map-canvas">
          {MAP.map((loc, i) => {
            const unlocked = locUnlocked(world, loc.key)
            const stars = world.stars[loc.key] || 0
            const isCur = world.cur === loc.key
            const prevDone = !loc.unlock || (world.stars[loc.unlock.prev] || 0) >= loc.unlock.stars
            return (
              <div key={loc.key} className={'map-node ' + (unlocked ? '' : 'locked') + (isCur ? ' cur' : '')}
                style={{ left: loc.x + '%', top: loc.y + '%' }}>
                <div className="map-stars">{unlocked ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '🔒'}</div>
                <div className="map-name">{LOC_I[loc.key] || I.map} {loc.name}</div>
                <div className="map-desc">{loc.desc}</div>
                {isCur
                  ? <Chip kind="ok">{I.ok} 当前门店</Chip>
                  : unlocked
                    ? <Btn onClick={() => onEnter(loc.key)}>进入经营</Btn>
                    : <span className="sub">需「{MAP.find((m) => m.key === loc.unlock.prev).name}」1 星</span>}
                {!unlocked && <div className="map-lock" onClick={() => onEnter(loc.key)} style={{ cursor: 'not-allowed' }} />}
                {i === 0 && null}
              </div>
            )
          })}
          <div className="map-road" />
        </div>
        <div className="row end"><Btn onClick={onClose}>返回门店</Btn></div>
      </div>
    </div>
  )
}

// ---------------- 严重客诉升级（客服搞不定/积压过大才到老板面前） ----------------
export function ComplaintModal({ s, run, onGoStaff }) {
  const card = s.inbox.find((m) => m.kind === 'complaint')
  const backlog = card ? card.backlog : (s.complaintsBacklog || 0)
  return (
    <div className="overlay">
      <div className="modal small">
        <h2>{I.complaint} 客诉积压 · {backlog} 起</h2>
        <p style={{ margin: '8px 0' }}>投诉堆到老板面前了。</p>
        <div className="sub">根治：多招客服，或升接待区（前台每 2 级分担 1 名客服）。</div>
        <div className="row end" style={{ marginTop: 12 }}>
          <Btn onClick={() => { act(s, 'dismissComplaint'); run() }}>🙏 亲自平息（¥200，减半）</Btn>
          <Btn kind="primary" onClick={onGoStaff}>{I.hire} 去招募客服</Btn>
        </div>
      </div>
    </div>
  )
}

// ---------------- 吵架（回合制论战） ----------------
export function QuarrelModal({ s, run, onClose }) {
  const q = s.quarrel
  if (!q) return null
  const result = q.result
  return (
    <div className="overlay">
      <div className="modal">
        <h2>{I.angry} 争执现场 · {QUARREL_NAME(q.ct)}</h2>
        <div className="power">
          <div className="power-row"><span>🧑‍💼 你</span><Bar v={q.my} color="blue" label={q.my} /></div>
          <div className="power-row"><span>{I.angry} {QUARREL_NAME(q.ct)}客人</span><Bar v={q.foe} color="red" label={q.foe} /></div>
        </div>
        <div className="qlog">{q.log.map((l, i) => <div key={i}>{l}</div>)}</div>
        {!result ? (
          <div>
            <div className="sub" style={{ marginBottom: 6 }}>选沟通方式（每回合 3 选 1，说错话掉气势）：</div>
            <div className="talk-grid">
              {act(s, 'quarrelOptions').map((opt) => (
                <button key={opt.key} className={'talk-card' + (opt.strong ? ' strong' : '')}
                  onClick={() => { act(s, 'quarrelMove', opt.key); run() }}>
                  <div className="talk-name">{opt.name}{opt.strong ? ' · 克制' : ''}</div>
                  <div className="talk-text">「{opt.talk}」</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="row end">
            <Btn kind="primary" onClick={() => { act(s, 'clearQuarrel'); run(); onClose() }}>结束</Btn>
          </div>
        )}
      </div>
    </div>
  )
}
function QUARREL_NAME(key) { return { bossy: '蛮横型', shrewd: '精明型', emo: '情绪型', net: '网络型', fraud: '碰瓷型', power: '权力型', ai: 'AI质疑型' }[key] || key }

// ---------------- 亲自拍摄微操（可选） ----------------
export function ManualShootModal({ order, s, run, onClose }) {
  const [comp, setComp] = useState(50)
  const [timing, setTiming] = useState(50)
  const [sharp, setSharp] = useState(50)
  return (
    <div className="overlay">
      <div className="modal">
        <h2>{I.boss} 亲自拍摄 · {order.name}（可选）</h2>
        <div className="sub">三轴越接近 100 越好；老板精力 -15。</div>
        <Bar v={comp} color="blue" label={`构图 ${comp}`} />
        <input type="range" min="0" max="100" value={comp} onChange={(e) => setComp(+e.target.value)} style={{ width: '100%' }} />
        <Bar v={timing} color="blue" label={`时机（微笑峰值） ${timing}`} />
        <input type="range" min="0" max="100" value={timing} onChange={(e) => setTiming(+e.target.value)} style={{ width: '100%' }} />
        <Bar v={sharp} color="blue" label={`清晰度 ${sharp}`} />
        <input type="range" min="0" max="100" value={sharp} onChange={(e) => setSharp(+e.target.value)} style={{ width: '100%' }} />
        <div className="row end">
          <Btn onClick={onClose}>跳过（无惩罚）</Btn>
          <Btn kind="primary" onClick={() => { act(s, 'manualShoot', order.id, comp / 100, timing / 100, sharp / 100); run(); onClose() }}>按下快门</Btn>
        </div>
      </div>
    </div>
  )
}

// ---------------- 升级 / 任务仪式 ----------------
export function GradeCeremony({ c, onClose }) {
  return (
    <div className="overlay ceremony">
      <div className="ceremony-card">
        <div className="ceremony-sub">{c.type === 'task' ? '🏁 任务达成' : '🎉 升级评审通过'}</div>
        <div className="ceremony-plaque">{c.type === 'task' ? '★ 任务达成' : c.plaque}</div>
        {c.crowdName && <div className="ceremony-crowd">新主力客群：{c.crowdName}</div>}
        <div className="ceremony-list">
          {(c.unlocks || [c.text]).map((u, i) => (
            <div key={i} className="unlock-item" style={{ animationDelay: i * 0.25 + 's' }}>{I.lock} {u}</div>
          ))}
        </div>
        {c.reward && <div className="ceremony-reward">{I.cash} 奖励：{c.reward}</div>}
        <Btn kind="primary" big onClick={onClose}>{I.next} 继续经营</Btn>
      </div>
    </div>
  )
}

// ---------------- 收件箱 ----------------
export function Inbox({ s, run, onClose }) {
  const service = s.inbox.filter((m) => m.kind === 'service')
  const rescue = s.inbox.find((m) => m.kind === 'rescue')
  const quarrels = s.inbox.filter((m) => m.kind === 'quarrel')
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal inbox" onClick={(e) => e.stopPropagation()}>
        <h2>{I.inbox} 事件收件箱（客服事件必处理；其余可攒）</h2>
        {service.length === 0 && !rescue && quarrels.length === 0 && <div className="sub">收件箱是空的。</div>}
        {service.map((m) => {
          const tpl = SERVICE_EVENTS.find((t) => t.key === m.eventKey)
          return (
            <div key={m.id} className="inbox-card">
              <div className="row"><Chip kind="warn">{I.warn} 立即处理</Chip><b>{m.name}</b></div>
              <div className="sub">成因：{m.cause}</div>
              <div className="row wrap">
                {tpl.opts.map((o) => (
                  <Btn key={o.key} onClick={() => { act(s, 'resolveServiceEvent', m.id, o.key); run() }}
                    title={o.text}>
                    {o.name}{o.cost !== 0 && <span className="sub">（{o.cost > 0 ? '赔' : '收'}{Math.round((m.refPrice || 500) * Math.abs(o.cost))}）</span>}
                  </Btn>
                ))}
              </div>
            </div>
          )
        })}
        {quarrels.map((m) => (
          <div key={m.id} className="inbox-card">
            <div className="row"><Chip kind="warn">{I.warn} 立即处理</Chip><b>{m.name}</b></div>
            <Btn onClick={() => { act(s, 'startQuarrel', m.ref); run() }}>{I.angry} 现场论战</Btn>
            <Btn kind="ghost" onClick={() => { act(s, 'dismissInbox', m.id); run() }}>忍了</Btn>
          </div>
        ))}
        {s.inbox.filter((m) => m.kind === 'rushoffer').map((m) => (
          <div key={m.id} className="inbox-card">
            <div className="row"><Chip kind="ok">{I.ok} 机会 · 当日有效</Chip><b>{m.name}</b></div>
            <div className="sub">加急费 +50%，下一时段到店插队处理。</div>
            <div className="row wrap">
              <Btn kind="primary" onClick={() => { act(s, 'acceptRush', m.id); run() }}>{I.fast} 接单（+50%）</Btn>
              <Btn kind="ghost" onClick={() => { act(s, 'declineRush', m.id); run() }}>婉拒（口碑 -0.02）</Btn>
            </div>
          </div>
        ))}
        {s.inbox.filter((m) => m.kind === 'complaint').map((m) => (
          <div key={m.id} className="inbox-card">
            <div className="row"><Chip kind={m.level === 'must' ? 'danger' : 'warn'}>{I.complaint} 客诉积压 {m.backlog} 起</Chip><b>建议扩充客服</b></div>
            <div className="sub">客服在岗数与接待区等级决定每日消化量；积压拖垮口碑。</div>
            <div className="row wrap">
              <Btn onClick={() => { act(s, 'dismissComplaint'); run() }}>🙏 亲自平息（¥200，减半）</Btn>
            </div>
          </div>
        ))}
        {rescue && (
          <div className="inbox-card rescue">
            <div className="row"><Chip kind="danger">{I.danger} 必须处理 · 破产防线</Chip><b>{rescue.name}</b></div>
            <div className="sub">现金流危险态。接救命大单回血（代价：通宵 + 口碑小扣，30 天一次）。</div>
            <div className="row wrap">
              {!s.rescue.entitled && <Btn onClick={() => { act(s, 'watchAd'); run() }}>📺 看广告解锁（免费）</Btn>}
              {!s.rescue.entitled && <Btn onClick={() => { act(s, 'payUnlock'); run() }}>💳 付费解锁</Btn>}
            </div>
            {s.rescue.entitled && RESCUE_DEALS.map((d) => (
              <div key={d.key} className="row">
                <Btn kind="primary" onClick={() => { act(s, 'takeRescueDeal', d.key); run(); onClose() }}>
                  {I.start} 接「{d.name}」（约 ×{d.mult} 客单 · 精力 -{d.energyCost} · 口碑 -{d.repCost}）
                </Btn>
              </div>
            ))}
          </div>
        )}
        <div className="row end"><Btn onClick={onClose}>关闭</Btn></div>
      </div>
    </div>
  )
}

// ---------------- 结局 ----------------
export function Ending({ s, onRestart }) {
  const e = s.ended
  return (
    <div className="overlay ceremony">
      <div className="ceremony-card">
        <div className="ceremony-sub">{e.type === 'bankrupt' ? '💸 破产结算' : '🏁 收店退休'}</div>
        <div className="ceremony-plaque">{e.type === 'bankrupt' ? '快门落下' : '传奇影楼'}</div>
        <div className="ceremony-crowd">{e.text}</div>
        <div className="ceremony-list">
          <div className="unlock-item">经营 {s.round} 天 · 交付 {s.delivered} 单 · {I.fans}粉丝 {fmt(s.fans)} · {I.rep}口碑 {s.reputation.toFixed(1)} 星</div>
        </div>
        <Btn kind="primary" big onClick={onRestart}>{I.map} 回到地图（新档）</Btn>
      </div>
    </div>
  )
}

// ---------------- 开始营业配置：进入营业前弹出的经营策略 + 班底人数弹窗 ----------------
// 新手只能选「老板亲自操刀」等最简单项；培训/花钱（trainInvest）后逐步解锁高级项。
export function BusinessStartModal({ s, run, onStart }) {
  const ul = strategyUnlock(s)
  const countOf = (post) => s.staff.filter((e) => e.post === post).length
  return (
    <div className="overlay">
      <div className="modal wide start-config">
        <h2>今天怎么开张？</h2>
        <p className="sub">策略确认即生效；班底人数决定当天各岗位并发。高级项靠培训投入解锁。</p>

        <Section title={`${PRICE_I[PRICING[0].key] || I.cash} 定价（影响客流 / 毛利 / 口碑）`}>
          <div className="row wrap">
            {PRICING.map((p) => {
              const g = ul.price(p.key)
              return (
                <Btn key={p.key} kind={s.priceTier === p.key ? 'on' : ''} disabled={!g.ok}
                  onClick={() => { act(s, 'setPrice', p.key); run() }} title={g.ok ? p.name : `需累计培训投入 ¥${g.need}`}>
                  {PRICE_I[p.key] || ''} {p.name} ×{p.mul}
                  {!g.ok && <span className="lock">{I.lock} 培训 ¥{g.need}</span>}
                </Btn>
              )
            })}
          </div>
          <div className="sub">{I.course} 已投入培训 {I.cash}¥{fmt(ul.inv)}</div>
        </Section>

        <Section title={`${WALKIN_I[WALKIN_POLICY[1].key] || I.slot} walk-in 分流（动线压力与收益倾向）`}>
          <div className="row wrap">
            {WALKIN_POLICY.map((w) => {
              const g = ul.walkin(w.key)
              return (
                <Btn key={w.key} kind={s.walkinPolicy === w.key ? 'on' : ''} disabled={!g.ok} title={w.desc + (g.ok ? '' : `（需 ¥${g.need}）`)}
                  onClick={() => { act(s, 'setWalkInPolicy', w.key); run() }}>
                  {WALKIN_I[w.key] || ''} {w.name}
                  {!g.ok && <span className="lock">{I.lock} 培训 ¥{g.need}</span>}
                </Btn>
              )
            })}
          </div>
        </Section>

        <Section title={`${BOSS_I.hands_on} 老板值班风格`}>
          <div className="row wrap">
            <Btn kind={s.boss.style === 'hands_on' ? 'on' : ''} onClick={() => { act(s, 'setBossStyle', 'hands_on'); run() }}>
              {BOSS_I.hands_on} 亲力亲为<span className="sub">开局可选</span>
            </Btn>
            {(() => {
              const g = ul.boss('delegator')
              return (
                <Btn kind={s.boss.style === 'delegator' ? 'on' : ''} disabled={!g.ok}
                  onClick={() => { act(s, 'setBossStyle', 'delegator'); run() }}>
                  {BOSS_I.delegator} 甩手掌柜{!g.ok && <span className="lock">{I.lock} 培训 ¥{g.need}</span>}
                </Btn>
              )
            })()}
          </div>
          <span className="sub">精力 {s.boss.energy}/100</span>
        </Section>

        <Section title={`${POST_I.photographer} 班底人数（默认 1 摄影师 + 1 化妆师）`}>
          <div className="lineup">
            {POSTS.map((p) => {
              const n = countOf(p.post)
              const defaultLabel = p.key === 'photographer' || p.key === 'makeup' ? '（默认）' : ''
              return (
                <div key={p.key} className={'lineup-row ' + (n > 0 ? 'has' : '')}>
                  <b>{POST_I[p.post] || ''} {p.name}</b>{defaultLabel && <span className="sub">{defaultLabel}</span>}
                  <div className="stepper">
                    <button className="mini step" onClick={() => { setStaffCount(s, p.key, Math.max(0, n - 1)); run() }}>−</button>
                    <span className="step-n">{n}</span>
                    <button className="mini step" onClick={() => { setStaffCount(s, p.key, Math.min(6, n + 1)); run() }}>＋</button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="sub">人越多工资越高；缺岗会让动线排队卡死。</div>
        </Section>

        <div className="row end start-config-go">
          <Btn kind="primary" big onClick={onStart}>{I.start} 确认 · 开门营业</Btn>
        </div>
      </div>
    </div>
  )
}
