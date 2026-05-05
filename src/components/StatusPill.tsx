import React from 'react';

const colors: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#FAEEDA', color: '#854F0B' },
  confirmed: { bg: '#EAF3DE', color: '#3B6D11' },
  completed: { bg: '#E6F1FB', color: '#185FA5' },
  cancelled: { bg: '#FCEBEB', color: '#A32D2D' },
  draft:     { bg: '#F1EFE8', color: '#5F5E5A' },
  sent:      { bg: '#FAEEDA', color: '#854F0B' },
  paid:      { bg: '#EAF3DE', color: '#3B6D11' },
  overdue:   { bg: '#FCEBEB', color: '#A32D2D' },
};

const StatusPill: React.FC<{ status: string }> = ({ status }) => {
  const style = colors[status] || { bg: '#F1EFE8', color: '#5F5E5A' };
  return (
    <span style={{
      fontSize: 10, padding: '2px 9px', borderRadius: 20,
      fontWeight: 600, whiteSpace: 'nowrap',
      background: style.bg, color: style.color,
      textTransform: 'capitalize'
    }}>
      {status}
    </span>
  );
};

export default StatusPill;
