import React from 'react'

export default function Card({
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = '',
  padding = true,
}) {
  return (
    <div className={`erp-card ${className}`}>
      {(title || subtitle || action) && (
        <div className="erp-card-header">
          <div className="erp-card-header-titles">
            {title && <h2 className="erp-card-title">{title}</h2>}
            {subtitle && <span className="erp-card-subtitle">{subtitle}</span>}
          </div>
          {action && <div className="erp-card-header-action">{action}</div>}
        </div>
      )}
      <div className={`erp-card-body ${bodyClassName}`} style={padding ? {} : { padding: 0 }}>
        {children}
      </div>
    </div>
  )
}
