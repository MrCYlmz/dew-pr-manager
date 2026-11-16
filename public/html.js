class Raw {
  constructor(value) { this.value = value; }
}
export function raw(value) { return new Raw(value); }
export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}
export function html(strings, ...values) {
  return strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? (values[i] instanceof Raw ? values[i].value : escapeHtml(values[i])) : ""),
    "",
  );
}
