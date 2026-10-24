import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle2, XCircle, Clock, Eye, Store, Mail, MapPin, FileText, BadgeCheck, AlertTriangle, Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return dateStr; }
};

const StatusBadge = ({ status }) => {
  const config = {
    pending: { label: 'Pending Review', className: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock },
    approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
    rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.className}`} data-testid={`status-badge-${status}`}>
      <Icon className="h-3 w-3" /> {c.label}
    </span>
  );
};

export default function AdminVerificationRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const { data } = await api.admin.getVerificationRequests();
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Error fetching verification requests:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (shopId) => {
    setActionLoading(true);
    try {
      await api.admin.approveVerification(shopId);
      toast.success('Verification approved! Shop is now a Verified Seller.');
      setDetailOpen(false);
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (shopId) => {
    setActionLoading(true);
    try {
      await api.admin.rejectVerification(shopId, rejectReason || 'Does not meet requirements');
      toast.success('Verification rejected.');
      setDetailOpen(false);
      setRejectReason('');
      fetchRequests();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (req) => {
    setSelectedRequest(req);
    setDetailOpen(true);
    setRejectReason('');
  };

  const filteredRequests = filter === 'all' ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <AdminLayout>
      <div className="space-y-6 p-3 sm:p-5 lg:p-8" data-testid="admin-verification-requests-page">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-200">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Shops Verification Requests</h1>
              <p className="text-slate-500 text-xs sm:text-sm">Review and approve shop verification requests</p>
            </div>
          </div>
          {pendingCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-sm px-3 py-1">
              {pendingCount} Pending
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                filter === f.key
                  ? 'bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-md'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              data-testid={`filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <Card className="border border-slate-100">
            <CardContent className="py-16 text-center">
              <Shield className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No verification requests</p>
              <p className="text-slate-400 text-sm mt-1">Requests will appear here when shops apply for verification</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4" data-testid="verification-requests-list">
            {filteredRequests.map((req) => (
              <Card
                key={req.shop_id}
                className="border border-slate-100 hover:shadow-lg hover:border-slate-200 transition-all cursor-pointer group"
                onClick={() => openDetail(req)}
                data-testid={`verification-request-${req.shop_id}`}
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    {/* Shop Logo */}
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {req.shop?.logo ? (
                        <img src={req.shop.logo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Store className="h-6 w-6 text-slate-400" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base">{req.shop?.name || req.shop_name || 'Unknown Shop'}</h3>
                        <StatusBadge status={req.status} />
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {req.email}</span>
                        {req.shop?.state && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {req.shop.state}</span>}
                        {req.submitted_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(req.submitted_at)}</span>}
                      </div>
                    </div>

                    {/* Verification checklist icons */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${req.email_verified ? 'bg-emerald-100' : 'bg-slate-100'}`} title="Email">
                        <Mail className={`h-3.5 w-3.5 ${req.email_verified ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${req.shop?.latitude ? 'bg-emerald-100' : 'bg-slate-100'}`} title="Location">
                        <MapPin className={`h-3.5 w-3.5 ${req.shop?.latitude ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${req.document_uploaded ? 'bg-emerald-100' : 'bg-slate-100'}`} title="Document">
                        <FileText className={`h-3.5 w-3.5 ${req.document_uploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </div>
                    </div>

                    {/* Action */}
                    <Button variant="ghost" size="sm" className="text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Eye className="h-4 w-4 mr-1" /> View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="verification-detail-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-violet-600" />
                Verification Details
              </DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-5 py-2">
                {/* Shop Info */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                    {selectedRequest.shop?.logo ? (
                      <img src={selectedRequest.shop.logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Store className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{selectedRequest.shop?.name || selectedRequest.shop_name}</p>
                    <p className="text-xs text-slate-400">{selectedRequest.email} · {selectedRequest.shop?.tier || 'starter'}</p>
                  </div>
                  <div className="ml-auto"><StatusBadge status={selectedRequest.status} /></div>
                </div>

                {/* Verification Steps */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-slate-700">Verification Steps</h4>
                  <div className="space-y-2">
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedRequest.email_verified ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <Mail className={`h-5 w-5 ${selectedRequest.email_verified ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-medium flex-1">Email Verification</span>
                      {selectedRequest.email_verified ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-slate-300" />}
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedRequest.shop?.latitude && selectedRequest.shop?.longitude ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <MapPin className={`h-5 w-5 ${selectedRequest.shop?.latitude && selectedRequest.shop?.longitude ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-medium flex-1">Location Set</span>
                      {selectedRequest.shop?.latitude && selectedRequest.shop?.longitude ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-slate-300" />}
                    </div>
                    <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedRequest.document_uploaded ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                      <FileText className={`h-5 w-5 ${selectedRequest.document_uploaded ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-sm font-medium flex-1">Document Uploaded</span>
                      {selectedRequest.document_uploaded ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-slate-300" />}
                    </div>
                  </div>
                </div>

                {/* Shop Location Section */}
                {selectedRequest.shop?.latitude && selectedRequest.shop?.longitude && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">Shop Location</h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <div className="h-48 w-full">
                        <iframe
                          title="Shop Location"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          style={{ border: 0 }}
                          src={`https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${selectedRequest.shop.latitude},${selectedRequest.shop.longitude}&zoom=15`}
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                      <div className="p-3 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-500">Coordinates: {selectedRequest.shop.latitude.toFixed(5)}, {selectedRequest.shop.longitude.toFixed(5)}</p>
                            {selectedRequest.shop.location_address && <p className="text-xs text-slate-600 font-medium mt-0.5">{selectedRequest.shop.location_address}</p>}
                          </div>
                          <a
                            href={`https://www.google.com/maps?q=${selectedRequest.shop.latitude},${selectedRequest.shop.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                            data-testid="view-shop-location-btn"
                          >
                            <MapPin className="h-3 w-3" /> Open in Maps
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Preview */}
                {(selectedRequest.documents && Object.keys(selectedRequest.documents).length > 0) || selectedRequest.document_url ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700">Uploaded Documents</h4>
                    <div className="grid gap-3">
                      {selectedRequest.documents && Object.entries(selectedRequest.documents).map(([docType, url]) => (
                        <div key={docType} className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
                            <span className="text-xs font-semibold text-slate-600 capitalize">{docType.replace(/_/g, ' ')}</span>
                            <div className="flex gap-1.5">
                              <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-semibold transition-colors" data-testid={`view-doc-${docType}`}>
                                <Eye className="h-3 w-3" /> View
                              </a>
                              <a href={url} download className="flex items-center gap-1 px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-[10px] font-semibold transition-colors" data-testid={`download-doc-${docType}`}>
                                <Download className="h-3 w-3" /> Download
                              </a>
                            </div>
                          </div>
                          {url.endsWith('.pdf') ? (
                            <div className="p-4 flex items-center gap-3">
                              <FileText className="h-10 w-10 text-red-500" />
                              <span className="text-sm text-slate-600">PDF Document</span>
                            </div>
                          ) : (
                            <img src={url} alt={docType} className="w-full max-h-48 object-contain p-2" />
                          )}
                        </div>
                      ))}
                      {/* Fallback for legacy document_url */}
                      {!selectedRequest.documents && selectedRequest.document_url && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                          <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b border-slate-200">
                            <span className="text-xs font-semibold text-slate-600">Document</span>
                            <div className="flex gap-1.5">
                              <a href={selectedRequest.document_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-[10px] font-semibold transition-colors">
                                <Eye className="h-3 w-3" /> View
                              </a>
                              <a href={selectedRequest.document_url} download className="flex items-center gap-1 px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg text-[10px] font-semibold transition-colors">
                                <Download className="h-3 w-3" /> Download
                              </a>
                            </div>
                          </div>
                          {selectedRequest.document_url.endsWith('.pdf') ? (
                            <div className="p-4 flex items-center gap-3">
                              <FileText className="h-10 w-10 text-red-500" />
                              <span className="text-sm text-slate-600">PDF Document</span>
                            </div>
                          ) : (
                            <img src={selectedRequest.document_url} alt="Document" className="w-full max-h-48 object-contain p-2" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Submitted Date */}
                {selectedRequest.submitted_at && (
                  <p className="text-xs text-slate-400">Submitted: {formatDate(selectedRequest.submitted_at)}</p>
                )}

                {/* Actions */}
                {selectedRequest.status === 'pending' && (
                  <div className="space-y-3 pt-3 border-t border-slate-100">
                    <Button
                      onClick={() => handleApprove(selectedRequest.shop_id)}
                      disabled={actionLoading}
                      className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl"
                      data-testid="approve-verification-btn"
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BadgeCheck className="h-4 w-4 mr-2" />}
                      Approve Verification
                    </Button>
                    <div className="space-y-2">
                      <Input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Rejection reason (optional)"
                        className="rounded-xl"
                        data-testid="reject-reason-input"
                      />
                      <Button
                        onClick={() => handleReject(selectedRequest.shop_id)}
                        disabled={actionLoading}
                        variant="outline"
                        className="w-full h-11 border-red-200 text-red-700 hover:bg-red-50 rounded-xl"
                        data-testid="reject-verification-btn"
                      >
                        <XCircle className="h-4 w-4 mr-2" /> Reject
                      </Button>
                    </div>
                  </div>
                )}

                {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason:</p>
                    <p className="text-sm text-red-600">{selectedRequest.rejection_reason}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
