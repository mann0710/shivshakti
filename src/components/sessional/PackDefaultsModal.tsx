import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import SizeChips from './SizeChips';
import { PackDefaults, PriceUnit, UNIT_NAMES, DEFAULT_PACKS } from '../../lib/units';
import { useSavePackDefaults } from '../../hooks/useSeasonalItems';
import { btnPrimary, btnGhost, btnSm } from '../ui/styles';

interface Props { defaults: PackDefaults; legacy: boolean; onClose: () => void }

// Shop-wide pack sizes used by every item that doesn't set its own.
const PackDefaultsModal: React.FC<Props> = ({ defaults, legacy, onClose }) => {
  const save = useSavePackDefaults();
  const [sizes, setSizes] = useState<PackDefaults>(defaults);

  const submit = async () => {
    if ((Object.keys(sizes) as PriceUnit[]).some(u => !sizes[u].length)) { toast.error('Each unit needs at least one size'); return; }
    try { await save.mutateAsync(sizes); toast.success('Pack sizes saved'); onClose(); }
    catch (e: any) { toast.error(e.message || 'Could not save'); }
  };

  return (
    <Modal title="Shop pack sizes" onClose={onClose} width={520}
      footer={<>
        <button style={{ ...btnSm, marginRight: 'auto' }} onClick={() => setSizes(DEFAULT_PACKS)} disabled={legacy}>Reset to standard</button>
        <button style={btnGhost} onClick={onClose}>Cancel</button>
        <button style={btnPrimary} onClick={submit} disabled={legacy || save.isPending}>Save sizes</button>
      </>}>
      <div style={{ fontSize: 12, color: '#555', marginBottom: 14, lineHeight: 1.5 }}>
        Every item shows these pack buttons in billing, priced from its per-kg rate. Add your own sizes such as 400 g or 2 kg.
        {legacy && <div style={{ color: '#B26A00', marginTop: 6 }}>Saving custom sizes needs the one-time database update.</div>}
      </div>
      {(Object.keys(UNIT_NAMES) as PriceUnit[]).map(u => (
        <div key={u} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{UNIT_NAMES[u]}</div>
          <SizeChips unit={u} sizes={sizes[u]} disabled={legacy} onChange={s => setSizes(prev => ({ ...prev, [u]: s }))} />
        </div>
      ))}
    </Modal>
  );
};

export default PackDefaultsModal;
