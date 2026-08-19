import type { PlanRunResponse, Task } from "@/shared/types/planRun";

export interface NormalizedSE {
  SE_Name: string;
  taskIdsByDcId: Record<string, Task>;
  taskOrder: string[]; // DC_IDs in original Tasks[] order - stops[] / Tasks[] order is meaningful
}

export interface NormalizedPlanRun {
  meta: Omit<PlanRunResponse, "Plans" | "Exceptions_Report">;
  seById: Record<string, NormalizedSE>;
  seOrder: string[];
  exceptions: PlanRunResponse["Exceptions_Report"];
}

// Index server data by ID so downstream lookups (multi-scope merge, pitch panel,
// route selection) are O(1) instead of an array .find() (spec §17).
export function normalizePlanRun(raw: PlanRunResponse): NormalizedPlanRun {
  const seById: NormalizedPlanRun["seById"] = {};
  const seOrder: string[] = [];

  for (const se of raw.Plans) {
    const taskIdsByDcId: Record<string, Task> = {};
    const taskOrder: string[] = [];
    for (const task of se.Tasks) {
      taskIdsByDcId[task.DC_ID] = task;
      taskOrder.push(task.DC_ID);
    }
    seById[se.SE_ID] = { SE_Name: se.SE_Name, taskIdsByDcId, taskOrder };
    seOrder.push(se.SE_ID);
  }

  const { Plans: _Plans, Exceptions_Report, ...meta } = raw;
  return { meta, seById, seOrder, exceptions: Exceptions_Report };
}

// Merge N parallel scope GETs (multi-select, §7) into one normalized structure
// instead of concatenating and de-duping raw arrays.
export function mergeNormalizedPlanRuns(
  runs: NormalizedPlanRun[],
): Pick<NormalizedPlanRun, "seById" | "seOrder" | "exceptions"> {
  const seById: NormalizedPlanRun["seById"] = {};
  const seOrder: string[] = [];
  const exceptions: NormalizedPlanRun["exceptions"] = [];

  for (const run of runs) {
    for (const seId of run.seOrder) {
      if (!(seId in seById)) seOrder.push(seId);
      seById[seId] = run.seById[seId];
    }
    exceptions.push(...run.exceptions);
  }

  return { seById, seOrder, exceptions };
}
