import React, { useState } from 'react';
import Modal from '../ui/Modal';
import { Account } from '../../lib/credit/accounts';
import { Lang } from '../../lib/credit/types';
import { inr } from '../../lib/money';
import { Dlg, Field, Pick } from './Fields';

type Text = (a: Account, lang: Lang) => string;
type Send = (a: Account, lang: Lang, text: string) => boolean;

// One reminder: pick the language, edit the text, send on WhatsApp.
export const RemindDialog: React.FC<{ a: Account; lang: Lang; textFor: Text; onSend: Send; onStatement: () => void; onClose: () => void }> = ({ a, lang: start, textFor, onSend, onStatement, onClose }) => {
  const [lang, setLang] = useState<Lang>(start);
  const [text, setText] = useState(() => textFor(a, start));
  const [pdf, setPdf] = useState(false);
  const pick = (l: Lang) => { setLang(l); setText(textFor(a, l)); };
  const send = () => { if (pdf) onStatement(); onSend(a, lang, text); onClose(); };
  return (
    <Dlg title={`Remind ${a.name}`} onClose={onClose} primary="Send on WhatsApp" onSave={send}>
      <span className="note">{inr(a.owed)} on {a.open.length} {a.open.length === 1 ? 'bill' : 'bills'}</span>
      <Pick label="Language" value={lang} options={[['en', 'English'], ['hi', 'हिंदी']]} onChange={pick} />
      <Field label="Message"><textarea rows={7} value={text} onChange={e => setText(e.target.value)} /></Field>
      <label className="check"><input type="checkbox" checked={pdf} onChange={e => setPdf(e.target.checked)} />Also save the statement PDF to attach</label>
      <span className="note">WhatsApp can't attach files from a link: tap 📎 → Document and pick the saved PDF. The reminder is logged in the account.</span>
    </Dlg>
  );
};

type State = 'sent' | 'skipped' | 'next' | '';

// Everyone due today, one WhatsApp at a time: send, come back, next.
export const RemindRound: React.FC<{ list: Account[]; textFor: Text; langOf: (a: Account) => Lang; onSend: Send; onClose: () => void }> = ({ list, textFor, langOf, onSend, onClose }) => {
  const [done, setDone] = useState<Record<string, State>>({});
  const at = list.findIndex(a => !done[a.phone]);
  const cur = at >= 0 ? list[at] : undefined;
  const mark = (s: State) => cur && setDone(d => ({ ...d, [cur.phone]: s }));
  const send = () => { if (!cur) return; onSend(cur, langOf(cur), textFor(cur, langOf(cur))); mark('sent'); };
  const label = (a: Account) => (done[a.phone] === 'sent' ? 'Sent ✓' : done[a.phone] === 'skipped' ? 'Skipped' : a === cur ? 'Next' : '');
  return (
    <Modal title={`Remind ${list.length} ${list.length === 1 ? 'person' : 'people'}`} onClose={onClose} width={560} footer={cur ? (
      <>
        <button type="button" className="ui-btn" onClick={onClose}>Stop</button><span style={{ flex: 1 }} />
        <button type="button" className="ui-btn" onClick={() => mark('skipped')}>Skip</button>
        <button type="button" className="ui-btn primary" onClick={send}>WhatsApp {cur.name.split(' ')[0]} · {at + 1} of {list.length}</button>
      </>
    ) : <button type="button" className="ui-btn primary" onClick={onClose}>Done</button>}>
      <div className="cr-dlg">
        <span className="note">WhatsApp opens for each one. Send it, come back here and the next one is ready.</span>
        <div className="alloc">
          {list.map(a => (
            <div key={a.phone}><span><b>{a.name}</b> · {inr(a.owed)} · {langOf(a) === 'hi' ? 'Hindi' : 'English'}</span>
              <b className={done[a.phone] === 'sent' ? 'cr-green' : undefined}>{label(a)}</b></div>
          ))}
        </div>
        {cur && <div className="sum"><span style={{ fontSize: 12, fontWeight: 600, color: '#5A5A55' }}>MESSAGE TO {cur.name.toUpperCase()}</span><span className="cr-msg">{textFor(cur, langOf(cur))}</span></div>}
        {!cur && <span className="note">All done.</span>}
      </div>
    </Modal>
  );
};
