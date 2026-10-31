import React from 'react';
import { TEXT_SIZES, saveTextSize, stepTextSize, textSizeLabel } from '../../lib/textSize';
import { Panel, Row } from './SettingsUi';

// Settings kept on this computer or phone only: text size for now.
const DeviceGroup: React.FC<{ size: number; onSize: (v: number) => void }> = ({ size, onSize }) => {
  const set = (v: number) => onSize(saveTextSize(v));
  const min = size <= TEXT_SIZES[0];
  const max = size >= TEXT_SIZES[TEXT_SIZES.length - 1];

  return (
    <Panel id="device" title="This device" sub="Saved on this computer or phone only; other devices keep their own.">
      <div className="st-rows">
        <Row label="Text size" note="Makes everything in the app smaller or bigger, like Ctrl − and Ctrl +.">
          <span className="st-size" role="group" aria-label="Text size">
            <button type="button" className="ui-btn" aria-label="Smaller text" disabled={min} onClick={() => set(stepTextSize(size, -1))}>A−</button>
            <b aria-live="polite">{textSizeLabel(size)}</b>
            <button type="button" className="ui-btn" aria-label="Bigger text" disabled={max} onClick={() => set(stepTextSize(size, 1))}>A+</button>
            {size !== 1 && <button type="button" className="ui-btn" onClick={() => set(1)}>Reset</button>}
          </span>
        </Row>
      </div>
    </Panel>
  );
};

export default DeviceGroup;
