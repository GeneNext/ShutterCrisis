// 店内舞台（16:9 横屏）：员工列表左栏 + 房间绝对定位舞台 + 底部速度控制条
// 扩店由「常驻区块」改为「舞台边缘忽闪提醒，点开看详细对照」
import React, { useState } from 'react'
import {
  fmt, act, FACILITIES, TIER_NAMES, FORMS, FORM_RENOVATE, STATIONS,
  expandPreview,
} from '../game/engine.js'
import { Chip, Section, Btn } from './components.jsx'
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
const EXPAND_ANCHOR = {
  right:  { x: 97, y: 34, label: '向右扩店' },
  back:   { x: 88, y: 4,  label: '向后扩店' },
  second: { x: 97, y: 2,  label: '加盖二楼' },
}
const STATION_ROOM = (key) => (STATIONS.find((x) => x.key === key) || {}).zone
const ROOM_OF_POST = { photographer: 'studio', retoucher: 'retouch', makeup: 'makeup', service: 'reception', assistant: 'storage' }
const POST_NAMES = { photographer: '摄影师', retoucher: '修图师', makeup: '化妆师', service: '客服', assistant: '学徒' }

export function Home({ s, run, world, onManualShoot, speed, setSpeed, onSkip }) {
  const business = s.phase === 'business'
  return (
    <div className="home">
      <div className="home-top">
        <aside className="staff-rail">
          <StaffRail s={s} run={run} />
        </aside>
        <main className="stage-col">
          <StagePlan s={s} run={run} business={business} onManualShoot={onManualShoot} />
          <StageBar business={business} speed={speed} setSpeed={setSpeed} onSkip={onSkip} s={s} />
        </main>
      </div>
      <TasksHUD world={world} />
    </div>
  )
}

// ---------- 员工列表（舞台左栏） ----------
function StaffRail({ s }) {
  return (
    <Section title="员工">
      {s.staff.length === 0 && <div className="sub">店里没有人。</div>}
      <div className="rail-staff">
        {s.staff.map((e) => (
          <div key={e.id} className={'rail-e ' + (e.dayOff ? 'off' : '')}>
            <div className="rail-line">
              <b>{e.name}</b>
              <Chip kind="stage">{POST_NAMES[e.post] || e.post}</Chip>
              <span className="rail-lv">Lv{e.skill}</span>
            </div>
            <div className="rail-meta">
              {e.resting || e.energy < 30
                ? <Chip kind="warn">休息中 {e.energy}</Chip>
                : e.energy < 60 ? <Chip kind="warn">精力 {e.energy}</Chip> : <span className="sub">精力 {e.energy}</span>}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ---------- 舞台底部控制条：倍速 + 跳到结算（营业态顶栏简化后移到这里） ----------
function StageBar({ business, speed, setSpeed, onSkip, s }) {
  return (
    <div className="stage-bar">
      {business ? (
        <>
          <span className="stage-bar-speed">
            {['pause', 'slow', '1x', '2x', '4x'].map((sp) => (
              <button key={sp} className={'mini ' + (speed === sp ? 'on' : '')} onClick={() => setSpeed(sp)}>
                {sp === 'pause' ? '暂停' : sp === 'slow' ? '慢' : sp}
              </button>
            ))}
          </span>
          <span className="stage-bar-slot"><Chip kind="warn">时段 {Math.min(s.slot + 1, s.slotsTotal)}/{s.slotsTotal}</Chip></span>
          <span className="stage-bar-skip"><button className="mini" onClick={onSkip}>跳到结算</button></span>
        </>
      ) : (
        <span className="sub">当前为非营业时段——去晨会「开始营业」。</span>
      )}
    </div>
  )
}

function StagePlan({ s, run, business, onManualShoot }) {
  const [sel, setSel] = useState('studio')
  const [expandDir, setExpandDir] = useState(null) // 点开扩店详情的方向
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
  // 扩店：可扩且未完成的方向 → 舞台边缘忽闪提醒；点开看详细对照
  const expandReady = []
  for (const dir of ['right', 'back', 'second']) {
    const pv = expandPreview(s, dir)
    if (pv && !pv.unavailable && s.cash >= pv.cost) expandReady.push(pv)
  }
  return (
    <Section title="店内舞台（客人在房间间流动 · 点房间就地升级 · 点「亲自拍」上手微操）"
      right={business
        ? <Chip kind="warn">时段 {Math.min(s.slot + 1, s.slotsTotal)}/{s.slotsTotal}</Chip>
        : (expandReady.length ? <Chip kind="boss">有扩店可开工（忽闪处点开）</Chip> : <span className="sub">当前为非营业时段</span>)}>
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
          const fup = FACILITIES.find((x) => x.key === key)
          const upCost = s.fac[key] < 5 ? (fup && fup.upCost[s.fac[key] + 1]) || 0 : 0
          return (
            <div key={key} className={'stage-room ' + (sel === key ? 'sel' : '')}
              style={{ left: r.x + '%', top: r.y + '%', width: r.w + '%', height: r.h + '%' }}>
              <div className="sr-head" onClick={() => setSel(key)}>{r.name} <span>{built}间·Lv{s.fac[key]}</span></div>
              {s.fac[key] < roomCap && upCost > 0 && (
                <div className="sr-up" onClick={() => setSel(key)} title="点房间就地升级">升 Lv{s.fac[key] + 1} · ¥{fmt(upCost)}</div>
              )}
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
        {/* 扩店忽闪提醒（舞台对应区域 + 高亮） */}
        {expandReady.map((pv) => {
          const a = EXPAND_ANCHOR[pv.dir]
          return (
            <button key={pv.dir} className={'expand-blink ' + (expandDir === pv.dir ? 'on' : '')}
              style={{ left: a.x + '%', top: a.y + '%', transform: 'translate(-50%,-50%)' }}
              onClick={() => setExpandDir(expandDir === pv.dir ? null : pv.dir)} title={pv.name}>
              扩 {pv.dir === 'right' ? '右→' : pv.dir === 'back' ? '↑后' : '↑二楼'} · ¥{fmt(pv.cost)}
            </button>
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
      {expandDir && (
        <div className="expand-pop">
          <ExpandCard s={s} run={run} dir={expandDir} onClose={() => setExpandDir(null)} />
        </div>
      )}
      <div className="room-detail">
        <b>{f.name}</b> <span className="sub">{TIER_NAMES[sel] ? '当前：' + TIER_NAMES[sel][lv - 1] : ''}</span>
        {lv < 5 && f.gain && f.gain[lv - 1] && (
          <div className="gain-next" title="下一级解锁的具名能力">升 Lv{lv + 1} → {f.gain[lv - 1]}</div>
        )}
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

// 点开忽闪后的扩店详细对照
function ExpandCard({ s, run, dir, onClose }) {
  const pv = expandPreview(s, dir)
  if (!pv) return null
  return (
    <div className="expand-card inline">
      <div className="expand-head-row">
        <b>{pv.name}</b>
        <button className="mini" onClick={onClose}>收起 ✕</button>
      </div>
      <div className="sub">一次性 ¥{fmt(pv.cost)} · 工期 {pv.days} 天（施工期全店降效 50%）</div>
      <div className="sub">新增日固定支出 ¥{fmt(pv.addFixedPerDay)}（租金+水电）</div>
      <div className="sub">近 3 日均收入 ¥{fmt(pv.recentDailyIncome)}{pv.paybackDays ? ` · 预计回本 ${pv.paybackDays} 天` : ''}</div>
      <div className="row" style={{ marginTop: 6 }}>
        <Btn disabled={!!pv.unavailable || s.cash < pv.cost} onClick={() => { act(s, 'expandStudio', dir); run() }}>
          {pv.unavailable || '开工'}
        </Btn>
        <span className="sub">需要店铺 {pv.needGrade}★</span>
      </div>
    </div>
  )
}