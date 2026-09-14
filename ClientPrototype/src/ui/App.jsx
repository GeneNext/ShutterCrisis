import React, { useEffect, useRef, useState } from 'react'
import {
  createWorld, switchLocation, evalTasks, hintOf, locUnlocked, autoMorning,
  act, nextDay, startBusiness, stepSlot, skipDay, saveGame, loadGame, clearSave,
  fmt, isReviewDay,
} from '../game/engine.js'
import { Briefing, Orders, Staff, Market, Report, Gear, stateName } from './panels.jsx'
import { Home } from './home-stage.jsx'
import { SettleLite, QuarrelModal, ManualShootModal, GradeCeremony, Inbox, Ending, MapModal, ReviewModal, ComplaintModal } from './modals.jsx'
import { Btn, useToasts, Chip } from './components.jsx'

const SPEED_MS = { slow: 3000, '1x': 1800, '2x': 900, '4x': 450 }
const TABS = [
  { key: 'home', name: '门店' },
  { key: 'orders', name: '订单' },
  { key: 'staff', name: '员工' },
  { key: 'gear', name: '器械' },
  { key: 'market', name: '线上' },
  { key: 'report', name: '报表' },
]
const PLAQUES = ['1★ 街角小店', '2★ 口碑相馆', '3★ 社区名店', '4★ 城市名店', '5★ 传奇影楼']
const LOC_NAMES = { street: '老街影像社', campus: '大学城快闪店', mall: '商圈旗舰店', lot: '影视基地棚', fashion: '时装周馆' }

function loadWorldOrNew() {
  const w = loadGame()
  if (w && w.locs && w.cur && w.locs[w.cur]) return w
  clearSave()
  return createWorld()
}

export default function App() {
  const [world, setWorld] = useState(loadWorldOrNew)
  const [tab, setTab] = useState('home')
  const [speed, setSpeed] = useState('slow')
  const [panel, setPanel] = useState(null) // 'inbox' | 'map' | 'review' | 'brief'（可开合面板，营业暂停）
  const [manualOrder, setManualOrder] = useState(null)
  const timer = useRef(null)
  const pausedRef = useRef(false)

  const s = world.locs[world.cur]
  const sync = () => setWorld({ ...world })
  const run = (action) => {
    if (action === 'startBusiness') startBusiness(s)
    else if (action === 'nextDay') {
      nextDay(s)
      if (world.autoBrief !== false) { autoMorning(s); startBusiness(s) } // 全自动：直接流入新一天的营业
    }
    sync()
  }
  const restart = () => { clearSave(); setWorld(createWorld()); setTab('home') }
  const gotoLocation = (key) => { const r = switchLocation(world, key); if (r.ok) { sync(); setPanel(null) } }

  // ---- 统一弹窗决策：同一时刻只有一个弹层，杜绝互相遮挡 ----
  // 优先级：结局 > 吵架 > 加急 > 亲自拍 > 仪式 > 轻结算 > 面板（收件箱/地图/锐评/今日安排）
  let modal = null
  if (s.ended) modal = { type: 'ending' }
  else if (s.quarrel) modal = { type: 'quarrel' }
  else if (s.inbox.some((m) => m.kind === 'complaint' && m.level === 'must')) modal = { type: 'complaint' }
  else if (manualOrder) modal = { type: 'manual' }
  else if (s.celebrate.length > 0) modal = { type: 'celebrate' }
  else if (s.phase === 'settle') modal = { type: 'settle' }
  else if (panel === 'inbox') modal = { type: 'inbox' }
  else if (panel === 'map') modal = { type: 'map' }
  else if (panel === 'review') modal = { type: 'review' }
  else if (panel === 'brief') modal = { type: 'brief' }
  const modalType = modal ? modal.type : null
  // 暂停集合：只有需要玩家当场处理的弹窗才暂停营业；收件箱/地图/安排等面板打开时营业继续
  const HALTING = ['quarrel', 'complaint', 'settle', 'celebrate', 'ending']
  pausedRef.current = !!modal && HALTING.includes(modal.type)

  // 营业幕：按速度推进时段；任何弹窗期间暂停（含吵架/加急/收件箱/地图）
  useEffect(() => {
    if (timer.current) { clearInterval(timer.current); timer.current = null }
    if (s.phase === 'business' && speed !== 'pause') {
      timer.current = setInterval(() => {
        if (pausedRef.current) return
        stepSlot(s)
        if (s.phase === 'settle') evalTasks(world)
        sync()
      }, SPEED_MS[speed])
    }
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [s.phase, speed, world.cur])

  useEffect(() => { if (s.phase === 'settle' || s.phase === 'briefing') saveGame(world) }, [s.phase, s.round, world.cur])

  // 营业中吵架即时弹出：自动进入论战（吵架期间弹窗暂停，处理完恢复）
  useEffect(() => {
    if (s.pendingQuarrel && !s.quarrel && s.phase === 'business') {
      act(s, 'startQuarrel', s.pendingQuarrel)
      act(s, 'clearPendingQuarrel')
      sync()
    }
  }, [s.pendingQuarrel, s.quarrel])

  const serviceCount = s.inbox.filter((m) => m.kind === 'service').length
  const rescueCount = s.inbox.filter((m) => m.kind === 'rescue').length
  const inBusiness = s.phase === 'business'
  const locName = LOC_NAMES[s.locKey] || s.locKey
  const showBriefing = s.phase === 'briefing' || panel === 'brief'
  const closePanel = () => setPanel(null)

  return (
    <div className="app">
      {/* 顶栏：地图入口 / 店牌 / 现金 / 状态 / 收件箱 / 速度 */}
      <div className="topbar">
        <div className="brand">
          <button className="plaque map-btn" onClick={() => setPanel('map')} title="打开地图，切换地点">
            {PLAQUES[s.grade - 1]}
          </button>
          <span className="sub">{locName} · 第 {s.round + 1} 天{'★'.repeat(Math.min(3, world.stars[s.locKey] || 0))}</span>
        </div>
        <div className="top-stats">
          <div className={'cash ' + (s.cash < 0 ? 'bad' : '')}>¥{fmt(s.cash)}</div>
          <Chip kind={cashKind(s)}>{stateName(s)}</Chip>
          <Chip>口碑 {s.reputation.toFixed(1)}</Chip>
          <Chip>粉丝 {fmt(s.fans)}</Chip>
          {(s.complaintsBacklog || 0) > 0 && <Chip kind="warn">客诉 {s.complaintsBacklog}</Chip>}
          {inBusiness && <Chip kind="warn">时段 {Math.min(s.slot + 1, s.slotsTotal)}/{s.slotsTotal}</Chip>}
        </div>
        <div className="top-actions">
          {inBusiness && (
            <>
              {['pause', 'slow', '1x', '2x', '4x'].map((sp) => (
                <button key={sp} className={'mini ' + (speed === sp ? 'on' : '')} onClick={() => setSpeed(sp)}>
                  {sp === 'pause' ? '暂停' : sp === 'slow' ? '慢' : sp}
                </button>
              ))}
              <button className="mini" onClick={() => { skipDay(s); evalTasks(world); sync() }}>跳到结算</button>
            </>
          )}
          <button className={'mini ' + (serviceCount + rescueCount > 0 ? 'alert' : '')} onClick={() => setPanel(panel === 'inbox' ? null : 'inbox')}>
            收件箱{serviceCount + rescueCount > 0 ? ` (${serviceCount + rescueCount})` : ''}
          </button>
          <button className="mini" onClick={() => setPanel(panel === 'brief' ? null : 'brief')} title="接单 / 排期 / 员工预警 / 广告">
            {showBriefing && panel === 'brief' ? '回到舞台' : '今日安排'}
          </button>
        </div>
      </div>
      {s.cash < 0 && <div className="bankrupt-pulse" />}

      {/* 晨会（首日教学或「今日安排」）为全屏；其余时段为舞台+页签 */}
      {showBriefing ? (
        <Briefing s={s} run={(a) => { run(a); if (a === 'startBusiness') setPanel(null) }} world={world} />
      ) : (
        <>
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.key} className={'tab ' + (tab === t.key ? 'on' : '')} onClick={() => setTab(t.key)}>{t.name}</button>
            ))}
            {isReviewDay(s) && s.phase === 'business' && <Chip kind="stage">今晚锐评日：结算后可投稿</Chip>}
          </div>
          <div className="page">
            {tab === 'home' && <Home s={s} run={run} world={world} onManualShoot={(o) => setManualOrder(o)} />}
            {tab === 'orders' && <Orders s={s} />}
            {tab === 'staff' && <Staff s={s} run={run} />}
            {tab === 'gear' && <Gear s={s} run={run} />}
            {tab === 'market' && <Market s={s} run={run} />}
            {tab === 'report' && <Report s={s} run={run} />}
          </div>
        </>
      )}

      {/* 统一弹层：一次只渲染一个 */}
      {modalType === 'ending' && <Ending s={s} onRestart={restart} />}
      {modalType === 'quarrel' && <QuarrelModal s={s} run={run} onClose={sync} />}
      {modalType === 'complaint' && (
        <ComplaintModal s={s} run={run} onGoStaff={() => { setPanel(null); setTab('staff') }} />
      )}
      {modalType === 'manual' && <ManualShootModal order={manualOrder} s={s} run={run} onClose={() => { setManualOrder(null); sync() }} />}
      {modalType === 'celebrate' && <CelebrateModal s={s} sync={sync} />}
      {modalType === 'settle' && (
        <SettleLite
          s={s} run={run} hint={hintOf(s)}
          onReview={() => setPanel('review')}
        />
      )}
      {modalType === 'inbox' && <Inbox s={s} run={run} onClose={() => setPanel(null)} />}
      {modalType === 'map' && <MapModal world={world} onEnter={gotoLocation} onClose={() => setPanel(null)} />}
      {modalType === 'review' && <ReviewModal s={s} run={run} onClose={() => setPanel(null)} />}
      {useToasts(s)}
    </div>
  )
}

// 仪式弹层（升星 / 任务 / 合伙人 / 评奖 / 里程碑）
function CelebrateModal({ s, sync }) {
  const c = s.celebrate[0]
  if (!c) return null
  if (c.type === 'grade' || c.type === 'task') {
    return (
      <GradeCeremony
        c={c.type === 'grade'
          ? c
          : { plaque: '任务达成', unlocks: [c.text], crowdName: '', reward: '' }}
        onClose={() => { s.celebrate.shift(); sync() }}
      />
    )
  }
  return (
    <div className="overlay" onClick={() => { s.celebrate.shift(); sync() }}>
      <div className="modal small center">
        <h2>{c.type === 'partner' ? '班底' : c.type === 'award' ? '年度评奖' : '里程碑'}</h2>
        <p>{c.text}</p>
        <Btn kind="primary" onClick={() => { s.celebrate.shift(); sync() }}>知道了</Btn>
      </div>
    </div>
  )
}

function cashKind(s) {
  if (s.cash < 0) return 'danger'
  if (s.cash < (s.lastFixedCost || 1) * 7) return 'warn'
  return 'ok'
}
