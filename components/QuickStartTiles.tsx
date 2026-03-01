interface QuickStartTilesProps {
  onPick: (prompt: string) => void;
}

const items = [
  "Write a to-do list for a personal project",
  "Generate an email to update a client on progress",
  "Summarize this article in 5 bullet points",
  "How does AI work for complete beginners?",
];

export function QuickStartTiles({ onPick }: QuickStartTilesProps) {
  return (
    <div className="mt-6">
      <p className="mb-3 text-center text-xs text-slate-500">Get started with an example below</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onPick(item)}
            className="rounded-card border border-border bg-white px-4 py-3 text-left text-sm shadow-soft transition hover:-translate-y-0.5 hover:border-slate-300"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}
