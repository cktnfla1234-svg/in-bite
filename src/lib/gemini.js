const API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

function buildPrompt({ cravings, ingredients, dietaryNeed }) {
  return [
    'You are helping create fast meal ideas for a mobile-first food discovery app named In-Bite.',
    'Return exactly three meal suggestions.',
    'Each suggestion should include a title, a short description, and a quick vibe label.',
    'Respond with valid JSON in this shape: {"ideas":[{"title":"","description":"","meta":""}]}',
    `Cravings: ${cravings || 'Open to anything'}`,
    `Ingredients on hand: ${ingredients || 'No ingredients provided'}`,
    `Dietary preference: ${dietaryNeed || 'No restriction provided'}`,
  ].join('\n');
}

export async function generateMealIdeas(formData) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing Gemini API key. Add VITE_GEMINI_API_KEY to your .env file.');
  }

  const response = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt(formData) }],
        },
      ],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const snippet = errText ? `\n${errText.slice(0, 300)}` : '';
    throw new Error(
      `Gemini request failed: ${response.status} ${response.statusText}${snippet}`,
    );
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  const parsed = JSON.parse(text);
  return parsed.ideas ?? [];
}
