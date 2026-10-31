import toast from 'react-hot-toast';
import { SeasonalOccasion, useSetSeason } from '../../hooks/useSeasonalOccasions';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Could not save');

// Start, end or switch the season on the counter; its sweets follow it.
export const useSeasonActions = () => {
  const set = useSetSeason();
  const run = async (args: { on?: string[]; off?: string[] }, done: string) => {
    try { await set.mutateAsync(args); toast.success(done); return true; } catch (e) { toast.error(errorText(e)); return false; }
  };
  return {
    busy: set.isPending,
    start: (o: SeasonalOccasion) => run({ on: [o.id] }, `${o.name} is on · its sweets are on the counter`),
    end: (o: SeasonalOccasion) => run({ off: [o.id] }, `${o.name} is over · its sweets are hidden`),
    // Only the chosen season stays on; no choice leaves just the all-year sweets.
    switchTo: (all: SeasonalOccasion[], pick: SeasonalOccasion | null) => run(
      { on: pick ? [pick.id] : [], off: all.filter(o => o.is_active && o.id !== pick?.id).map(o => o.id) },
      pick ? `${pick.name} is on the counter` : 'Only all-year sweets are on the counter',
    ),
  };
};
