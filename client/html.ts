class Raw {
  readonly value: string;
  constructor(value: string) { this.value = value; }
}
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};
export function raw(value: string): Raw { return new Raw(value); }
export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.reduce(
    (acc, str, i) => {
      if (i >= values.length) return acc + str;
      const value = values[i];
      return acc + str + (value instanceof Raw ? value.value : escapeHtml(value));
    },
    "",
  );
}
