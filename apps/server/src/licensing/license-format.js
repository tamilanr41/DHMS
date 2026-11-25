export const LICENSE_FORMAT = 'zhanx-license/1';
export const LICENSE_VERSION = 1;
export const PRODUCT_ID = 'zhanx-dentalcare';

// Canonical JSON: keys sorted, no insignificant whitespace. Both the issuer and the
// verifier use this exact representation, so any edit to the payload breaks the signature.
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function signingInput(payload) {
  return `${LICENSE_FORMAT}\n${canonicalJson(payload)}`;
}
