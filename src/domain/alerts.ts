import type { Alert, ChangeSet, DerivedPullRequest } from "../types.ts";

function notReadyConsumers(set: ChangeSet, breakingSpec: DerivedPullRequest): DerivedPullRequest[] {
  return set.members.filter(
    (m) => m.key !== breakingSpec.key && !m.isSpecPR && m.status !== "READY_TO_MERGE",
  );
}

/** FR-5.16-18: raise, name and link the three declared-breaking-change alert conditions. */
export function deriveAlerts(sets: ChangeSet[]): Alert[] {
  const alerts: Alert[] = [];

  for (const set of sets) {
    for (const spec of set.members.filter((m) => m.isSpecPR)) {
      if (spec.breakingDeclaration === "MISSING") {
        alerts.push({
          kind: "missing_block",
          prKey: spec.key,
          prUrl: spec.url,
          message: `${spec.repo}#${spec.number} has no breaking-change declaration in its body — nobody has said whether this is safe to merge.`,
        });
        continue;
      }

      if (spec.breakingDeclaration === "UNDECLARED") {
        alerts.push({
          kind: "undeclared",
          prKey: spec.key,
          prUrl: spec.url,
          message: `${spec.repo}#${spec.number} has a breaking-change block but neither box is ticked — nobody has said.`,
        });
        continue;
      }

      if (spec.breakingDeclaration === "BREAKING" && spec.status === "READY_TO_MERGE") {
        const blocked = notReadyConsumers(set, spec);
        if (blocked.length > 0) {
          const names = blocked.map((m) => `${m.repo}#${m.number}`).join(", ");
          alerts.push({
            kind: "breaking_not_ready",
            prKey: spec.key,
            prUrl: spec.url,
            message: `${spec.repo}#${spec.number} is a declared breaking change and ready to merge, but ${names} in set "${set.label}" is not ready — merging now would break ${names}.`,
          });
        }
      }
    }
  }

  return alerts;
}
