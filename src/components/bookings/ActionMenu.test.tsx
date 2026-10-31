import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ActionMenu, { MenuGroups } from './ActionMenu';

const picked: string[] = [];
const groups: MenuGroups = [
  [{ label: 'Open event page', strong: true, onSelect: () => picked.push('open') }, { label: 'Edit details', onSelect: () => picked.push('edit') }],
  [{ label: 'Change status', hint: 'Quoted ›', submenu: [[
    { label: 'Inquiry', checked: false, onSelect: () => picked.push('inquiry') },
    { label: 'Quoted', checked: true, onSelect: () => picked.push('quoted') },
  ]] }],
  [{ label: 'Delete booking…', danger: true, onSelect: () => picked.push('delete') }],
];
const item = (name: RegExp) => screen.getByRole('menuitem', { name });

describe('booking ⋯ menu', () => {
  it('moves with arrow keys, opens the status submenu and keeps Esc to itself', () => {
    const behind = jest.fn();
    window.addEventListener('keydown', behind);
    render(<ActionMenu label="Actions for Kavit" groups={groups} trigger="⋯" triggerClass="am-trigger" triggerLabel="More actions for Kavit" />);
    fireEvent.click(screen.getByRole('button', { name: 'More actions for Kavit' }));
    expect(screen.getAllByRole('menuitem').map(e => e.textContent)).toEqual(['Open event page', 'Edit details', 'Change statusQuoted ›', 'Delete booking…']);
    expect(item(/Open event page/)).toHaveFocus();

    fireEvent.keyDown(item(/Open event page/), { key: 'ArrowDown' });
    fireEvent.keyDown(item(/Edit details/), { key: 'ArrowDown' });
    expect(item(/Change status/)).toHaveFocus();
    fireEvent.keyDown(item(/Change status/), { key: 'ArrowRight' });
    expect(screen.getByRole('menu', { name: 'Change status' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: /Quoted/ })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('menuitemradio', { name: /Quoted/ }), { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: 'Change status' })).not.toBeInTheDocument();
    expect(item(/Change status/)).toHaveFocus();
    fireEvent.keyDown(item(/Change status/), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions for Kavit' })).toHaveFocus();
    expect(behind).not.toHaveBeenCalled();
    window.removeEventListener('keydown', behind);
  });

  it('runs the picked action and closes', () => {
    render(<ActionMenu label="Actions" groups={groups} trigger="⋯ More" triggerClass="am-text" />);
    fireEvent.click(screen.getByRole('button', { name: '⋯ More' }));
    fireEvent.click(item(/Delete booking/));
    expect(picked).toEqual(['delete']);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
