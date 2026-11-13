import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import { Picks } from '../money/MoneyUi';
import { useStoredState } from '../../hooks/useStoredState';
import { bookingReceipt, ReceiptInfo, ReceiptLang } from '../../lib/bookingReceipt';
import { openWhatsApp } from '../../lib/receipt';

interface Props { phone: string; info: ReceiptInfo; onClose: () => void }

const LANGS: [ReceiptLang, string][] = [['en', 'English'], ['hi', 'हिंदी']];

// "Saved. Send a receipt?": the text in English or Hindi, editable, sent from WhatsApp.
const ReceiptDialog: React.FC<Props> = ({ phone, info, onClose }) => {
  const [pref, setPref] = useStoredState<{ lang: ReceiptLang }>('shivshakti.receiptLang', () => ({ lang: 'en' }));
  const [text, setText] = useState(() => bookingReceipt(pref.lang, info));
  const pick = (lang: ReceiptLang) => { setPref({ lang }); setText(bookingReceipt(lang, info)); };
  const send = () => {
    if (!openWhatsApp(phone, text)) { toast.error('WhatsApp did not open. Allow pop-ups and try again.'); return; }
    onClose();
  };
  return (
    <Modal title={`Saved. Send ${info.name.split(/\s+/)[0]} a receipt?`} onClose={onClose} width={440}
      footer={<>
        <button type="button" className="ui-btn" onClick={onClose}>Skip</button>
        <button type="button" className="ui-btn primary" onClick={send} disabled={!text.trim()}>Open WhatsApp</button>
      </>}>
      <div className="mx-dlg">
        <Picks label="Language" options={LANGS} value={pref.lang} onPick={pick} />
        <label className="mx-field">Message
          <textarea rows={6} value={text} onChange={e => setText(e.target.value)} />
          <span className="mx-hint">You can change the text. Nothing is sent until you press send in WhatsApp.</span>
        </label>
      </div>
    </Modal>
  );
};

export default ReceiptDialog;
