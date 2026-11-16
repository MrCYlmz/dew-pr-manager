import { describe, expect, test } from "bun:test";
import { diagramLayout, rowStartX, stepOf, type DiagramLayout, type NodeBox } from "../public/connectionsLayout.js";
import { makeChangeSet, makeDerived } from "./helpers.ts";

// Expected positions are the pre-story layout (requirements criterion 3: no behaviour change):
// wide nodes 216 x 62 with 18 between them, vertical nodes 34 high with 9 between them,
// the bus at y 14 above a single row, or midway in the 26 gap below a spec row at y 12.

function member(n: number, { spec = false } = {}) {
  return makeDerived({
    key: `acme/repo-${n}#${n}`,
    repo: `acme/repo-${n}`,
    repoName: `repo-${n}`,
    number: n,
    isSpecPR: spec,
    mergeStep: spec ? 1 : null,
  });
}

function setOf(specs: number, consumers: number) {
  const members = [
    ...Array.from({ length: specs }, (_, i) => member(i + 1, { spec: true })),
    ...Array.from({ length: consumers }, (_, i) => member(specs + i + 1)),
  ];
  return makeChangeSet({ members, mergeOrderKnown: specs > 0 });
}

function boxOf(layout: DiagramLayout, n: number): NodeBox {
  const box = layout.nodes.find((node) => node.prKey === `acme/repo-${n}#${n}`);
  if (!box) throw new Error(`no node for PR ${n}`);
  return box;
}

function overlaps(a: NodeBox, b: NodeBox): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function expectNoOverlap(layout: DiagramLayout) {
  for (let i = 0; i < layout.nodes.length; i++) {
    for (let j = i + 1; j < layout.nodes.length; j++) expect(overlaps(layout.nodes[i], layout.nodes[j])).toBe(false);
  }
}

function expectInsideDiagram(layout: DiagramLayout, avail: number) {
  for (const node of layout.nodes) {
    expect(node.x).toBeGreaterThanOrEqual(0);
    expect(node.y).toBeGreaterThanOrEqual(0);
    expect(node.x + node.width).toBeLessThanOrEqual(avail);
    expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
  }
}

describe("stepOf", () => {
  test("shows the merge step of a spec PR and a consumer", () => {
    expect(stepOf(makeDerived({ mergeStep: 1 }))).toBe("1");
    expect(stepOf(makeDerived({ mergeStep: 2 }))).toBe("2");
  });

  test("shows ? when the merge order is unknown", () => {
    expect(stepOf(makeDerived({ mergeStep: null }))).toBe("?");
  });
});

describe("rowStartX", () => {
  test("centres a row of one node", () => {
    expect(rowStartX(1, 800)).toBe(292);
  });

  test("centres a row of several nodes with their gaps", () => {
    expect(rowStartX(2, 800)).toBe(175);
    expect(rowStartX(3, 800)).toBe(58);
  });

  test("starts at the left margin when the row is wider than the space", () => {
    expect(rowStartX(4, 800)).toBe(2);
  });
});

describe("diagram layout", () => {
  test("a set of one PR is one centred wide node", () => {
    const layout = diagramLayout(setOf(0, 1), 800);
    expect(layout.orientation).toBe("wide");
    expect(layout.nodes).toHaveLength(1);
    expect(boxOf(layout, 1)).toMatchObject({ x: 292, y: 27, width: 216, height: 62 });
    expectInsideDiagram(layout, 800);
  });

  test("a set without a spec PR that fits one row is a single centred row", () => {
    const layout = diagramLayout(setOf(0, 3), 800);
    expect(layout.orientation).toBe("wide");
    expect(layout.nodes.map((node) => node.x).sort((a, b) => a - b)).toEqual([58, 292, 526]);
    for (const node of layout.nodes) expect(node).toMatchObject({ y: 27, width: 216, height: 62 });
    expectNoOverlap(layout);
    expectInsideDiagram(layout, 800);
  });

  test("spec PRs sit on a row above their consumers", () => {
    const layout = diagramLayout(setOf(1, 2), 800);
    expect(layout.orientation).toBe("wide");
    expect(boxOf(layout, 1)).toMatchObject({ x: 292, y: 12, width: 216, height: 62 });
    expect(boxOf(layout, 2)).toMatchObject({ x: 175, y: 100, width: 216, height: 62 });
    expect(boxOf(layout, 3)).toMatchObject({ x: 409, y: 100, width: 216, height: 62 });
    expect(boxOf(layout, 1).y + boxOf(layout, 1).height).toBeLessThan(boxOf(layout, 2).y);
    expectNoOverlap(layout);
    expectInsideDiagram(layout, 800);
  });

  test("a tier wider than one row switches to the vertical layout", () => {
    const layout = diagramLayout(setOf(0, 4), 800);
    expect(layout.orientation).toBe("vertical");
    expect(layout.nodes).toHaveLength(4);
    expect([1, 2, 3, 4].map((n) => boxOf(layout, n).y)).toEqual([6, 49, 92, 135]);
    for (const node of layout.nodes) expect(node).toMatchObject({ x: 30, width: 768, height: 34 });
    expect(layout.height).toBe(175);
    expectNoOverlap(layout);
    expectInsideDiagram(layout, 800);
  });

  test("a spec tier wider than one row switches to the vertical layout", () => {
    const layout = diagramLayout(setOf(4, 1), 800);
    expect(layout.orientation).toBe("vertical");
    expect(layout.nodes).toHaveLength(5);
    expectNoOverlap(layout);
    expectInsideDiagram(layout, 800);
  });

  test("a narrow container switches to the vertical layout", () => {
    const layout = diagramLayout(setOf(0, 2), 479);
    expect(layout.orientation).toBe("vertical");
    for (const node of layout.nodes) expect(node).toMatchObject({ x: 30, width: 447, height: 34 });
    expectNoOverlap(layout);
    expectInsideDiagram(layout, 479);
  });

  test("two nodes still fit wide at the narrowest wide width", () => {
    const layout = diagramLayout(setOf(0, 2), 480);
    expect(layout.orientation).toBe("wide");
    expectNoOverlap(layout);
    expectInsideDiagram(layout, 480);
  });

  test("the bus of a set with spec PRs runs midway between the spec row and the consumer row", () => {
    const layout = diagramLayout(setOf(1, 2), 800);
    expect(layout.busY).toBe(87);
    expect(boxOf(layout, 1).y + boxOf(layout, 1).height).toBeLessThan(87);
    expect(boxOf(layout, 2).y).toBeGreaterThan(87);
  });

  test("the bus of a set without a spec PR runs above its single row", () => {
    const layout = diagramLayout(setOf(0, 3), 800);
    expect(layout.busY).toBe(14);
    for (const node of layout.nodes) expect(node.y).toBeGreaterThan(14);
  });

  test("wide nodes of a set with spec PRs show their merge step as badge", () => {
    const set = makeChangeSet({
      members: [member(1, { spec: true }), makeDerived({ ...member(2), mergeStep: 2 }), makeDerived({ ...member(3), mergeStep: 2 })],
      mergeOrderKnown: true,
    });
    const layout = diagramLayout(set, 800);
    expect(layout.orientation).toBe("wide");
    expect([1, 2, 3].map((n) => boxOf(layout, n).badge)).toEqual(["1", "2", "2"]);
  });

  test("wide nodes of a set without a spec PR show ? as badge, even with a merge step", () => {
    const set = makeChangeSet({
      members: [makeDerived({ ...member(1), mergeStep: 1 }), makeDerived({ ...member(2), mergeStep: 2 })],
      mergeOrderKnown: false,
    });
    const layout = diagramLayout(set, 800);
    expect(layout.orientation).toBe("wide");
    expect([1, 2].map((n) => boxOf(layout, n).badge)).toEqual(["?", "?"]);
  });

  test("vertical nodes show their merge step as badge, or ? when it is unknown", () => {
    const set = makeChangeSet({
      members: [member(1, { spec: true }), makeDerived({ ...member(2), mergeStep: 2 }), member(3), member(4), member(5)],
      mergeOrderKnown: true,
    });
    const layout = diagramLayout(set, 800);
    expect(layout.orientation).toBe("vertical");
    expect([1, 2, 3, 4, 5].map((n) => boxOf(layout, n).badge)).toEqual(["1", "2", "?", "?", "?"]);
  });

  test("nothing is dropped in the vertical layout", () => {
    const set = setOf(2, 5);
    const layout = diagramLayout(set, 800);
    expect(layout.orientation).toBe("vertical");
    expect(layout.nodes.map((node) => node.prKey).sort()).toEqual(set.members.map((m) => m.key).sort());
  });
});
