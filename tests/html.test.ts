import { describe, expect, test } from "bun:test";
import { escapeHtml, html, raw } from "../client/html.ts";

describe("escapeHtml", () => {
  test("escapes & < > \" and '", () => {
    expect(escapeHtml(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &#39; f");
  });

  test("escapes an ampersand once, not again inside the entities it writes", () => {
    expect(escapeHtml("<&>")).toBe("&lt;&amp;&gt;");
  });

  test("leaves text without special characters as it is", () => {
    expect(escapeHtml("Add widget #12")).toBe("Add widget #12");
  });

  test("turns non-strings into strings", () => {
    expect(escapeHtml(42)).toBe("42");
    expect(escapeHtml(null)).toBe("null");
    expect(escapeHtml(undefined)).toBe("undefined");
    expect(escapeHtml(false)).toBe("false");
  });
});

describe("html template", () => {
  test("escapes interpolated values", () => {
    const title = `<script>alert("x")</script>`;
    expect(html`<span title="${title}">${title}</span>`).toBe(
      `<span title="&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</span>`,
    );
  });

  test("leaves raw values unescaped", () => {
    expect(html`<div>${raw("<b>bold</b>")}</div>`).toBe("<div><b>bold</b></div>");
  });

  test("escapes and keeps raw values in the same template", () => {
    expect(html`${raw("<i></i>")}${"<i></i>"}`).toBe("<i></i>&lt;i&gt;&lt;/i&gt;");
  });

  test("turns interpolated non-strings into strings", () => {
    expect(html`<b>${3}</b> of ${7}`).toBe("<b>3</b> of 7");
  });

  test("keeps the literal parts as written", () => {
    expect(html`<p class="x">a & b</p>`).toBe(`<p class="x">a & b</p>`);
  });

  test("a template without values is its literal text", () => {
    expect(html``).toBe("");
  });
});
