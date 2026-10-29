import React, { useState, useRef, useEffect } from 'react';

interface Props { value: string; onChange: (v: string) => void; style: React.CSSProperties }

// Google Maps venue autocomplete — graceful fallback if no API key
const BookingVenueInput: React.FC<Props> = ({ value, onChange, style }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_KEY;
  const [gmReady, setGmReady] = useState(false);

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    const gm = (window as any).google;
    if (gm?.maps?.places) { initAC(); setGmReady(true); return; }
    const existing = document.querySelector('script[data-gm="1"]') as HTMLScriptElement | null;
    const onLoad = () => { initAC(); setGmReady(true); };
    if (existing) { existing.addEventListener('load', onLoad); return () => existing.removeEventListener('load', onLoad); }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.setAttribute('data-gm', '1');
    script.async = true;
    script.onload = onLoad;
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const initAC = () => {
    if (!inputRef.current) return;
    const gm = (window as any).google;
    if (!gm?.maps?.places) return;
    const ac = new gm.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: 'in' } });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      onChange(place.formatted_address || place.name || '');
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <input ref={inputRef} style={style} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={apiKey ? 'Start typing to search on Google Maps…' : 'Hall name, area'} />
      {gmReady && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, pointerEvents: 'none' }}>📍</span>}
    </div>
  );
};

export default BookingVenueInput;
