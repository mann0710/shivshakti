// "Namaste {name} ji" + { name: 'Ramesh' } → "Namaste Ramesh ji".
export const fill = (t: string, v: Record<string, string | number>) => t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
