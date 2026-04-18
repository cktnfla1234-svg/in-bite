/** Regional Indicator Symbol pair from ISO 3166-1 alpha-2 (A–Z only). */
export function flagEmojiFromCountryCode(iso2: string): string {
  const code = iso2.trim().toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return "🌍";
  const A = 0x1f1e6;
  const cp = (ch: string) => A + (ch.charCodeAt(0) - 0x41);
  return String.fromCodePoint(cp(code[0]!), cp(code[1]!));
}
