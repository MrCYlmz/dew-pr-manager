declare class Raw {
  readonly value: string;
  constructor(value: string);
}

export function raw(value: string): Raw;
export function escapeHtml(value: unknown): string;
export function html(strings: TemplateStringsArray, ...values: unknown[]): string;
