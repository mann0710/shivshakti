import React from 'react';

const colors: Record<string, { bg: string; color: string }> = {
  inquiry:   { bg: '#E6F1FB', color: '#185FA5' },
  followup:  { bg: '#EEEDFE', color: '#534AB7' },
  pending:   { bg: '#FAEEDA', color: '#854F0B' },
  confirmed: { bg: '#EAF3DE', color: '#3B6D11' },
  completed: { bg: '#E6F1FB', color: '#0F6E56' },
  cancelled: { bg: '#FCEBEB', color: '#A32D2D' },
  draft:     { bg: '#F1EFE8', color: '#5F5E5A' },
  sent:      { bg: '#FAEEDA', color: '#854F0B' },
  paid:      { bg: '#EAF3DE', color: '#3B6D11' },
  overdue:   { bg: '#FCEBEB', color: '#A32D2D' },
  accepted:  { bg: '#EAF3DE', color: '#3B6D11' },
  rejected:  { bg: '#FCEBEB', color: '#A32D2D' },
};

// Invoice statuses are stored as draft/sent/paid; show what they mean.
const LABELS: Record<string, string> = { draft: 'Unpaid', sent: 'Part paid', followup: 'Follow-up' };
export const statusLabel = (status: string) => LABELS[status] ?? status;

// `label` overrides the invoice wording (quotes pass their own: Sent, Not chosen…).
const StatusPill: React.FC<{ status: string; label?: string }> = ({ status, label }) => {
  const style = colors[status] || { bg: '#F1EFE8', color: '#5F5E5A' };
  return (
    <span style={{
      fontSize: 10, padding: '2px 9px', borderRadius: 20,
      fontWeight: 600, whiteSpace: 'nowrap',
      background: style.bg, color: style.color,
      textTransform: 'capitalize'
    }}>
      {label ?? statusLabel(status)}
    </span>
  );
};

export default StatusPill;
