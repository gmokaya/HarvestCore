import { useState } from "react"
import { useListUsers, useApproveKyc, useRejectKyc } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, Dialog, DialogContent, DialogHeader, DialogTitle, Input, Label } from "@/components/ui"
import { ShieldCheck, UserX, FileText } from "lucide-react"

export default function Users() {
  const { data, isLoading, refetch } = useListUsers()
  const approveKyc = useApproveKyc()
  const rejectKyc = useRejectKyc()
  
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  const handleApprove = async (userId: string) => {
    await approveKyc.mutateAsync({ userId })
    refetch()
  }

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser) return
    await rejectKyc.mutateAsync({ userId: selectedUser, data: { reason: rejectReason } })
    setSelectedUser(null)
    setRejectReason("")
    refetch()
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading users...</div>

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Identity & Governance</h1>
          <p className="text-muted-foreground mt-1">Manage users, roles, and KYC verification</p>
        </div>
        <Button><ShieldCheck className="w-4 h-4 mr-2" /> Invite User</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User / Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize bg-secondary">{user.role.replace('_', ' ')}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.orgId || '—'}
                </TableCell>
                <TableCell>
                  {user.kycStatus === 'approved' && <Badge variant="success">Approved</Badge>}
                  {user.kycStatus === 'pending' && <Badge variant="warning">Pending Review</Badge>}
                  {user.kycStatus === 'rejected' && <Badge variant="destructive">Rejected</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {user.kycStatus === 'pending' && (
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleApprove(user.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setSelectedUser(user.id)}>
                        Reject
                      </Button>
                    </div>
                  )}
                  {user.kycStatus !== 'pending' && (
                    <Button size="sm" variant="ghost">View Profile</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(!data?.users || data.users.length === 0) && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject KYC Application</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleReject} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for Rejection</Label>
              <Input 
                id="reason" 
                placeholder="e.g. Document blurry, ID expired..." 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSelectedUser(null)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={rejectKyc.isPending}>
                {rejectKyc.isPending ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
