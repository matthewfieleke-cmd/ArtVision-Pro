/**
 * Read JSON from an API response; avoids res.json() throwing on HTML/error pages from the proxy.
 */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch {
    const hint = text.trim().slice(0, 160).replace(/\s+/g, ' ');
    throw new Error(
      res.ok
        ? 'Invalid JSON from API'
        : hint
          ? `API ${res.status}: ${hint}${text.length > 160 ? '…' : ''}`
          : `API ${res.status}`
    );
  }
}
