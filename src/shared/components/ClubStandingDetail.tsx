import type { ClubDetail } from "@/shared/types/planRun";

// Structured breakdown of Club_Detail (se_daily_plan_agent.normalize_dc_club(),
// confirmed 2026-08-19) - the plain-prose summary (DC_Club_Participation on Task,
// Scheme Standing on the DC Card) already carries this same data, this pulls it into
// its own callout for two questions a dense sentence answers less clearly: "if enrolled
// and outstanding is clear, where do they actually stand" (Club_Tier set - current
// tier/zone/TOD%/reward) and "if outstanding gets cleared, which scheme would they be
// eligible for and what's the benefit" (Eligible_Tier_If_Outstanding_Cleared set - the
// pitch opportunity). The two are mutually exclusive - a DC is either already tiered,
// or working towards one, never both. Shared between TaskTable's task detail row and
// DCCardPanel's Scheme Standing section - same underlying club data either way.
export function ClubStandingDetail({ club }: { club: ClubDetail | null }) {
  if (!club) return null;

  if (club.Club_Tier) {
    return (
      <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-primary">Current club standing:</span>{" "}
        {club.Club_Tier} tier
        {club.Zone && `, ${club.Zone} zone`}
        {club.TOD_Percent != null && `, ${club.TOD_Percent.toFixed(2)}% TOD`}
        {club.Reward && ` - ${club.Reward}`}
      </div>
    );
  }

  if (club.Eligible_Tier_If_Outstanding_Cleared) {
    return (
      <div className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
        <span className="font-semibold uppercase tracking-wide">If outstanding cleared - pitch point:</span>{" "}
        eligible for {club.Eligible_Tier_If_Outstanding_Cleared} tier
        {club.Eligible_Tier_TOD_Percent_If_Cleared != null && `, ${club.Eligible_Tier_TOD_Percent_If_Cleared.toFixed(2)}% TOD`}
        {club.Eligible_Tier_Reward_If_Cleared && ` - ${club.Eligible_Tier_Reward_If_Cleared}`}
      </div>
    );
  }

  // Enrolled, but not close enough for ANY tier yet - not even clearing outstanding
  // would unlock one (fixed 2026-08-19: this used to render nothing at all here,
  // leaving turnover-too-low and outstanding-not-cleared indistinguishable from each
  // other in the UI, even though the prose summary already separates them). Turnover
  // is the real gap here, not outstanding - see that field for detail.
  if (club.Is_Club_Enrolled) {
    return (
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Not yet eligible for any tier:</span>{" "}
        {club.Qualifying_Turnover != null
          ? `qualifying turnover ₹${club.Qualifying_Turnover.toLocaleString("en-IN")} this scheme year - below Copper's entry threshold.`
          : "no qualifying turnover recorded this scheme year."}
      </div>
    );
  }

  return null;
}
