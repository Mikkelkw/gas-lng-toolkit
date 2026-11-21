/** Renders an Observable Plot chart into a div and re-renders on resize. */
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  /** Builds the chart for a given width. Must return a DOM node. */
  render: (width: number) => Element;
  /** Changes in this key trigger a re-render. */
  deps: unknown[];
  ariaLabel: string;
}

export default function PlotFigure({ render, deps, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const draw = () => {
      const width = Math.max(280, Math.floor(el.clientWidth));
      const node = render(width);
      node.setAttribute('role', 'img');
      node.setAttribute('aria-label', ariaLabel);
      // The root carries the description. Plot's internal <g aria-label> groups have no role,
      // which is invalid ARIA, and screen readers treat img children as presentational anyway.
      node.querySelectorAll('g[aria-label]').forEach((g) => g.removeAttribute('aria-label'));
      el.replaceChildren(node);
    };
    draw();
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientWidth - lastWidth) < 8) return;
      lastWidth = el.clientWidth;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div class="plot" ref={ref} />;
}
