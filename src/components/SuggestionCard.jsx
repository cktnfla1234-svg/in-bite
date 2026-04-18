function SuggestionCard({ title, description, meta }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glow backdrop-blur">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-accent-100/70">
        {meta}
      </p>
      <h3 className="mt-3 text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
    </article>
  );
}

export default SuggestionCard;
