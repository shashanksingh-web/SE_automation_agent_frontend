import { useMemo, useState } from "react";
import { useHeadcount } from "@/shared/api/hooks/useHeadcount";
import { DateSelector } from "@/features/dateSelector/DateSelector";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Loader2, Search } from "lucide-react";

// §12 - Overall view: org headcount summary + breakdown by state/district/block/node.
// Ground truth (headcount_bifurcation view, SE_automation_server): buckets are plain
// email lists (se_role/abm_role/rbm_role/no_role, and by_node/by_block/by_district/
// by_state keyed by name -> email[]) - there is no display-name field for any role
// anywhere in this data model, and no single combined "role" per breakdown row.
export function OverallView() {
  const { data, isLoading } = useHeadcount(true);
  const [search, setSearch] = useState("");

  const people = useMemo(() => {
    if (!data) return [];
    const rows: Array<{ email: string; role: string }> = [];
    data.se_role.forEach((email) => rows.push({ email, role: "SE" }));
    data.abm_role.forEach((email) => rows.push({ email, role: "ABM" }));
    data.rbm_role.forEach((email) => rows.push({ email, role: "RBM" }));
    data.no_role.forEach((email) => rows.push({ email, role: "No role" }));
    return rows;
  }, [data]);

  const filteredPeople = people.filter((p) => p.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Overall</h1>
        <DateSelector />
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading headcount...
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label="Overall active" value={data.overall_total} />
            <StatCard label="SEs" value={data.se_role.length} />
            <StatCard label="ABMs" value={data.abm_role.length} />
            <StatCard label="RBMs" value={data.rbm_role.length} />
            <StatCard label="No role" value={data.no_role.length} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BreakdownCard title="By state" byKey={data.by_state} />
            <BreakdownCard title="By node" byKey={data.by_node} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                Person search
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-8 pl-7"
                    placeholder="Email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPeople.slice(0, 50).map((p) => (
                    <TableRow key={p.email}>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.role}</TableCell>
                    </TableRow>
                  ))}
                  {filteredPeople.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="py-6 text-center text-sm text-muted-foreground">
                        No matches.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredPeople.length > 50 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing 50 of {filteredPeople.length} matches - narrow your search.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({ title, byKey }: { title: string; byKey: Record<string, string[]> }) {
  const rows = Object.entries(byKey).sort((a, b) => b[1].length - a[1].length);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{title.replace("By ", "")}</TableHead>
              <TableHead>People</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 20).map(([key, emails]) => (
              <TableRow key={key}>
                <TableCell>{key}</TableCell>
                <TableCell>{emails.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 20 && (
          <p className="mt-2 text-xs text-muted-foreground">Showing top 20 of {rows.length}.</p>
        )}
      </CardContent>
    </Card>
  );
}
