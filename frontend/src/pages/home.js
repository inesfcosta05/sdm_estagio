import React, { useState } from 'react';
import HomeWidget from '../components/HomeWidget';

const INITIAL_WIDGETS = [
  {
    id: 'bem-vindo',
    title: 'Bem-vindo',
    content: (
      <>
        Caso necessite de ajuda, contacte-nos em{' '}
        <a href="mailto:web@celeuma.pt">web@celeuma.pt</a>.
      </>
    ),
  },
];

export default function Home() {
  const [widgets, setWidgets] = useState(INITIAL_WIDGETS);

  const moveWidget = (index, direction) => {
    setWidgets(prev => {
      const next = [...prev];
      const swapIndex = index + direction;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <h2>Home</h2>
      {widgets.map((widget, i) => (
        <HomeWidget
          key={widget.id}
          title={widget.title}
          canMoveUp={i > 0}
          canMoveDown={i < widgets.length - 1}
          onMoveUp={() => moveWidget(i, -1)}
          onMoveDown={() => moveWidget(i, 1)}
        >
          {widget.content}
        </HomeWidget>
      ))}
    </div>
  );
}
