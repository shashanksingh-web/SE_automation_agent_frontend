// X-Total-Count vs the rows actually returned (see PaginatedResult, api/client.ts) -
// only renders once a list is genuinely capped, never for a full result.
export function TruncationNotice({ page }: { page: { data: unknown[]; totalCount: number } | undefined }) {
  if (!page || page.totalCount <= page.data.length) return null;
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
      Showing {page.data.length} of {page.totalCount} - narrow the filter to see more.
    </div>
  );
}
