export type StripeReturnKind = 'critique' | 'preview_edit';
export type StripeReturnParamSource = 'router' | 'browser' | 'hash';

export type StripeReturnParamsMatch = {
  params: URLSearchParams;
  source: StripeReturnParamSource;
};

function isStripeReturnSuccess(params: URLSearchParams): boolean {
  return params.get('payment') === 'success';
}

function parseSearchLike(raw: string): URLSearchParams | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const search = trimmed.startsWith('?') ? trimmed : `?${trimmed}`;
  try {
    return new URLSearchParams(search);
  } catch {
    return null;
  }
}

export function findStripeReturnParams(args: {
  routerSearch: string;
  browserSearch?: string;
  hash?: string;
}): StripeReturnParamsMatch | null {
  const routerParams = parseSearchLike(args.routerSearch);
  if (routerParams && isStripeReturnSuccess(routerParams)) {
    return { params: routerParams, source: 'router' };
  }

  const browserParams = parseSearchLike(args.browserSearch ?? '');
  if (browserParams && isStripeReturnSuccess(browserParams)) {
    return { params: browserParams, source: 'browser' };
  }

  const rawHash = (args.hash ?? '').trim();
  const hashQueryStart = rawHash.indexOf('?');
  if (hashQueryStart >= 0) {
    const hashParams = parseSearchLike(rawHash.slice(hashQueryStart));
    if (hashParams && isStripeReturnSuccess(hashParams)) {
      return { params: hashParams, source: 'hash' };
    }
  }

  return null;
}
