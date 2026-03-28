/**
 * Lightweight OpenAI key check (GET /v1/models). Used by validate-api-key route and optional client verification.
 */
export async function validateOpenAIApiKey(apiKey: string): Promise<boolean> {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  const res = await fetch('https://api.openai.com/v1/models?limit=1', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${trimmed}`,
    },
  });
  return res.ok;
}
