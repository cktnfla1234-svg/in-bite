import { useMemo, useState } from 'react';
import SuggestionCard from './components/SuggestionCard';
import { generateMealIdeas } from './lib/gemini';

const starterIdeas = [
  {
    title: 'Crispy Gochujang Wrap',
    description:
      'A spicy chicken or tofu wrap with crunchy slaw, quick pickles, and a creamy finish for easy weeknight energy.',
    meta: 'Bold + fast',
  },
  {
    title: 'Lemon Herb Rice Bowl',
    description:
      'A bright bowl built around rice, greens, and roasted veggies with a punchy citrus dressing.',
    meta: 'Fresh comfort',
  },
  {
    title: 'Midnight Yogurt Crunch',
    description:
      'Greek yogurt, fruit, granola, and dark chocolate layered into a snack that feels like dessert.',
    meta: 'Sweet reset',
  },
];

const formDefaults = {
  cravings: '',
  ingredients: '',
  dietaryNeed: '',
};

function App() {
  const [formData, setFormData] = useState(formDefaults);
  const [ideas, setIdeas] = useState(starterIdeas);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const isLoading = status === 'loading';
  const hasApiKey = useMemo(
    () => Boolean(import.meta.env.VITE_GEMINI_API_KEY),
    [],
  );

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('loading');
    setError('');

    try {
      const nextIdeas = await generateMealIdeas(formData);
      setIdeas(nextIdeas.length ? nextIdeas : starterIdeas);
      setStatus('success');
    } catch (submitError) {
      setStatus('error');
      setError(submitError.message);
    }
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-6 sm:max-w-2xl sm:px-6">
        <section className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/40 backdrop-blur sm:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-accent-100/80">
                In-Bite
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Find your next bite in seconds.
              </h1>
            </div>
            <span className="rounded-full border border-accent-500/40 bg-accent-500/10 px-3 py-1 text-xs font-medium text-accent-100">
              Mobile first
            </span>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Start with a lightweight MVP: tell the app what you are craving, what
            you have, and any dietary rules. Gemini turns that into quick meal
            ideas that feel tailored instead of generic.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                What are you in the mood for?
              </span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
                name="cravings"
                placeholder="Spicy, cozy, crunchy..."
                value={formData.cravings}
                onChange={handleChange}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                Ingredients you already have
              </span>
              <textarea
                className="min-h-24 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
                name="ingredients"
                placeholder="Rice, eggs, kimchi, spinach..."
                value={formData.ingredients}
                onChange={handleChange}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">
                Dietary preferences
              </span>
              <input
                className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-accent-500 focus:ring-2 focus:ring-accent-500/30"
                name="dietaryNeed"
                placeholder="Vegetarian, high-protein, gluten-free..."
                value={formData.dietaryNeed}
                onChange={handleChange}
              />
            </label>

            <button
              className="w-full rounded-2xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isLoading}
              type="submit"
            >
              {isLoading ? 'Generating ideas...' : 'Generate with Gemini'}
            </button>
          </form>

          <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-300">
            <p className="font-medium text-white">Gemini setup</p>
            <p className="mt-2">
              Add your API key to `.env` as `VITE_GEMINI_API_KEY`.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Status: {hasApiKey ? 'API key detected' : 'API key missing'}
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Suggested bites</h2>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              {status === 'success' ? 'Fresh response' : 'Starter content'}
            </p>
          </div>

          <div className="mt-4 grid gap-4">
            {ideas.map((idea) => (
              <SuggestionCard
                key={`${idea.title}-${idea.meta}`}
                description={idea.description}
                meta={idea.meta}
                title={idea.title}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
