import React, { useRef, useEffect } from 'react';

interface Props { id?: string; value: string; onChange: (v: string) => void; className?: string; style?: React.CSSProperties }

// Venue box with Google Maps suggestions when a key is set; plain text otherwise.
const BookingVenueInput: React.FC<Props> = ({ id, value, onChange, className, style }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_KEY;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    const initAC = () => {
      const gm = (window as any).google;
      if (!inputRef.current || !gm?.maps?.places) return;
      const ac = new gm.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: 'in' } });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        change.current(place.formatted_address || place.name || '');
      });
    };
    if ((window as any).google?.maps?.places) { initAC(); return; }
    const existing = document.querySelector('script[data-gm="1"]') as HTMLScriptElement | null;
    if (existing) { existing.addEventListener('load', initAC); return () => existing.removeEventListener('load', initAC); }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.setAttribute('data-gm', '1');
    script.async = true;
    script.onload = initAC;
    document.head.appendChild(script);
  }, [apiKey]);

  return (
    <input ref={inputRef} id={id} className={className} style={style} value={value} autoComplete="off"
      onChange={e => onChange(e.target.value)}
      placeholder={apiKey ? 'Start typing a place — Google suggests it' : 'Hall name, area'} />
  );
};

export default BookingVenueInput;
