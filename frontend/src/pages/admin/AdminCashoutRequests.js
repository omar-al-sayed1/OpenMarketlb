import React, { useEffect, useState } from 'react';
import { Banknote, Check, X, Loader2, Store, Clock, DollarSign, Search, AlertCircle, Settings, Save } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const METHOD_LABELS = { cash: 'Cash', whish: 'Wish Money', omt: 'OMT' };
const methodLabel = (m) => METHOD_LABELS[m] || m || 'Cash';

const AdminCashoutRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [minCashout, setMinCashout] = useState(5);
  const [savingMin, setSavingMin] = useState(false);

  useEffect(() => { fetchRequests(); fetchCashoutSettings(); }, [filter]);

  const fetchCashoutSettings = async () => {
    try {
      const { data } = await api.adminWallet.getCashoutSettings();
      setMinCashout(data.min_cashout_amount || 5);
    } catch {}
  };

  const handleSaveMinCashout = async () => {
    setSavingMin(true);
    try {
      await api.adminWallet.updateCashoutSettings({ min_cashout_amount: minCashout });
      toast.success(`Minimum cashout updated to $${minCashout}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update');
    } finally { setSavingMin(false); }
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.adminWallet.getCashoutRequests(filter || undefined);
      setRequests(data.requests || []);
    } catch (e) {
      console.error('Failed to fetch cashout requests', e);
      toast.error('Failed to load cash out requests');
    } finally { setLoading(false); }
  };

  const handleApprove = async (requestId) => {
    setProcessing(true);
    try {
      await api.adminWallet.approveCashout(requestId);
      toast.success('Cash out request approved');
      fetchRequests();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to approve');
    } finally { setProcessing(false); }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    setProcessing(true);
    try {
      await api.adminWallet.rejectCashout(selectedRequest.id, rejectReason);
      toast.success('Cash out request rejected, funds refunded');
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedRequest(null);
      fetchRequests();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to reject');
    } finally { setProcessing(false); }
  };

  const filteredRequests = requests.filter(r =>
    (r.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const totalPendingAmount = requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.amount || 0), 0);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'approved': return 'bg-emerald-100 text-emerald-700';
      case 'rejected': return 'bg-red-100 text-red-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl p-2.5">
              <Banknote className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Cash Out Requests</h1>
              <p className="text-slate-500 text-sm">Review and process shop cash out requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2" data-testid="min-cashout-setting">
            <Settings className="h-4 w-4 text-slate-400" />
            <span className="text-xs text-slate-500 whitespace-nowrap">Min. Cashout:</span>
            <span className="text-xs text-slate-500">$</span>
            <Input
              type="number"
              value={minCashout}
              onChange={(e) => setMinCashout(parseFloat(e.target.value) || 0)}
              className="h-7 w-20 text-sm"
              min="0"
              step="0.5"
              data-testid="min-cashout-input"
            />
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleSaveMinCashout} disabled={savingMin} data-testid="save-min-cashout">
              <Save className="h-3 w-3 mr-1" />
              {savingMin ? '...' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <span className="text-xs text-slate-500">Pending Requests</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <span className="text-xs text-slate-500">Total Pending Amount</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">${totalPendingAmount.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <Store className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs text-slate-500">Total Requests</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{requests.length}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by shop name..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {['', 'pending', 'approved', 'rejected'].map(f => (
              <Button
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter(f)}
                className={filter === f ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {f || 'All'}
              </Button>
            ))}
          </div>
        </div>

        {/* Requests Table */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <Banknote className="h-12 w-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No cash out requests found</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-4 font-medium">Shop</th>
                    <th className="text-left p-4 font-medium">Amount</th>
                    <th className="text-left p-4 font-medium">Method</th>
                    <th className="text-left p-4 font-medium">Wallet Balance</th>
                    <th className="text-left p-4 font-medium">Tier</th>
                    <th className="text-left p-4 font-medium">Contact</th>
                    <th className="text-left p-4 font-medium">Date</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRequests.map(req => (
                    <tr key={req.id} className="hover:bg-slate-50" data-testid={`cashout-row-${req.id}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          {req.shop_logo ? (
                            <img src={req.shop_logo} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <Store className="h-4 w-4 text-emerald-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium">{req.shop_name}</p>
                            <p className="text-xs text-slate-400">Revenue: ${(req.shop_total_revenue || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-lg text-emerald-600">${req.amount?.toFixed(2)}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">{methodLabel(req.method)}</span>
                        {req.method_number && <p className="text-xs text-slate-500 mt-1">{req.method_number}</p>}
                      </td>
                      <td className="p-4">
                        <span className="text-slate-600">${(req.shop_wallet_balance || 0).toFixed(2)}</span>
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${req.shop_tier === 'pro' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700'}`}>
                          {req.shop_tier || 'starter'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-slate-500">
                          {req.shop_email && <p>{req.shop_email}</p>}
                          {req.shop_phone && <p>{req.shop_phone}</p>}
                        </div>
                      </td>
                      <td className="p-4 text-xs text-slate-400">
                        {new Date(req.created_at).toLocaleDateString()}<br />
                        {new Date(req.created_at).toLocaleTimeString()}
                      </td>
                      <td className="p-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusBadge(req.status)}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {req.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                              onClick={() => handleApprove(req.id)}
                              disabled={processing}
                              data-testid={`approve-cashout-${req.id}`}
                            >
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-500 border-red-200 hover:bg-red-50 h-8 text-xs"
                              onClick={() => { setSelectedRequest(req); setRejectDialogOpen(true); }}
                              disabled={processing}
                              data-testid={`reject-cashout-${req.id}`}
                            >
                              <X className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        )}
                        {req.status !== 'pending' && (
                          <span className="text-xs text-slate-400">
                            {req.status === 'approved' ? 'Processed' : 'Refunded'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" /> Reject Cash Out
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-slate-600">
              Rejecting will refund <strong>${selectedRequest?.amount?.toFixed(2)}</strong> to <strong>{selectedRequest?.shop_name}</strong>'s wallet.
            </p>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <Textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                className="mt-1"
                rows={3}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectReason(''); }} className="flex-1">Cancel</Button>
              <Button onClick={handleReject} disabled={processing} className="flex-1 bg-red-600 hover:bg-red-700">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />} Reject & Refund
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminCashoutRequests;
