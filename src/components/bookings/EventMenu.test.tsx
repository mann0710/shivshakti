import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventMenu } from './EventSections';
import kavit from './kavitMenu.fixture.json';

// A real accepted menu: one decided "same price" sweet, a served-with dish, Including last.
test('the event page shows the booked menu with the customer pick and a Kitchen PDF button', () => {
  const onPdf = jest.fn();
  render(<EventMenu quote={kavit as any} onPdf={onPdf} />);
  expect(screen.getByRole('region', { name: 'Menu · QTN-0023' })).toBeInTheDocument();
  expect(screen.getByText('✓ Gujarati Sweet: Churma Na Ladoo')).toBeInTheDocument();
  expect(screen.getByText(/Puri · Ringan Bataka Nu Shaak · Desi Vaal/)).toBeInTheDocument();
  expect(screen.getByText(/Rajkoti Marcha\) with Chutney$/)).toBeInTheDocument();
  expect(screen.queryByText(/Lapsi/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Kitchen PDF' }));
  expect(onPdf).toHaveBeenCalled();
});

test('an open pick is flagged and a booking without a quote says where the menu comes from', () => {
  const open = { ...kavit, items: kavit.items.map(i => ({ ...i, chosen: undefined })) };
  const { rerender } = render(<EventMenu quote={open as any} onPdf={() => undefined} />);
  expect(screen.getByText('Gujarati Sweet: not chosen yet (Churma Na Ladoo or Lapsi)')).toHaveClass('ev-open');
  rerender(<EventMenu onPdf={() => undefined} />);
  expect(screen.getByText('No menu yet. It comes from the quotation.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Kitchen PDF' })).toBeNull();
});
