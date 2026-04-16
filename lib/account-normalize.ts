export function normalizeAccountInput(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function accountLookupKey(value: string): string {
  return normalizeAccountInput(value).replace(/-/g, '');
}

export function accountEqualsLoose(a: string, b: string): boolean {
  return accountLookupKey(a) === accountLookupKey(b);
}
