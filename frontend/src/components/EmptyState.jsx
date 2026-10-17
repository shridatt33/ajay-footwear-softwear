import React from 'react'
import { PlusIcon } from './Icons'

export default function EmptyState({
  icon,
  title = 'No Data Available',
  description = 'There are no items recorded in this section yet.',
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`erp-empty-state ${className}`}>
      <div className="empty-icon-wrapper">
        {icon ? (
          icon
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        )}
      </div>
      <h4 className="empty-title">{title}</h4>
      <p className="empty-description">{description}</p>
      {actionLabel && onAction && (
        <button type="button" className="btn btn-primary btn-sm" onClick={onAction}>
          <PlusIcon size={14} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  )
}
