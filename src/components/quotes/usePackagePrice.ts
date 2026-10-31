import { useEffect, useRef, useState } from 'react';
import type { Menu } from '../../types';
import type { QuoteForm } from '../../hooks/useQuoteForm';
import { useMenus } from '../../hooks/useMenus';
import { followPrice, followsPackage, isTiered, matchPackage, priceAt, tierHint } from '../../lib/priceTiers';

// What the price section says about the package's price for this guest count.
export interface PackageHint { text: string; price: number; follows: boolean }

// The package whose guest-count price the plate follows; moves the plate price when the guests change.
export function usePackagePrice(f: QuoteForm, session: number) {
  const { data: menus = [] } = useMenus();
  const [link, setLink] = useState<{ session: number; id: string | null } | null>(null);
  const own = !f.isMultiDay && !(f.showPrices && f.autoPrice);
  const price = parseFloat(f.perPlate) || 0;

  // A reopened quote whose price still matches a package's range follows that package again.
  useEffect(() => {
    if (link?.session === session || !menus.length) return;
    const match = f.editingId ? matchPackage(menus, f.selectedItems.map(i => i.item_name), f.guestCount, price) : undefined;
    setLink({ session, id: match?.id ?? null });
  }, [session, menus]); // eslint-disable-line react-hooks/exhaustive-deps

  const pkg = link?.session === session && link.id ? menus.find(m => m.id === link.id) : undefined;
  const tiered = pkg && isTiered(pkg) ? pkg : undefined;

  // Only a price that still equals the package's price moves; a typed price stays.
  const prev = useRef({ session, guests: f.guestCount });
  useEffect(() => {
    const was = prev.current;
    prev.current = { session, guests: f.guestCount };
    if (!tiered || !own || was.session !== session) return;
    const next = followPrice(tiered, was.guests, f.guestCount, price);
    if (next !== null) f.typePerPlate(String(next));
  }, [session, f.guestCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const hint: PackageHint | null = tiered && own
    ? { text: tierHint(tiered, f.guestCount), price: priceAt(tiered, f.guestCount), follows: followsPackage(tiered, f.guestCount, price) }
    : null;
  return {
    hint,
    link: (m: Menu) => setLink({ session, id: m.id }),
    use: () => { if (hint) f.typePerPlate(String(hint.price)); },
  };
}

export type PackagePrice = ReturnType<typeof usePackagePrice>;
