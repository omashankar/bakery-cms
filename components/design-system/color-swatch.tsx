interface ColorSwatchProps {
  name: string;
  value: string;
  /** True when the swatch background is dark — use a light label */
  onDarkSwatch?: boolean;
  /** @deprecated use onDarkSwatch */
  textDark?: boolean;
  description?: string;
}

export function ColorSwatch({
  name,
  value,
  onDarkSwatch,
  textDark = false,
  description,
}: ColorSwatchProps) {
  const lightLabel = onDarkSwatch ?? textDark;
  /* Inline color beats color-scheme: dark forcing light CanvasText */
  const labelColor = lightLabel ? "#fafafa" : "#171717";

  return (
    <div className="group space-y-2">
      <div
        className="flex h-20 flex-col justify-end rounded-xl border border-border p-3 transition-premium group-hover:border-primary/40"
        style={{ backgroundColor: value }}
      >
        <span className="text-xs font-medium" style={{ color: labelColor }}>
          {name}
        </span>
      </div>
      <p className="font-mono text-xs text-foreground/70">{value}</p>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
