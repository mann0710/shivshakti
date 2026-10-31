import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { CatNode } from '../../lib/menuCatalog';
import SubPicker from './SubPicker';
import '../../styles/settings.css';

export interface NameResult { name: string; subId: string; price: number | null }

interface Props {
  title: string;
  sub?: string;
  label?: string;
  name?: string;
  hideName?: boolean;
  subId?: string;
  tree?: CatNode[];
  price?: number | null;
  withPrice?: boolean;
  primary?: string;
  onClose: () => void;
  onSave: (r: NameResult) => Promise<unknown>;
}

// Small form for Menu Builder: a name, and when asked a subcategory and a per-plate price.
const NameDialog: React.FC<Props> = ({ title, sub, label = 'Name', name = '', hideName, subId = '', tree, price, withPrice, primary = 'Save', onClose, onSave }) => {
  const [text, setText] = useState(name);
  const [where, setWhere] = useState(subId);
  const [cost, setCost] = useState(price ? String(price) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty = text !== name || where !== subId || cost !== (price ? String(price) : '');

  const save = async () => {
    if (!hideName && !text.trim()) { setError('Type a name'); return; }
    if (tree && !where) { setError('Pick where it goes'); return; }
    setBusy(true);
    try { await onSave({ name: text.trim(), subId: where, price: parseFloat(cost) > 0 ? parseFloat(cost) : null }); onClose(); }
    catch (e: any) { setError(e?.message || 'Could not save'); setBusy(false); }
  };

  return (
    <Modal title={title} onClose={onClose} width={440} busy={busy} dirty={dirty}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Cancel</button>
        <button type="submit" form="name-dialog" className="ui-btn primary" disabled={busy}>{busy ? 'Saving…' : primary}</button>
      </>}>
      {sub && <p className="st-sub">{sub}</p>}
      <form id="name-dialog" className="st-form" onSubmit={e => { e.preventDefault(); save(); }} noValidate>
        {!hideName && (
          <label className="st-field full"><span>{label}</span>
            <input autoFocus value={text} className={error && !text.trim() ? 'bad' : ''} onChange={e => { setText(e.target.value); setError(''); }} />
          </label>
        )}
        {tree && (
          <div className={`st-field${withPrice ? '' : ' full'}`}><span>Subcategory</span>
            <SubPicker tree={tree} value={where} autoFocus={hideName} bad={!!error && !where} onChange={id => { setWhere(id); setError(''); }} />
          </div>
        )}
        {withPrice && (
          <label className="st-field"><span>Price per plate</span>
            <input inputMode="decimal" placeholder="₹ optional" value={cost} onChange={e => setCost(e.target.value.replace(/[^\d.]/g, ''))} />
          </label>
        )}
        {error && <small className="st-field full" style={{ color: '#A32D2D', fontWeight: 400 }}>{error}</small>}
      </form>
    </Modal>
  );
};

export default NameDialog;
