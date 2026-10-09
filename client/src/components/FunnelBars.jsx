export default function FunnelBars({ items, onSelect }) {
  const stack = items.length > 1;
  const n = Math.max(items.length, 1);
  return (
    <div className={`sf-funnel${stack ? " sf-funnel--stack" : " sf-funnel--card"}`}>
      {items.map((item, i) => {
        const top = stack ? 100 - (i / n) * 40 : 100;
        const bot = stack ? 100 - ((i + 1) / n) * 40 : 100;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item)}
            className="sf-funnel__row"
            style={{ "--top": top, "--bot": bot }}
          >
            <div className="sf-funnel__copy">
              <div className="sf-funnel__title">{item.title}</div>
              {item.subtitle ? <div className="sf-funnel__sub">{item.subtitle}</div> : null}
            </div>
            <div className="sf-funnel__track">
              <span className="sf-funnel__bar" style={{ background: item.color }} />
            </div>
            <div className="sf-funnel__nums">
              <div className="sf-funnel__value">{item.value}</div>
              {item.meta ? <div className="sf-funnel__meta">{item.meta}</div> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export const FUNNEL_COLORS = {
  s1: "#94A3B8",
  s2: "#3F8BA2",
  s3: "#2079B7",
  s4: "#0D4574",
  won: "#8CBC43",
  lost: "#48494A",
  cancelled: "#44467D",
};
