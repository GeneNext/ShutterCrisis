// 店内舞台：房间绝对定位 + 客人/员工小点实时流动 + 点房间就地升级（双点医院式「看小人」）
import React, { useState } from 'react'
import {
  fmt, act, FACILITIES, TIER_NAMES, FORMS, FORM_RENOVATE, STATIONS, PRICING, WALKIN_POLICY,
  expandPreview,
} from '../game/engine.js'
import { Bar, Chip, Section, Btn } from './components.jsx'
import { TasksHUD } from './panels.jsx'

// 舞台布局（百分比）：房间即工位容器的可视化
const STAGE = {
  reception: { x: 5,  y: 54, w: 28, h: 40, name: '前台大厅' },
  makeup:    { x: 39, y: 10, w: 16, h: 26, name: '化妆间' },
  studio:    { x: 37, y: 42, w: 28, h: 40, name: '影棚' },
  retouch:   { x: 68, y: 10, w: 14, h: 26, name: '修图间' },
  rest:      { x: 85, y: 54, w: 12, h: 28, name: '休息区' },
  storage:   { x: 5,  y: 10, w: 14, h: 20, name: '储物间' },
  display:   { x: 5,  y: 34, w: 14, h: 16, name: '展示墙' },
}
const STATION_ROOM = (key) => (STATIONS.find((x) => x.key === key) || {}).zone
const ROOM_OF_POST = { photographer: 'studio', retoucher: 'retouch', makeup: 'makeup', service: 'reception', assistant: 'storage' }

export function Home({ s, run, world, onManualShoot }) {
  const business = s.phase === 'business'
  return (
    <div className="home">
      <TasksHUD world={world} />
      <StagePlan s={s} run={run} business={business} onManualShoot={onManualShoot} />
      <StrategyPanel s={s} run={run} />
    </div>
  )
}

function StagePlan({ s, run, business, onManualShoot }) {
  const [sel, setSel] = useState('studio')
  const frame = business ? s.frames[s.frames.length - 1] : null
  // 客人小点：定位 = 所在房间中心 + 同房间索引散布；CSS transition 产生流动动画
  const dots = []
  for (const o of s.activeOrders.filter((x) => !x.done)) {
    const zoneKey = STATION_ROOM(o.station) || 'reception'
    const room = STAGE[zoneKey]
    const same = dots.filter((d) => d.zone === zoneKey).length
    const col = same % 3, row = Math.floor(same / 3) % 3
    dots.push({
      id: o.id, zone: zoneKey,
      x: room.x + room.w / 2 + (col - 1) * 8,
      y: room.y + room.h / 2 + (row - 1) * 10,
      price: o.price, name: o.name, serving: !o.waitedHere,
    })
  }
  // 员工小点：类型 → 对应房间；休息中 → 休息区（类型与等级可视化）
  const staffDots = s.staff.filter((e) => !e.dayOff).map((e, i) => {
    const resting = e.resting || e.energy < 30
    const room = STAGE[resting ? 'rest' : ROOM_OF_POST[e.post]] || STAGE.reception
    return {
      id: e.id, x: room.x + room.w / 2 + ((i % 2) - 0.5) * 10,
      y: room.y + room.h / 2 - 9, name: e.name, lv: e.skill, rest: resting,
    }
  })
  const f = FACILITIES.find((x) => x.key === sel)
  const lv = s.fac[sel]
  const cap = Math.min(s.grade + 1, 5)
  const rnv = s.renovations.find((r) => r.zone === sel)
  const cost = lv < 5 ? f.upCost[lv + 1] : 0
  const nextName = TIER_NAMES[sel] ? TIER_NAMES[sel][lv] : `${lv + 1} 级`
  const hasForm = !!FORMS[sel]
  const queueOf = (zoneKey) => {
    if (!frame || !frame.stations) return 0
    return Object.entries(frame.stations)
      .filter(([k]) => STATION_ROOM(k) === zoneKey)
      .reduce((a, [, v]) => a + v.queue, 0)
  }
  return (
    <Section title="店内舞台（客人在房间间流动 · 点房间就地升级 · 点「亲自拍」上手微操）"
      right={business ? <Chip kind="warn">时段 {Math.min(s.slot + 1, s.slotsTotal)}/{s.slotsTotal}</Chip> : <span className="sub">当前为非营业时段</span>}>
      <div className="stage">
        {Object.entries(STAGE).map(([key, r]) => {
          const servingN = business && frame && frame.stations
            ? Object.entries(frame.stations).filter(([k]) => STATION_ROOM(k) === key).reduce((a, [, v]) => a + v.serving.length, 0)
            : 0
          const qN = business ? queueOf(key) : 0
          const rnvHere = s.renovations.find((x) => x.zone === key)
          const built = (s.roomsBuilt && s.roomsBuilt[key]) != null ? s.roomsBuilt[key] : 1
          const roomCap = Math.min(s.grade + 1, 5)
          const canBuild = built < roomCap
          return (
            <div key={key} className={'stage-room ' + (sel === key ? 'sel' : '')}
              style={{ left: r.x + '%', top: r.y + '%', width: r.w + '%', height: r.h + '%' }}>
              <div className="sr-head" onClick={() => setSel(key)}>{r.name} <span>{built}间·Lv{s.fac[key]}</span></div>
              <div className="sr-rooms">
                {Array.from({ length: built }).map((_, i) => (
                  <div key={i} className="sr-room on" onClick={() => setSel(key)} />
                ))}
                {canBuild && (
                  <div className="sr-room empty" title={`空地：建造 ${r.name} 第 ${built + 1} 间（并发 +1）`}
                    onClick={() => { act(s, 'buildRoom', key); run() }}>
                    ＋建
                  </div>
                )}
              </div>
              {servingN > 0 && <div className="sr-serve">服务中 ×{servingN}</div>}
              {qN > 0 && <div className="sr-queue">排队 ×{qN}</div>}
              {rnvHere && <div className="sr-rnv">施工{rnvHere.daysLeft}天</div>}
            </div>
          )
        })}
        {dots.map((d) => (
          <div key={d.id} className={'guest ' + (d.serving ? 'serve' : 'wait')}
            style={{ left: `calc(${d.x}% - 16px)`, top: `calc(${d.y}% - 10px)` }}
            title={`${d.name} · ¥${fmt(d.price)}（${d.serving ? '服务中' : '排队'}）`}>
            <span className="g-name">{d.name}</span>
            <span className="g-price">¥{fmt(d.price)}</span>
            {d.serving && d.zone === 'studio' && (
              <button className="mini shoot" onClick={() => {
                const o = s.activeOrders.find((x) => x.id === d.id)
                if (o) onManualShoot(o)
              }}>亲自拍</button>
            )}
          </div>
        ))}
        {staffDots.map((d) => (
          <div key={d.id} className={'staffdot ' + (d.rest ? 'resting' : '')}
            style={{ left: `calc(${d.x}% - 12px)`, top: `calc(${d.y}% - 10px)` }}
            title={`${d.name}（Lv ${d.lv}）${d.rest ? ' · 休息中' : ''}`}>
            Lv{d.lv}
          </div>
        ))}
      </div>
      <div className="room-detail">
        <b>{f.name}</b> <span className="sub">{TIER_NAMES[sel] ? '当前：' + TIER_NAMES[sel][lv - 1] : ''}</span>
        <div className="row wrap" style={{ marginTop: 6 }}>
          {lv < 5
            ? <Btn onClick={() => { act(s, 'upgradeFacility', sel); run() }} disabled={s.cash < cost || lv >= cap}>
                升级 → {nextName}（¥{fmt(cost)}）{lv >= cap ? ' · 需升星解锁' : ''}
              </Btn>
            : <Chip kind="ok">已满级</Chip>}
          {hasForm && (s.forms[sel] || 0) < 2 && !rnv && (
            <Btn onClick={() => { act(s, 'renovateFacility', sel, (s.forms[sel] || 0) + 1); run() }}>
              改造 → {FORMS[sel][(s.forms[sel] || 0) + 1]}（¥{fmt(FORM_RENOVATE[(s.forms[sel] || 0) + 1].cost)} · {FORM_RENOVATE[(s.forms[sel] || 0) + 1].days} 天）
            </Btn>
          )}
          {rnv && <Chip kind="warn">施工中：剩 {rnv.daysLeft} 天</Chip>}
          {f.cat === 'equip' && lv > 1 && (
            <button className="mini" onClick={() => { act(s, 'sellEquipment', sel); run() }}>变卖当前级（回收 40%）</button>
          )}
        </div>
        <div className="sub">{f.desc}</div>
      </div>
    </Section>
  )
}

// 扩张对照 + 经营策略（店内设施升级已并入舞台点选）
function StrategyPanel({ s, run }) {
  return (
    <>
      <Section title="店面扩张（一次性投入 / 新增日固定支出 / 回本天数 对照）">
        <div className="expand-grid">
          {['right', 'back', 'second'].map((dir) => {
            const pv = expandPreview(s, dir)
            if (!pv) return null
            return (
              <div key={dir} className="expand-card">
                <b>{pv.name}</b>
                <div className="sub">一次性 ¥{fmt(pv.cost)} · 工期 {pv.days} 天（施工期全店降效 50%）</div>
                <div className="sub">新增日固定支出 ¥{fmt(pv.addFixedPerDay)}（租金+水电）</div>
                <div className="sub">近 3 日均收入 ¥{fmt(pv.recentDailyIncome)}{pv.paybackDays ? ` · 预计回本 ${pv.paybackDays} 天` : ''}</div>
                <Btn disabled={!!pv.unavailable || s.cash < pv.cost} onClick={() => { act(s, 'expandStudio', dir); run() }}>
                  {pv.unavailable || '开工'}
                </Btn>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="经营策略">
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
    </>
  )
}
