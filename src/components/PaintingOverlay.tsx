import type { CriterionAnchor } from '../../shared/critiqueAnchors';

type Props = {
  anchor: CriterionAnchor;
};

export function PaintingOverlay({ anchor }: Props) {
  const { region } = anchor;

  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-slate-950/18" />
      <div
        className="absolute rounded-[18px] border border-violet-300/80 bg-violet-400/30 shadow-[0_0_0_1px_rgba(255,255,255,0.18)]"
        style={{
          left: `${region.x * 100}%`,
          top: `${region.y * 100}%`,
          width: `${region.width * 100}%`,
          height: `${region.height * 100}%`,
        }}
      />
    </div>
  );
}
