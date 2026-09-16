import type { ClubDetail, HealthSubScore } from "@/shared/types/planRun";

export interface BusinessAreaProduct {
  Name: string | null;
  Brand: string | null;
  Value: number | null;
}

export interface BusinessAreaSegment {
  Segment: string; // "Branded" | "Private Label"
  Total: number;
  Share_Of_Subcategory: number; // 0-100
  Products: BusinessAreaProduct[];
}

export interface BusinessAreaSubCategory {
  Sub_Category: string;
  Total: number;
  Segments: BusinessAreaSegment[];
}

// Structured form of Who_Section's "Business Area Strength" bullet (planning/dc_card.py:
// _business_area_detail, added 2026-08-22) - every sub-category this fiscal-YTD, split
// Branded vs. Private Label with a share% and product-wise detail, paired with the same
// structure over the prior FY's YTD window where that comparison data exists. Rebuilt
// 2026-08-22 from the old top-5/trailing-12-month/no-split version. null when this DC
// has no current-year business-area data at all; Prior/Prior_Total are independently
// nullable even when Current isn't (prior-year comparison can genuinely be unavailable
// for a DC with real current-year activity - rare in practice, but real).
export interface BusinessAreaDetail {
  Current_Total: number;
  Current_Branded_Total: number;
  Current_PL_Total: number;
  Current: BusinessAreaSubCategory[];
  Prior_Total: number | null;
  Prior: BusinessAreaSubCategory[] | null;
}

// Structured form of Who_Section's "Turnover-wise Standing" bullet (planning/dc_card.py:
// _turnover_detail, added 2026-08-22) - last-FY/YTD purchase, club-scheme qualifying
// turnover, and the YoY PL comparison as separate fields instead of one dense sentence.
// null when none of those signals were available this run.
export interface TurnoverDetail {
  Purchase_Last_FY: number | null;
  Purchase_YTD: number | null;
  Qualifying_Turnover: number | null;
  // Like-for-like window (same days elapsed into the fiscal year on both sides), not a
  // full prior-year total. -0.4 means 40% lower than the same period last FY.
  YoY_PL_Growth_Pct: number | null;
  YTD_PL_Last_Year: number | null;
}

// Structured form of Card_Hindi's "3. Health Score" block (planning/dc_card.py:
// _health_score_detail, added 2026-09-06; API serialization added 2026-09-07 - the
// model field existed since the same commit but dc_card() never exposed it as its own
// field until now, unlike every other card section). Sub_Scores keeps the same 7-
// component shape as Task.Health_Sub_Scores (shared HealthSubScore type) - this is the
// same underlying data, just scoped to one DC Card rather than the whole task list.
// null when this DC had no Health Score computed this run.
export interface HealthScoreDetail {
  DC_Health_Score: number | null;
  Health_Gap: number | null;
  Sub_Scores: Record<string, HealthSubScore>;
  Negative_GM_Flag: boolean;
  Health_Focus_Track: boolean;
  Health_Focus_Purposes: string;
}

// DC Card (Preface) - "Dehaat Center Ko Jaano" (planning/dc_card.py). A second,
// complementary pre-pitch briefing shown when the SE opens a DC's card, BEFORE the
// PitchScript's own Ask/Tell/Wish - originally matched pitch_config's "DC Card
// (Preface)" CSV structure exactly (3 sections: Who / Where DC Stands / Private
// Label), but Section 3 (प्राइवेट लेबल / Private Label) was removed 2026-09-03 per
// direct instruction - the same recommended-products signal still reaches the SE via
// PitchResponse's own Recommended_Products, just not duplicated here. Section 3 is now
// a genuinely NEW section instead (Health Score, added 2026-09-06) - not a repurposing
// of the vacated Private Label slot. Generated automatically alongside PitchScript,
// same trigger point and per-DC-task cadence, but its own DB row/endpoint (GET
// /dc-card/<daily_task_id>/) and its own 404 case for Farmer Meeting tasks (no DC to
// brief on).
export interface DCCardResponse {
  DailyTask_ID: number;
  SE: string;
  DC_Name: string;
  Who_Section: string;
  Where_DC_Stands_Section: string;
  Business_Area_Detail: BusinessAreaDetail | null;
  Turnover_Detail: TurnoverDetail | null;
  // Same shape/meaning as Task's own Club_Detail (shared type, see planRun.ts) - backs
  // this card's "Scheme Standing" bullet instead of DailyTask.DC_Club_Participation.
  Club_Detail: ClubDetail | null;
  // Hindi narrative for "3. Health Score" - same text already embedded in Card_Hindi
  // below, exposed on its own so the frontend isn't forced to re-parse combined text.
  // null when this DC had no Health Score computed this run.
  Health_Score_Section: string | null;
  Health_Score_Detail: HealthScoreDetail | null;
  Card_Hindi: string;
  Data_Sources_Used: string[];
  Data_Sources_Skipped: string[];
  Generated_At: string;
}
