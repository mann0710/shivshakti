import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { usePackSchema, PACK_MIGRATION_FILE } from '../../hooks/useSchemaStatus';

// Tells the owner the one-time database update is still pending; the app keeps working meanwhile.
const MigrationBanner: React.FC = () => {
  const { data } = usePackSchema();
  const [hidden, setHidden] = useState(false);
  if (data !== 'legacy' || hidden) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(PACK_MIGRATION_FILE); toast.success('File path copied'); }
    catch { toast.error('Copy failed'); }
  };

  return (
    <div role="status" style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#6D4C00', display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 16 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 220, lineHeight: 1.5 }}>
        <b>One-time database update needed.</b> Run <code onClick={copy} style={{ cursor: 'copy', background: '#FFF3C4', padding: '0 4px', borderRadius: 4 }}>{PACK_MIGRATION_FILE}</code> in
        Supabase → SQL Editor to unlock custom pack sizes, manual pack prices, categories, piece pricing and bill numbers.
        Billing works meanwhile with 250 g / 500 g / 750 g / 1 kg packs.
      </div>
      <button onClick={() => setHidden(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#6D4C00' }} aria-label="Hide">×</button>
    </div>
  );
};

export default MigrationBanner;
