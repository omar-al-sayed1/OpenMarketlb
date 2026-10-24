import React, { useEffect, useState } from 'react';
import { 
  Wallet, DollarSign, Store, Clock, CheckCircle, XCircle, Search,
  Filter, RefreshCw, ArrowUpRight, CreditCard, TrendingUp, AlertCircle, Crown
} from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AdminCreditRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundNote, setFundNote] = useState('');
  const [bulkAddOpen, setBulkAddOpen] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkNote, setBulkNote] = useState('');

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data } = await api.adminWallet.getAllRequests();
      setRequests(data.requests || []);
    } catch (error) {
      toast.error('Failed to load wallet requests');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFunds = async () => {
    if (!selectedRequest || !fundAmount) return;
    try {
      const amount = parseFloat(fundAmount);
      if (isNaN(amount) || amount <= 0) {
        toast.error('Enter a valid amount');
        return;
      }
      await api.adminWallet.addFunds(selectedRequest.shop_id, amount, fundNote || 'Admin approved credit request');
      toast.success(`Added $${amount.toFixed(2)} to ${selectedRequest.shop_name}'s wallet`);
      setAddFundsOpen(false);
      setFundAmount('');
      setFundNote('');
      setSelectedRequest(null);
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add funds');
    }
  };

  const handleBulkAdd = async () => {
    const amount = parseFloat(bulkAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    try {
      const { data } = await api.adminWallet.bulkAdd(amount, bulkNote || 'Bulk wallet top-up');
      toast.success(data.message || `Added to ${data.updated} shops`);
      setBulkAddOpen(false);
      setBulkAmount('');
      setBulkNote('');
      fetchRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    }
  };

  const filteredRequests = requests.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = !searchQuery || 
      (r.shop_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const totalRequested = requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.amount || 0), 0);

  const statusColors = {
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    fulfilled: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-screen-2xl mx-auto" data-testid="admin-credit-requests">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl text-white shadow-lg shadow-violet-200">
              <CreditCard className="h-6 w-6" />
            </div>
            Credit Requests
          </h1>
          <p className="text-slate-500 mt-1 ml-14">Manage wallet top-up requests from shops</p>
          <Button onClick={() => setBulkAddOpen(true)} className="mt-3 ml-14 bg-violet-600 hover:bg-violet-700" size="sm" data-testid="bulk-add-btn">
            <DollarSign className="h-4 w-4 mr-1" /> Add Money to All Shops
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Pending Requests</p>
                <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-violet-100">
                <DollarSign className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Requested</p>
                <p className="text-2xl font-bold text-slate-900">${totalRequested.toFixed(2)}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-100">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Requests</p>
                <p className="text-2xl font-bold text-slate-900">{requests.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by shop name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-credit-requests"
            />
          </div>
          <div className="flex gap-2">
            {['all', 'pending', 'fulfilled'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === status
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-10 h-10 border-3 border-violet-200 border-t-violet-600 rounded-full mx-auto mb-3" />
              <p className="text-slate-500">Loading requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Wallet className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No credit requests found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Shop</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tier</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Requested Amount</th>
                    <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Wallet Balance</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-center px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50/50 transition-colors" data-testid={`credit-request-${req.id}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center overflow-hidden">
                            {req.shop_logo ? (
                              <img src={req.shop_logo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Store className="h-5 w-5 text-violet-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">{req.shop_name}</p>
                            <p className="text-xs text-slate-400">ID: {req.shop_id?.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                          req.shop_tier === 'pro' 
                            ? 'bg-amber-100 text-amber-700' 
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {req.shop_tier === 'pro' && <Crown className="h-3 w-3" />}
                          {(req.shop_tier || 'starter').charAt(0).toUpperCase() + (req.shop_tier || 'starter').slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-lg font-bold text-violet-600">${(req.amount || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-slate-700">${(req.shop_wallet_balance || 0).toFixed(2)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusColors[req.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {req.status === 'pending' && <Clock className="h-3 w-3" />}
                          {(req.status === 'fulfilled' || req.status === 'completed') && <CheckCircle className="h-3 w-3" />}
                          {req.status?.charAt(0).toUpperCase() + req.status?.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {req.created_at ? new Date(req.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {req.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedRequest(req);
                              setFundAmount(String(req.amount || ''));
                              setAddFundsOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            data-testid={`approve-credit-${req.id}`}
                          >
                            <DollarSign className="h-3.5 w-3.5 mr-1" />
                            Add Funds
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add Funds Dialog */}
        <Dialog open={addFundsOpen} onOpenChange={setAddFundsOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                Add Funds to {selectedRequest?.shop_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-slate-50 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-slate-600">Current Balance</span>
                <span className="font-bold text-lg">${(selectedRequest?.shop_wallet_balance || 0).toFixed(2)}</span>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 flex justify-between items-center">
                <span className="text-sm text-amber-700">Requested Amount</span>
                <span className="font-bold text-lg text-amber-700">${(selectedRequest?.amount || 0).toFixed(2)}</span>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Amount to Add ($)</label>
                <Input
                  type="number"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="mt-1"
                  data-testid="fund-amount-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Note (optional)</label>
                <Input
                  value={fundNote}
                  onChange={(e) => setFundNote(e.target.value)}
                  placeholder="e.g., Approved credit request"
                  className="mt-1"
                />
              </div>
              <Button 
                onClick={handleAddFunds} 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                data-testid="confirm-add-funds"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Confirm & Add Funds
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Add Dialog */}
        <Dialog open={bulkAddOpen} onOpenChange={setBulkAddOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-violet-600" />
                Add Money to All Active Shops
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <p className="text-sm text-slate-500">This will add the specified amount to every active/trial shop's wallet.</p>
              <div>
                <label className="text-sm font-medium text-slate-700">Amount ($)</label>
                <Input type="number" value={bulkAmount} onChange={(e) => setBulkAmount(e.target.value)} placeholder="Enter amount" className="mt-1" data-testid="bulk-amount-input" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Note (optional)</label>
                <Input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} placeholder="e.g., Monthly bonus" className="mt-1" />
              </div>
              <Button onClick={handleBulkAdd} className="w-full bg-violet-600 hover:bg-violet-700" data-testid="confirm-bulk-add">
                <CheckCircle className="h-4 w-4 mr-2" /> Add to All Shops
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminCreditRequests;
