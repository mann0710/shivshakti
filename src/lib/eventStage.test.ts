import { eventStage } from './eventStage';

test('event stage follows booking, quotes and invoice', () => {
  expect(eventStage({ status: 'inquiry' }, [])).toBe('inquiry');
  expect(eventStage({ status: 'inquiry' }, [{ status: 'rejected' }])).toBe('inquiry');
  expect(eventStage({ status: 'followup' }, [{ status: 'sent' }])).toBe('quoted');
  expect(eventStage({ status: 'confirmed' }, [{ status: 'accepted' }])).toBe('confirmed');
  expect(eventStage({ status: 'confirmed' }, [], { status: 'sent', balance_due: 500 })).toBe('invoiced');
  expect(eventStage({ status: 'completed' }, [], { status: 'paid', balance_due: 0 })).toBe('paid');
  expect(eventStage({ status: 'cancelled' }, [{ status: 'accepted' }])).toBe('cancelled');
});
