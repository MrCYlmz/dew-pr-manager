export const NODE_W = 216;
export const NODE_H = 62;
export const GAP_X = 18;
export const GAP_Y = 26;
export const MIN_WIDE_W = 480;

export const V_NODE_H = 34;
export const V_GAP = 9;
export const V_BUS_X = 14;
export const V_NODE_X = 30;

export function stepOf(pr) {
  return pr.mergeStep == null ? "?" : String(pr.mergeStep);
}

export function rowStartX(count, avail) {
  const rowW = count * NODE_W + (count - 1) * GAP_X;
  return Math.max(2, Math.round((avail - rowW) / 2));
}

function wideRow(prs, y, avail, badge) {
  const x0 = rowStartX(prs.length, avail);
  return prs.map((pr, i) => ({
    prKey: pr.key,
    pr,
    x: x0 + i * (NODE_W + GAP_X),
    y,
    width: NODE_W,
    height: NODE_H,
    badge: badge(pr),
  }));
}

function wideLayout(set, specs, consumers, avail) {
  if (specs.length > 0) {
    const specY = 12;
    const busY = specY + NODE_H + GAP_Y / 2;
    const consY = busY + GAP_Y / 2;
    const nodes = [...wideRow(specs, specY, avail, stepOf), ...wideRow(consumers, consY, avail, stepOf)];
    return { orientation: "wide", height: consY + NODE_H + 6, busY, nodes };
  }

  const busY = 14;
  const rowY = busY + GAP_Y / 2;
  const nodes = wideRow(set.members, rowY, avail, () => "?");
  return { orientation: "wide", height: rowY + NODE_H + 6, busY, nodes };
}

function verticalLayout(set, avail) {
  let y = 6;
  const nodes = set.members.map((pr) => {
    const node = { prKey: pr.key, pr, x: V_NODE_X, y, width: avail - V_NODE_X - 2, height: V_NODE_H, badge: stepOf(pr) };
    y += V_NODE_H + V_GAP;
    return node;
  });
  return { orientation: "vertical", height: y - V_GAP + 6, nodes };
}

export function diagramLayout(set, avail) {
  const specs = set.members.filter((m) => m.isSpecPR);
  const consumers = set.members.filter((m) => !m.isSpecPR);
  const perRow = Math.max(1, Math.floor((avail + GAP_X) / (NODE_W + GAP_X)));
  const fitsWide = avail >= MIN_WIDE_W && specs.length <= perRow && consumers.length <= perRow && set.members.length <= perRow * 2;
  return fitsWide ? wideLayout(set, specs, consumers, avail) : verticalLayout(set, avail);
}
