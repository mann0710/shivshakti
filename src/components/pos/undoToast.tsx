import React from 'react';
import toast from 'react-hot-toast';

// A toast with an Undo button, for actions that skip the "are you sure?" step.
export const undoToast = (message: string, onUndo: () => void) =>
  toast(t => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {message}
      <button type="button" className="ui-btn" onClick={() => { onUndo(); toast.dismiss(t.id); }}>Undo</button>
    </span>
  ), { duration: 7000 });
