"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { listClinics, restoreClinic, suspendClinic } from "@/lib/actions/platform";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";

// Spec 0003 AC-8: the platform admin sees clinics and counts, never patient data.
// ponytail: list, suspend, restore only; createClinic has no form until onboarding (Feature 8).
function ClinicsManagement() {
  const queryClient = useQueryClient();
  const { data: clinics = [] } = useQuery({ queryKey: ["listClinics"], queryFn: listClinics });
  const toggle = useMutation({
    mutationFn: ({ id, suspend }: { id: string; suspend: boolean }) =>
      suspend ? suspendClinic(id) : restoreClinic(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["listClinics"] }),
    onError: (error) => alert(error.message),
  });

  return (
    <Card className="mb-12">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Clinics
        </CardTitle>
        <CardDescription>
          Suspended clinics are hidden at once and deleted after 30 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clinic</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead>Doctors</TableHead>
                <TableHead>Patients</TableHead>
                <TableHead>Appointments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clinics.map((c) => {
                const suspended = c.status === "SUSPENDED";
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-sm text-muted-foreground">{c.slug}</div>
                    </TableCell>
                    <TableCell>{c._count.branches}</TableCell>
                    <TableCell>{c._count.doctors}</TableCell>
                    <TableCell>{c._count.patients}</TableCell>
                    <TableCell>{c._count.appointments}</TableCell>
                    <TableCell>
                      {suspended ? (
                        <Badge variant="destructive">
                          Suspended {c.suspendedAt?.toLocaleDateString()}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {c.slug !== "demo" && (
                        <Button
                          size="sm"
                          variant={suspended ? "outline" : "destructive"}
                          disabled={toggle.isPending}
                          onClick={() => {
                            if (suspended || confirm(`Suspend ${c.name}?`)) {
                              toggle.mutate({ id: c.id, suspend: !suspended });
                            }
                          }}
                        >
                          {suspended ? "Restore" : "Suspend"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export default ClinicsManagement;
