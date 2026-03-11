interface QuickStartCardProps {
  onAddLocation: () => void;
  onDrawShape: () => void;
  onLoadExample: () => void;
  onDismiss?: () => void;
}

export default function QuickStartCard({ onAddLocation, onDrawShape, onLoadExample, onDismiss }: QuickStartCardProps) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      <div className="bg-card/95 backdrop-blur-sm rounded-lg p-6 max-w-[340px] text-center panel-shadow pointer-events-auto relative">
        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 active:bg-muted text-muted-foreground hover:text-foreground cursor-pointer border-0 transition-colors text-[14px]"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-[32px] opacity-20 mb-2">⬡</div>
        <div className="text-primary font-medium text-sm tracking-wide mb-1">Welcome to TACLOG</div>
        <p className="text-muted-foreground text-[11px] leading-relaxed mb-4">
          Start by placing locations on the map. Click "Add Location" or draw a shape to begin planning.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onAddLocation}
            className="w-full py-2.5 px-3 bg-primary text-primary-foreground rounded text-[11px] font-medium cursor-pointer border-0 transition-opacity hover:opacity-90 active:opacity-80"
          >
            ⊕ Add Location
          </button>
          <button
            onClick={onDrawShape}
            className="w-full py-2.5 px-3 bg-secondary text-secondary-foreground rounded text-[11px] font-medium cursor-pointer border border-border transition-opacity hover:opacity-90 active:opacity-80"
          >
            ✎ Draw Shape
          </button>
          <button
            onClick={onLoadExample}
            className="w-full py-2.5 px-3 bg-accent text-accent-foreground rounded text-[11px] font-medium cursor-pointer border border-border transition-opacity hover:opacity-90 active:opacity-80"
          >
            ▶ Load Example Scenario
          </button>
        </div>
      </div>
    </div>
  );
}
