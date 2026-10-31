import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { MoneyData, fyStart } from '../../lib/moneyView';
import { Spend } from '../../lib/spends';
import { CA_PARTS, CaPart, caReport } from '../../lib/caExport';
import { Range, presetRange } from '../../lib/reports/model';
import { downloadReportXlsx } from '../../lib/reports/export';
import { docContext } from '../../lib/docs/context';
import { todayIST } from '../../lib/ist';
import { DialogFoot, Picks } from './MoneyUi';

type CaPeriod = 'month' | 'lastMonth' | 'year' | 'custom';
const PERIODS: [CaPeriod, string][] = [['month', 'This month'], ['lastMonth', 'Last month'], ['year', 'This year (Apr–Mar)'], ['custom', 'Pick dates']];

// DlgExtras "Download for your CA": one file (opens in Excel) with a part for each chosen section.
const CaExportModal: React.FC<{ data: MoneyData; spends: Spend[] | null; onClose: () => void }> = ({ data, spends, onClose }) => {
  const today = todayIST();
  const [period, setPeriod] = useState<CaPeriod>('year');
  const [custom, setCustom] = useState<Range>({ from: `${today.slice(0, 7)}-01`, to: today });
  const [parts, setParts] = useState<CaPart[]>(CA_PARTS.map(p => p[0]).filter(p => p !== 'spends' || spends !== null));
  const range: Range = period === 'year' ? { from: fyStart(today), to: today } : period === 'custom' ? custom : presetRange(period, today);
  const bad = period === 'custom' && !(custom.from && custom.to && custom.from <= custom.to);
  const toggle = (p: CaPart) => setParts(list => (list.includes(p) ? list.filter(x => x !== p) : CA_PARTS.map(x => x[0]).filter(x => x === p || list.includes(x))));
  const download = () => {
    // Sweets GST counts only for a GST-registered shop, as on the counter bill.
    const ctx = docContext();
    downloadReportXlsx(caReport(data, spends ?? [], range, today, parts, ctx.gstNumber ? ctx.settings.sweets_gst_rate : 0), range);
    toast.success('Saved in Downloads: one Excel file, a sheet for each part.');
    onClose();
  };
  return (
    <Modal title="Download for your CA" onClose={onClose} width={440}
      footer={<DialogFoot onCancel={onClose} onOk={download} ok="Download Excel" disabled={!parts.length || bad} />}>
      <div className="mx-dlg">
        <p className="mx-dlg-sub">One Excel file with a sheet for each part. Cancelled bookings and bills are left out.</p>
        <Picks label="Period" options={PERIODS} value={period} onPick={setPeriod} />
        {period === 'custom' && (
          <div className="mx-grid2">
            <label className="mx-field">From<input type="date" value={custom.from} max={today} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} /></label>
            <label className={`mx-field${bad ? ' bad' : ''}`}>To<input type="date" value={custom.to} max={today} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
              {bad && <span className="mx-err">Pick an end date after the start</span>}</label>
          </div>
        )}
        <div role="group" aria-label="What to include">
          {CA_PARTS.map(([id, label]) => (
            <label key={id} className="mx-check">
              <input type="checkbox" checked={parts.includes(id)} disabled={id === 'spends' && spends === null} onChange={() => toggle(id)} />
              {label}{id === 'spends' && spends === null ? ' (needs the spends update)' : ''}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default CaExportModal;
