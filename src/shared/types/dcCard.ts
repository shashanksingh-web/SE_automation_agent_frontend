import type { RecommendedProducts } from "@/shared/types/feedback";

// DC Card (Preface) - "Dehaat Center Ko Jaano" (planning/dc_card.py). A second,
// complementary pre-pitch briefing shown when the SE opens a DC's card, BEFORE the
// PitchScript's own Ask/Tell/Wish - matches pitch_config's "DC Card (Preface)" CSV
// structure exactly: 3 sections (Who / Where DC Stands / Private Label). Generated
// automatically alongside PitchScript, same trigger point and per-DC-task cadence, but
// its own DB row/endpoint (GET /dc-card/<daily_task_id>/) and its own 404 case for
// Farmer Meeting tasks (no DC to brief on).
export interface DCCardResponse extends RecommendedProducts {
  DailyTask_ID: number;
  SE: string;
  DC_Name: string;
  Who_Section: string;
  Where_DC_Stands_Section: string;
  Private_Label_Section: string;
  Card_Hindi: string;
  Data_Sources_Used: string[];
  Data_Sources_Skipped: string[];
  Generated_At: string;
}
