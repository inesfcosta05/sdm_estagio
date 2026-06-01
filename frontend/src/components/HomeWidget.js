import React, { useState } from 'react';
import './HomeWidget.css';

export default function HomeWidget({ title, children, onMoveUp, onMoveDown, canMoveUp, canMoveDown }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="home-widget">
      <div className="home-widget-header">
        <span className="home-widget-title">{title}</span>
        <div className="home-widget-actions">
          <button
            className="home-widget-btn"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            title="Mover para cima"
          >
            ∧
          </button>
          <button
            className="home-widget-btn"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            title="Mover para baixo"
          >
            ∨
          </button>
          <button
            className="home-widget-btn home-widget-collapse"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir' : 'Recolher'}
          >
            {collapsed ? '▾' : '▴'}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div className="home-widget-body">
          {children}
        </div>
      )}
    </div>
  );
}
