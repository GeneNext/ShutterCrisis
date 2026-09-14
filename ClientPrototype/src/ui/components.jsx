import React from 'react'
import { fmt } from '../game/engine.js'

export function Bar({ v, max = 100, color, label }) {
  const pct = Math.max(0, Math.min(100, (v / max) * 100))
  return (
    <div className="bar">
      <div className={'bar-fill ' + (color || '')} style={{ width: pct + '%' }} />
      {label != null && <span className="bar-label">{label}</span>}
    </div>
  )
}

export function Chip({ kind, children, title }) {
  return <span className={'chip ' + (kind || '')} title={title}>{children}</span>
}

export function Section({ title, right, children, className }) {
  return (
    <div className={'section ' + (className || '')}>
      <div className="section-head">
        <h3>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  )
}

export function Btn({ onClick, disabled, kind, children, title }) {
  return (
    <button className={'btn ' + (kind || '')} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  )
}

// 现金流可视化：金额飘字（绿入红出）
export function useToasts(game) {
  const list = game.toasts.slice(-8)
  return (
    <div className="toast-wrap">
      {list.map((t) => (
        <div key={t.id} className={'toast ' + t.kind}>
          <span>{t.text}</span>
          {t.money !== 0 && (
            <span className={t.money > 0 ? 'money-plus' : 'money-minus'}>
              {t.money > 0 ? '+' : '-'}¥{fmt(Math.abs(t.money))}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

export function TalentChip({ talent }) {
  return talent === 'growth'
    ? <Chip kind="growth" title="技能可练到 5 级、可修多门专精，值得长期投资">成长型</Chip>
    : <Chip kind="normal" title="无成长空间：去留按待遇与盈利管理，走了就近补招">普通</Chip>
}

export function StageChip({ stage }) {
  const map = { rookie: '学徒', backbone: '骨干', master: '大师', partner: '合伙人' }
  if (stage === 'rookie') return null
  return <Chip kind="stage">{map[stage]}</Chip>
}
