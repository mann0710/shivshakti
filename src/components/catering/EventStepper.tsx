import React from 'react';
import { STAGES, STAGE_LABELS, NEXT_STEP, Stage } from '../../lib/eventStage';
import { ORANGE } from './CustomerUi';

// Inquiry → Quoted → Confirmed → Invoiced → Paid, with the next thing to do underneath.
const EventStepper: React.FC<{ stage: Stage; next?: string }> = ({ stage, next }) => {
  if (stage === 'cancelled') {
    return <div style={{ background: '#FCEBEB', color: '#A32D2D', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 12 }}>{NEXT_STEP.cancelled}</div>;
  }
  const at = STAGES.indexOf(stage);
  return (
    <div style={{ marginBottom: 14 }}>
      <ol aria-label="Progress" style={{ display: 'flex', listStyle: 'none', margin: 0, padding: 0 }}>
        {STAGES.map((s, i) => {
          const done = i <= at;
          return (
            <li key={s} aria-current={i === at ? 'step' : undefined} style={{ flex: 1, textAlign: 'center', position: 'relative', fontSize: 11, color: done ? '#1A1A18' : '#AAAAAA', fontWeight: i === at ? 700 : 400 }}>
              {i > 0 && <span style={{ position: 'absolute', top: 9, right: '50%', width: '100%', height: 2, background: i <= at ? ORANGE : '#E5E5E0' }} />}
              <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: done ? ORANGE : '#fff', border: `2px solid ${done ? ORANGE : '#D0D0CC'}`, color: '#fff', fontSize: 11 }}>
                {i < at ? '✓' : ''}
              </span>
              <div style={{ marginTop: 4 }}>{STAGE_LABELS[s]}</div>
            </li>
          );
        })}
      </ol>
      <div style={{ marginTop: 10, fontSize: 12, color: '#854F0B', background: '#FFF8EC', borderRadius: 8, padding: '7px 10px' }}>
        Next: {next ?? NEXT_STEP[stage]}
      </div>
    </div>
  );
};

export default EventStepper;
