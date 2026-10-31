import React, { useState } from 'react';
import { usePackDefaults } from '../../hooks/useSeasonalItems';
import { useSeasonalOccasions } from '../../hooks/useSeasonalOccasions';
import { useIsLegacySchema } from '../../hooks/useSchemaStatus';
import { formatSize } from '../../lib/units';
import PackDefaultsModal from '../sessional/PackDefaultsModal';
import { LinkBtn, Panel, Row, Soon } from './SettingsUi';

// Active occasions that still need their dates, so bills can tag themselves.
export const useUndatedOccasions = () => {
  const { data: occasions = [] } = useSeasonalOccasions(true);
  return occasions.filter(o => !o.start_date || !o.end_date).map(o => o.name);
};

// Box sizes for the counter and a pointer to the season dates on Occasions.
const SweetsGroup: React.FC = () => {
  const packs = usePackDefaults();
  const legacy = useIsLegacySchema();
  const undated = useUndatedOccasions();
  const [editing, setEditing] = useState(false);

  return (
    <Panel id="sweets" title="Sweets" sub="Counter and seasons.">
      <div className="st-rows">
        <Row label="Box sizes" note={`Litre: ${packs.ltr.map(s => formatSize(s, 'ltr')).join(', ')} · Piece: ${packs.pc.map(s => formatSize(s, 'pc')).join(', ')}`}>
          <span className="st-value">{packs.kg.map(s => formatSize(s, 'kg')).join(' · ')}</span>
          <LinkBtn onClick={() => setEditing(true)}>Edit</LinkBtn>
        </Row>
        <Row label="Seasons and dates" note={undated.length ? `${undated.join(', ')} ${undated.length === 1 ? 'has' : 'have'} no dates yet` : 'Every season has its dates'} warn={undated.length > 0}>
          <LinkBtn href="#seasonal_occasions" warn={undated.length > 0}>Open Occasions</LinkBtn>
        </Row>
        <Soon label="Print the bill after each sale" />
        <Soon label="Quick keys on the counter" note="Fixed order" />
        <Soon label="Day close" note="Who can close and reopen a day" />
      </div>
      {editing && <PackDefaultsModal defaults={packs} legacy={legacy} onClose={() => setEditing(false)} />}
    </Panel>
  );
};

export default SweetsGroup;
