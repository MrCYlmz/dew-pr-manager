import { describe, expect, test } from "bun:test";


const css = await Bun.file(new URL("../public/styles.css", import.meta.url)).text();

function declarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function blockAfter(selector: string): string {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unterminated block for ${selector}`);
}

describe("dark-mode tokens", () => {
  test("media-query block and [data-theme=dark] block declare the same tokens", () => {
    const media = declarations(blockAfter(':root:not([data-theme="light"])'));
    const stamp = declarations(blockAfter(':root[data-theme="dark"]'));
    expect(Object.keys(media).length).toBeGreaterThan(0);
    expect(stamp).toEqual(media);
  });

  test("every status hue redefined for dark is one the light block declares", () => {
    const light = declarations(blockAfter(":root {"));
    const dark = declarations(blockAfter(':root[data-theme="dark"]'));
    for (const name of Object.keys(dark)) expect(light).toHaveProperty(name);
  });
});
