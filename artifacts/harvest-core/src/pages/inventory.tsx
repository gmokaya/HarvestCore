import { useState } from "react"
import { useListIntakes, useApproveIntake, useRejectIntake } from "@workspace/api-client-react"
import { Card, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@/components/ui"
import { formatWeight } from "@/lib/utils"
import { Scale, CheckCircle2, XCircle } from "lucide-react"

export default function Inventory() {
  const { data, isLoading, refetch } = useListIntakes()
  const approveIntake = useApproveIntake()
  const rejectIntake = useRejectIntake()
  
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const handleApprove = async (intakeId: string) => {
    await approveIntake.mutateAsync({ intakeId })
    refetch()
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rejectId) return
    await rejectIntake.mutateAsync({ intakeId: rejectId, data: { reason: rejectReason } })
    setRejectId(null)
    setRejectReason("")
    refetch()
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'verified': case 'anchored': return <Badge variant="success" className="capitalize">{status}</Badge>
      case 'pending': case 'graded': case 'weighed': return <Badge variant="warning" className="capitalize">{status}</Badge>
      case 'rejected': return <Badge variant="destructive">Rejected</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading inventory...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Logistics & Inventory</h1>
          <p className="text-muted-foreground mt-1">Warehouse intake pipeline and quality grading</p>
        </div>
        <Button><Scale className="w-4 h-4 mr-2" /> New Intake</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Intake ID</TableHead>
              <TableHead>Farmer</TableHead>
              <TableHead>Commodity (Grade)</TableHead>
              <TableHead>Warehouse</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-right">Maker-Checker</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.intakes.map((intake) => (
              <TableRow key={intake.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{intake.id.split('-')[0]}</TableCell>
                <TableCell className="font-medium">{intake.farmerName}</TableCell>
                <TableCell>
                  {intake.commodity} {intake.grade && <span className="text-muted-foreground ml-1">(Grade {intake.grade})</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{intake.warehouseName}</TableCell>
                <TableCell className="text-right font-display font-medium">{formatWeight(intake.weightKg)}</TableCell>
                <TableCell className="text-center">{getStatusBadge(intake.status)}</TableCell>
                <TableCell className="text-right">
                  {['graded', 'weighed'].includes(intake.status) ? (
                    <div className="flex justify-end gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20" onClick={() => handleApprove(intake.id)} title="Verify & Anchor">
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 text-destructive hover:bg-destructive/10 border-destructive/20" onClick={() => setRejectId(intake.id)} title="Reject">
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!data?.intakes || data.intakes.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No intakes found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!rejectId} onOpenChange={(open) => !open && setRejectId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Intake Record</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Checker Notes (Reason for rejection)</Label>
              <Input 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Discrepancy in weight, poor grading..." 
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setRejectId(null)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={rejectIntake.isPending}>
                Confirm Rejection
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
