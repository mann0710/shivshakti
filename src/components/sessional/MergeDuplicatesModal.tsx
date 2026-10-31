import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { MergeGroup } from '../../lib/mergePlan';
import { useMergeDuplicateItems } from '../../hooks/useSeasonalItems';
import { rateLabel } from '../../lib/units';
import { inr } from '../../lib/money';
import { btnPrimary, btnGhost, NAVY } from '../ui/styles';

interface Props { plans: MergeGroup[]; onClose: () => void }

// Preview and run the clean-up of one-row-per-pack items; exact old prices are kept as manual pack prices.
const MergeDuplicatesModal: React.FC<Props> = ({ plans, onClose }) => {
  const merge = useMergeDuplicateItems();
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState('');
  const chosen = plans.filter(p => !skip.has(p.key));
  const rows = chosen.reduce((s, p) => s + p.removeIds.length, 0);

  const toggle = (key: string) => setSkip(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const run = async () => {
    try {
      const n = await merge.mutateAsync({ plans: chosen, onProgress: setProgress });
      toast.success(`Cleaned up ${n} item${n === 1 ? '' : 's'}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Merge failed');
      setProgress('');
    }
  };

  return (
    <Modal title="Merge duplicate pack rows" onClose={merge.isPending ? () => {} : onClose} width={640}
      footer={<>
        {progress && <span style={{ fontSize: 12, color: '#6B6B66', marginRight: 'auto' }}>{progress}…</span>}
        <button style={btnGhost} onClick={onClose} disabled={merge.isPending}>Cancel</button>
        <button style={btnPrimary} onClick={run} disabled={!chosen.length || merge.isPending}>
          {merge.isPending ? 'Merging…' : `Merge ${chosen.length} item${chosen.length === 1 ? '' : 's'}${rows ? ` (remove ${rows} rows)` : ''}`}
        </button>
      </>}>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>
        These items are saved as one row per pack. Each becomes <b>one item with a per-kg price</b>; every pack keeps its exact old price.
        Old bills are re-linked to the merged item so reports add up. Untick anything you want to leave as it is.
      </div>
      {plans.map(p => (
        <label key={p.key} style={{ display: 'flex', gap: 10, padding: '10px 0', borderTop: '0.5px solid #F0F0EC', cursor: 'pointer', opacity: skip.has(p.key) ? 0.5 : 1 }}>
          <input type="checkbox" checked={!skip.has(p.key)} onChange={() => toggle(p.key)} style={{ marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              {p.update.name} <span style={{ fontWeight: 500, color: NAVY }}>· {rateLabel(p.update.rate, p.update.unit)}</span>
            </div>
            <div style={{ fontSize: 12, color: '#6B6B66', margin: '2px 0 6px' }}>From: {p.sourceNames.join(', ')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {p.preview.map(r => (
                <span key={r.size} style={{ fontSize: 12, background: '#F3F2EE', color: NAVY, borderRadius: 10, padding: '2px 8px' }}>
                  {r.label} {inr(r.newPrice)}{r.oldPrice === null ? ' (new)' : ''}
                </span>
              ))}
            </div>
            {p.conflicts.map(c => <div key={c} style={{ fontSize: 12, color: '#B26A00', marginTop: 4 }}>⚠ {c}</div>)}
          </div>
        </label>
      ))}
    </Modal>
  );
};

export default MergeDuplicatesModal;
