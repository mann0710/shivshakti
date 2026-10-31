// index.css zooms the whole app on very wide screens; fixed menus must place themselves in zoomed px.
export const pageZoom = (): number =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('zoom')) || 1;

export interface Box { top: number; bottom: number; left: number; right: number; width: number; vw: number; vh: number }

// An element's box plus the window size (vw, vh), all in the page's own px.
export function measure(el: Element): Box {
  const z = pageZoom();
  const r = el.getBoundingClientRect();
  return { top: r.top / z, bottom: r.bottom / z, left: r.left / z, right: r.right / z, width: r.width / z,
    vw: window.innerWidth / z, vh: window.innerHeight / z };
}
