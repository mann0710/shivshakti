import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../ui/Modal';
import type { Quotation } from '../../hooks/useQuotations';
import { quotationMessage, shareQuotation, maskPhone, quotePdf } from '../../lib/quotationShare';
import { optionTitle } from '../../lib/quoteOptions';
import { downloadDoc } from '../../lib/docs/output';
import { PickCard, useMedia, PHONE, firstName } from './bits';

interface Props {
  quote: Quotation;
  options: Quotation[];
  all: boolean;
  withPrices: boolean;
  onClose: () => void;
  onSent: (sent: Quotation[]) => Promise<void> | void;
}

// What to send, the message and "Mark as sent"; computers open WhatsApp, phones the share sheet.
const SendDialog: React.FC<Props> = ({ quote, options, all: startAll, withPrices, onClose, onSent }) => {
  const phone = useMedia(PHONE);
  const many = options.length > 1;
  const [all, setAll] = useState(many && startAll);
  const list = all ? options : [quote];
  const auto = (everything: boolean) => quotationMessage(quote, everything ? options : undefined);
  const [message, setMessage] = useState(() => auto(many && startAll));
  const [edited, setEdited] = useState(false);
  const drafts = list.some(o => o.status === 'draft');
  const [mark, setMark] = useState(true);
  const [busy, setBusy] = useState(false);
  const number = quote.customer?.phone ? maskPhone(quote.customer.phone) : '';
  const who = firstName(quote);
  const opts = all ? options : undefined;

  const choose = (everything: boolean) => { setAll(everything); if (!edited) setMessage(auto(everything)); };
  const send = async () => {
    setBusy(true);
    const res = await shareQuotation(quote, withPrices, opts, message, phone);
    if ((res === 'shared' || res === 'whatsapp') && mark && drafts) await onSent(list);
    setBusy(false);
    if (res === 'shared' || res === 'whatsapp') onClose();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); toast.success('Message copied'); } catch { toast.error('Copy did not work — select the text instead'); }
  };

  const footer = phone ? (
    <div className="q-foot-col">
      <button type="button" className="ui-btn primary" disabled={busy} onClick={send}>{busy ? 'Preparing PDF…' : 'Share PDF to WhatsApp'}</button>
      <button type="button" className="ui-btn" onClick={() => downloadDoc(quotePdf(quote, withPrices, opts))}>Download PDF</button>
    </div>
  ) : (
    <>
      <button type="button" className="q-link" onClick={() => downloadDoc(quotePdf(quote, withPrices, opts))}>Download PDF</button>
      <button type="button" className="ui-btn" onClick={copy}>Copy text</button>
      <button type="button" className="ui-btn primary" disabled={busy} onClick={send}>{busy ? 'Preparing PDF…' : 'Open WhatsApp'}</button>
    </>
  );

  return (
    <Modal title={phone ? `Send ${quote.quotation_number}` : `Send ${quote.quotation_number} to ${who}`} onClose={onClose} busy={busy} width={560} footer={footer}>
      <p className="q-dlg-sub">{phone ? `To ${who}${number ? ` · ${number}` : ''}` : number ? `Saved number ${number}.` : 'No saved number — pick the chat in WhatsApp.'}</p>
      {!phone && <div className="q-info">On a computer, WhatsApp opens with this message and the PDF is saved to Downloads: drag it into the chat. On a phone the PDF goes straight in.</div>}
      {!phone && <div className="q-h">What to send</div>}
      <div className="q-cards" role="radiogroup" aria-label="What to send">
        <PickCard on={!all} title={phone ? 'Quotation PDF' : 'The quotation PDF'} line={optionTitle(quote) || quote.quotation_number} onClick={() => choose(false)} />
        <PickCard on={all} disabled={!many} title={phone ? 'All options' : 'All options in one PDF'}
          line={many ? `${options.map(o => o.option_label).join(' + ')} · one PDF` : 'Only when there is more than one option'} onClick={() => choose(true)} />
      </div>
      {phone ? <p className="q-hint">Share opens the phone share sheet with WhatsApp first.</p> : (
        <label className="q-field full">Message
          <textarea rows={4} value={message} onChange={e => { setMessage(e.target.value); setEdited(true); }} />
        </label>
      )}
      {drafts && (
        <label className="q-check"><input type="checkbox" checked={mark} onChange={e => setMark(e.target.checked)} />Mark the quote as sent</label>
      )}
    </Modal>
  );
};

export default SendDialog;
