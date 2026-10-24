import React, { useEffect, useState } from 'react';
import { Search, Eye, Trash2, Mail, Clock, CheckCircle, XCircle, Image as ImageIcon, HelpCircle, Bug, Lightbulb, AlertTriangle, Handshake, Filter, MessageCircle, ExternalLink } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const MESSAGE_TYPE_CONFIG = {
  general: { label: 'General Inquiry', icon: HelpCircle, color: 'violet', bgColor: 'bg-violet-100', textColor: 'text-violet-700', borderColor: 'border-violet-200' },
  bug: { label: 'Bug Report', icon: Bug, color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-200' },
  suggestion: { label: 'Suggestion', icon: Lightbulb, color: 'amber', bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
  complaint: { label: 'Complaint', icon: AlertTriangle, color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
  partnership: { label: 'Partnership', icon: Handshake, color: 'emerald', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
};

const STATUS_CONFIG = {
  new: { label: 'New', icon: Mail, bgColor: 'bg-blue-100', textColor: 'text-blue-700' },
  read: { label: 'Read', icon: Eye, bgColor: 'bg-slate-100', textColor: 'text-slate-700' },
  resolved: { label: 'Resolved', icon: CheckCircle, bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' },
  dismissed: { label: 'Dismissed', icon: XCircle, bgColor: 'bg-red-100', textColor: 'text-red-600' },
};

const AdminContactMessages = () => {
  const [messages, setMessages] = useState([]);
  const [filteredMessages, setFilteredMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    filterMessages();
  }, [searchQuery, typeFilter, statusFilter, messages]);

  const fetchMessages = async () => {
    try {
      const { data } = await api.admin.getContactMessages();
      // Sort newest first
      const sorted = data.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      setMessages(sorted);
      setFilteredMessages(sorted);
    } catch (error) {
      console.error('Failed to fetch contact messages', error);
    } finally {
      setLoading(false);
    }
  };

  const filterMessages = () => {
    let filtered = [...messages];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        (m.name || '').toLowerCase().includes(query) ||
        (m.email || '').toLowerCase().includes(query) ||
        (m.message || '').toLowerCase().includes(query)
      );
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(m => m.message_type === typeFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => (m.status || 'new') === statusFilter);
    }

    setFilteredMessages(filtered);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredMessages.length / ITEMS_PER_PAGE);
  const paginatedMessages = filteredMessages.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleStatusChange = async (messageId, newStatus) => {
    try {
      await api.admin.updateMessageStatus(messageId, newStatus);
      toast.success('Status updated');
      fetchMessages();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleViewDetails = (message) => {
    setSelectedMessage(message);
    setDetailsOpen(true);
    // Mark as read if new
    if (!message.status || message.status === 'new') {
      handleStatusChange(message.id, 'read');
    }
  };

  const getTypeConfig = (type) => MESSAGE_TYPE_CONFIG[type] || MESSAGE_TYPE_CONFIG.general;
  const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.new;

  // Count by type
  const typeCounts = {
    all: messages.length,
    general: messages.filter(m => m.message_type === 'general').length,
    bug: messages.filter(m => m.message_type === 'bug').length,
    suggestion: messages.filter(m => m.message_type === 'suggestion').length,
    complaint: messages.filter(m => m.message_type === 'complaint').length,
    partnership: messages.filter(m => m.message_type === 'partnership').length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-[80vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
            <p className="text-sm text-slate-400">Loading messages...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-1 sm:p-2 lg:p-4 admin-table-page compact-table" data-testid="admin-contact-messages-content">
        <div className="flex items-center justify-between mb-6 lg:mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-heading font-bold" data-testid="admin-contact-messages-title">Contact Messages</h1>
            <p className="text-slate-500 text-sm mt-1">View and manage messages from the contact form</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full text-sm font-medium">
              {messages.filter(m => !m.status || m.status === 'new').length} New
            </div>
          </div>
        </div>

        {/* Type Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'all', label: 'All', icon: Filter },
            { key: 'general', label: 'General', icon: HelpCircle },
            { key: 'bug', label: 'Bugs', icon: Bug },
            { key: 'suggestion', label: 'Suggestions', icon: Lightbulb },
            { key: 'complaint', label: 'Complaints', icon: AlertTriangle },
            { key: 'partnership', label: 'Partnership', icon: Handshake },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                typeFilter === key
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              data-testid={`filter-type-${key}`}
            >
              <Icon className="h-3 w-3" />
              {label}
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${typeFilter === key ? 'bg-white/20' : 'bg-slate-100'}`}>
                {typeCounts[key] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Search + Status Filter */}
        <div className="mb-6 bg-white rounded-xl p-4 shadow-card">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search by name, email, or message content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="contact-messages-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44" data-testid="contact-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>Showing {paginatedMessages.length} of {filteredMessages.length} messages</span>
            {(searchQuery || typeFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setTypeFilter('all'); setStatusFilter('all'); }}
                className="text-violet-600 hover:text-violet-700 font-medium"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Messages Table */}
        <div className="bg-white rounded-xl shadow-card overflow-hidden" data-testid="contact-messages-table">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Sender</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Phone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Message</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Photo</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedMessages.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-500">
                      <MessageCircle className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                      <p>No contact messages found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedMessages.map((message) => {
                    const typeConfig = getTypeConfig(message.message_type);
                    const statusConfig = getStatusConfig(message.status || 'new');
                    const TypeIcon = typeConfig.icon;
                    const StatusIcon = statusConfig.icon;

                    return (
                      <tr key={message.id} className={`hover:bg-slate-50 transition-colors ${(!message.status || message.status === 'new') ? 'bg-blue-50/30' : ''}`} data-testid={`contact-msg-row-${message.id}`}>
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.textColor}`}>
                            <TypeIcon className="h-3 w-3" />
                            {typeConfig.label}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-sm">{message.name}</div>
                            <div className="text-xs text-slate-500">{message.email}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-600">{message.phone_number || '-'}</div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-sm text-slate-600 truncate max-w-[250px]">{message.message}</p>
                        </td>
                        <td className="px-6 py-4">
                          {message.photo ? (
                            <img src={message.photo} alt="Attached" className="w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => handleViewDetails(message)} />
                          ) : (
                            <span className="text-slate-300 text-sm">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {new Date(message.created_at).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Select value={message.status || 'new'} onValueChange={(value) => handleStatusChange(message.id, value)}>
                            <SelectTrigger className="w-32 h-8 text-xs" data-testid="contact-msg-status">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">New</SelectItem>
                              <SelectItem value="read">Read</SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="dismissed">Dismissed</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(message)}
                            data-testid="view-contact-msg-btn"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum;
              if (totalPages <= 7) pageNum = i + 1;
              else if (currentPage <= 4) pageNum = i + 1;
              else if (currentPage >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = currentPage - 3 + i;
              return (
                <Button key={pageNum} variant={currentPage === pageNum ? 'default' : 'outline'} size="sm" onClick={() => setCurrentPage(pageNum)} className={currentPage === pageNum ? 'bg-violet-600' : ''}>
                  {pageNum}
                </Button>
              );
            })}
            <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
          </div>
        )}

        {/* Message Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="contact-message-details-dialog">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-violet-600" />
                Message Details
              </DialogTitle>
            </DialogHeader>
            {selectedMessage && (() => {
              const typeConfig = getTypeConfig(selectedMessage.message_type);
              const TypeIcon = typeConfig.icon;
              return (
                <div className="space-y-6 py-2">
                  {/* Header Info */}
                  <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${typeConfig.bgColor} ${typeConfig.textColor}`}>
                      <TypeIcon className="h-4 w-4" />
                      {typeConfig.label}
                    </div>
                    <span className="text-sm text-slate-500">
                      {new Date(selectedMessage.created_at).toLocaleString()}
                    </span>
                  </div>

                  {/* Sender Info */}
                  <div className={`bg-slate-50 rounded-xl p-5 border ${typeConfig.borderColor}`}>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Name</p>
                        <p className="font-semibold text-slate-800">{selectedMessage.name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-1">Email</p>
                        <a href={`mailto:${selectedMessage.email}`} className="font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1">
                          {selectedMessage.email}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {selectedMessage.phone_number && (
                        <div>
                          <p className="text-xs text-slate-500 mb-1">Phone</p>
                          <p className="font-semibold text-slate-800">{selectedMessage.phone_number}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message Content */}
                  <div>
                    <p className="text-xs text-slate-500 mb-2">Message</p>
                    <div className="bg-white border rounded-xl p-5 whitespace-pre-wrap text-slate-700 leading-relaxed">
                      {selectedMessage.message}
                    </div>
                  </div>

                  {/* Photo Attachment */}
                  {selectedMessage.photo && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2 flex items-center gap-1.5">
                        <ImageIcon className="h-3 w-3" />
                        Attached Photo
                      </p>
                      <div className="border rounded-xl overflow-hidden bg-slate-50">
                        <img
                          src={selectedMessage.photo}
                          alt="Attached"
                          className="w-full max-h-96 object-contain"
                        />
                      </div>
                    </div>
                  )}

                  {/* Status Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { handleStatusChange(selectedMessage.id, 'resolved'); setDetailsOpen(false); }}
                      className="flex-1 text-emerald-600 hover:bg-emerald-50 border-emerald-200"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Resolved
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { handleStatusChange(selectedMessage.id, 'dismissed'); setDetailsOpen(false); }}
                      className="flex-1 text-red-600 hover:bg-red-50 border-red-200"
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Dismiss
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`mailto:${selectedMessage.email}?subject=Re: ${getTypeConfig(selectedMessage.message_type).label} - OpenMarketlb`, '_blank')}
                      className="flex-1 text-violet-600 hover:bg-violet-50 border-violet-200"
                    >
                      <Mail className="h-4 w-4 mr-1" />
                      Reply via Email
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminContactMessages;
