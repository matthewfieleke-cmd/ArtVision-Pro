export type StripePaywallConfig = {
  paywallEnabled: boolean;
  critiqueAmountCents: number;
  previewEditAmountCents: number;
};

function apiPrefix(): string {
  const external = (import.meta.env.VITE_CRITIQUE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
  if (external) return external;
  const b = import.meta.env.BASE_URL;
  return b.endsWith('/') ? b.slice(0, -1) : b;
}

export async function fetchStripePaywallConfig(): Promise<StripePaywallConfig> {
  const res = await fetch(`${apiPrefix()}/api/stripe/config`);
  const data = (await res.json()) as Partial<StripePaywallConfig>;
  return {
    paywallEnabled: Boolean(data.paywallEnabled),
    critiqueAmountCents: typeof data.critiqueAmountCents === 'number' ? data.critiqueAmountCents : 149,
    previewEditAmountCents: typeof data.previewEditAmountCents === 'number' ? data.previewEditAmountCents : 49,
  };
}

export async function createStripeCheckoutSession(args: {
  kind: 'critique' | 'preview_edit';
  cancelPathHash?: string;
}): Promise<string> {
  const res = await fetch(`${apiPrefix()}/api/stripe/create-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind: args.kind,
      ...(args.cancelPathHash ? { cancelPathHash: args.cancelPathHash } : {}),
    }),
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Checkout ${res.status}`);
  if (!data.url) throw new Error('No checkout URL');
  return data.url;
}

export async function exchangeStripeCheckoutSession(sessionId: string): Promise<{
  jwt: string;
  kind: 'critique' | 'preview_edit';
}> {
  const res = await fetch(`${apiPrefix()}/api/stripe/exchange-checkout-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });
  const data = (await res.json()) as { jwt?: string; kind?: 'critique' | 'preview_edit'; error?: string };
  if (!res.ok) throw new Error(data.error ?? `Stripe session exchange ${res.status}`);
  if (!data.jwt || (data.kind !== 'critique' && data.kind !== 'preview_edit')) {
    throw new Error('Stripe session exchange did not return authorization');
  }
  return { jwt: data.jwt, kind: data.kind };
}
