import React, { useEffect, useState } from 'react';
import { Mail, User as UserIcon, Search, Trash2, Plus, Store, Shield, Truck, Filter, X, Edit, Gift, Star, ShoppingBag, RefreshCw, Phone, Ban, MessageSquareOff, Briefcase, UserCheck } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StateSelect from '../../components/StateSelect';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [messagingFilter, setMessagingFilter] = useState('all');
  const [verifiedFilter, setVerifiedFilter] = useState('all');
  const [deletingUser, setDeletingUser] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pointsDialogOpen, setPointsDialogOpen] = useState(false);
  const [pointsEditUser, setPointsEditUser] = useState(null);
  const [newPointsBalance, setNewPointsBalance] = useState(0);
  const [newTier, setNewTier] = useState('');
  const [savingPoints, setSavingPoints] = useState(false);
  const [userOrdersDialog, setUserOrdersDialog] = useState(null);
  const [userOrders, setUserOrders] = useState([]);
  const [loadingUserOrders, setLoadingUserOrders] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('newest');
  const ITEMS_PER_PAGE = 15;
  const [newUser, setNewUser] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'user',
    phone: '',
    phone_verified: false,
    city: '',
    state: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [searchQuery, roleFilter, statusFilter, stateFilter, tierFilter, messagingFilter, verifiedFilter, sortBy, users]);

  const filterUsers = () => {
    let filtered = users;
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (statusFilter === 'online') {
      filtered = filtered.filter(user => user.is_online);
    } else if (statusFilter === 'offline') {
      filtered = filtered.filter(user => !user.is_online);
    }

    if (stateFilter !== 'all') {
      filtered = filtered.filter(user => (user.state || '') === stateFilter);
    }

    if (tierFilter !== 'all') {
      filtered = filtered.filter(user => (user.loyalty_tier || 'Bronze') === tierFilter);
    }

    if (messagingFilter === 'blocked') {
      filtered = filtered.filter(user => user.messaging_blocked);
    } else if (messagingFilter === 'allowed') {
      filtered = filtered.filter(user => !user.messaging_blocked);
    }

    if (verifiedFilter === 'verified') {
      filtered = filtered.filter(user => user.phone_verified);
    } else if (verifiedFilter === 'unverified') {
      filtered = filtered.filter(user => !user.phone_verified);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(user => 
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query) ||
        (user.phone && user.phone.toLowerCase().includes(query)) ||
        (user.city && user.city.toLowerCase().includes(query))
      );
    }
    
    // Sort
    filtered = [...filtered];
    switch (sortBy) {
      case 'newest': filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')); break;
      case 'oldest': filtered.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')); break;
      case 'name_asc': filtered.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
      case 'name_desc': filtered.sort((a, b) => (b.name || '').localeCompare(a.name || '')); break;
      default: break;
    }
    
    setFilteredUsers(filtered);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const fetchUsers = async () => {
    try {
      const { data } = await api.admin.getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastSeen = (ts) => {
    if (!ts) return 'Never';
    const date = new Date(ts);
    const diff = Date.now() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const handleToggleBlock = async (user) => {
    const entityType = user.role === 'shop' ? 'shop' : 'customer';
    const entityId = user.role === 'shop' ? user.shop_id : user.id;
    if (!entityId) { toast.error('Cannot resolve entity to block'); return; }
    try {
      if (user.messaging_blocked) {
        await api.messages.adminUnblock({ entity_type: entityType, entity_id: entityId });
        toast.success(`${user.name} can message again`);
      } else {
        await api.messages.adminBlock({ entity_type: entityType, entity_id: entityId });
        toast.success(`${user.name} blocked from messaging`);
      }
      fetchUsers();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Action failed');
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    setDeletingUser(userId);
    try {
      await api.admin.deleteUser(userId);
      toast.success(`User "${userName}" deleted successfully`);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete user');
    } finally {
      setDeletingUser(null);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...newUser,
        name: `${newUser.first_name} ${newUser.last_name}`.trim(),
      };
      await api.admin.createUser(payload);
      toast.success(`${newUser.role.charAt(0).toUpperCase() + newUser.role.slice(1)} created successfully!`);
      setCreateDialogOpen(false);
      setNewUser({ first_name: '', last_name: '', email: '', password: '', role: 'user', phone: '', phone_verified: false, city: '', state: '' });
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleEditUser = (user) => {
    // Split name into first/last for UI - keep original as fallback
    const parts = (user.name || '').trim().split(/\s+/);
    const first_name = user.first_name || parts[0] || '';
    const last_name = user.last_name || (parts.length > 1 ? parts.slice(1).join(' ') : '');
    setEditingUser({
      ...user,
      first_name,
      last_name,
      password: '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const first_name = (editingUser.first_name || '').trim();
      const last_name = (editingUser.last_name || '').trim();
      const combinedName = `${first_name} ${last_name}`.trim();
      const payload = {
        name: combinedName || editingUser.name,
        first_name,
        last_name,
        email: editingUser.email,
        phone: editingUser.phone || '',
        city: editingUser.city || '',
        state: editingUser.state || '',
        role: editingUser.role,
      };
      if (editingUser.password && editingUser.password.trim()) {
        payload.password = editingUser.password;
      }
      await api.admin.updateUser(editingUser.id, payload);
      toast.success('User updated successfully!');
      setEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPoints = (user) => {
    setPointsEditUser(user);
    setNewPointsBalance(user.loyalty_points_balance || 0);
    setNewTier(user.loyalty_tier || 'Bronze');
    setPointsDialogOpen(true);
  };

  const handleSavePoints = async () => {
    if (!pointsEditUser) return;
    setSavingPoints(true);
    try {
      const data = { loyalty_points_balance: newPointsBalance };
      if (newTier !== (pointsEditUser.loyalty_tier || 'Bronze')) {
        data.loyalty_tier = newTier;
      }
      await api.admin.updateUserPoints(pointsEditUser.id, data);
      toast.success(`Loyalty updated for ${pointsEditUser.name}`);
      setPointsDialogOpen(false);
      setPointsEditUser(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update loyalty');
    } finally {
      setSavingPoints(false);
    }
  };

  const viewUserOrders = async (user) => {
    setLoadingUserOrders(true);
    setUserOrdersDialog(user);
    try {
      const { data } = await api.admin.getUserOrders(user.id);
      setUserOrders(data);
    } catch (error) {
      toast.error('Failed to load user orders');
    } finally {
      setLoadingUserOrders(false);
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4 text-red-500" />;
      case 'shop': return <Store className="h-4 w-4 text-emerald-500" />;
      case 'delivery': return <Truck className="h-4 w-4 text-blue-500" />;
      default: return <UserIcon className="h-4 w-4 text-violet-500" />;
    }
  };

  const getRoleBadge = (role) => {
    const styles = {
      admin: 'bg-red-100 text-red-700',
      shop: 'bg-emerald-100 text-emerald-700',
      delivery: 'bg-blue-100 text-blue-700',
      user: 'bg-violet-100 text-violet-700'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[role] || styles.user}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  // Count users by role
  const roleCounts = {
    all: users.length,
    user: users.filter(u => u.role === 'user').length,
    shop: users.filter(u => u.role === 'shop').length,
    agent: users.filter(u => u.role === 'agent').length,
    delivery: users.filter(u => u.role === 'delivery').length,
    admin: users.filter(u => u.role === 'admin').length,
    employee: users.filter(u => u.role === 'employee').length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-2 sm:p-4 lg:p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="h-10 w-36 bg-slate-200 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-slate-200 rounded-full animate-pulse" />
          </div>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 w-24 bg-slate-200 rounded-full animate-pulse" />
            ))}
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="h-10 w-full bg-slate-200 rounded-lg animate-pulse" />
          </div>
          <div className="bg-white rounded-xl shadow-sm">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-slate-100 animate-pulse">
                <div className="h-9 w-9 bg-slate-200 rounded-full" />
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-5 w-16 bg-slate-200 rounded-full" />
                <div className="h-4 w-36 bg-slate-200 rounded" />
                <div className="h-4 w-20 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-1 sm:p-2 lg:p-4 admin-table-page compact-table" data-testid="admin-users-content">
        <div className="flex items-center justify-between mb-6 lg:mb-8 flex-wrap gap-4">
          <h1 className="text-3xl lg:text-4xl font-heading font-bold" data-testid="admin-users-title">Users</h1>
          
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-full" data-testid="add-user-btn">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-first-name">First Name *</Label>
                    <Input
                      id="new-first-name"
                      value={newUser.first_name}
                      onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                      required
                      placeholder="First Name"
                      data-testid="new-user-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-last-name">Last Name *</Label>
                    <Input
                      id="new-last-name"
                      value={newUser.last_name}
                      onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                      required
                      placeholder="Last Name"
                      data-testid="new-user-last-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="new-email">Email *</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                    placeholder="email@example.com"
                    data-testid="new-user-email"
                  />
                </div>
                <div>
                  <Label htmlFor="new-password">Password *</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    required
                    placeholder="Min 8 characters"
                    data-testid="new-user-password"
                  />
                </div>
                <div>
                  <Label htmlFor="new-role">Role *</Label>
                  <Select value={newUser.role} onValueChange={(val) => setNewUser({ ...newUser, role: val })}>
                    <SelectTrigger data-testid="new-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-violet-500" />
                          Customer
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-500" />
                          Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="delivery">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-blue-500" />
                          Delivery
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="new-phone">Phone</Label>
                  <Input
                    id="new-phone"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="+961 71 234 567"
                    data-testid="new-user-phone"
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="new-phone-verified"
                      checked={newUser.phone_verified}
                      onCheckedChange={(checked) => setNewUser({ ...newUser, phone_verified: !!checked })}
                      data-testid="new-user-phone-verified"
                    />
                    <Label htmlFor="new-phone-verified" className="text-xs text-slate-600 cursor-pointer flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Verified
                    </Label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="new-city">City</Label>
                    <Input
                      id="new-city"
                      value={newUser.city}
                      onChange={(e) => setNewUser({ ...newUser, city: e.target.value })}
                      data-testid="new-user-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-state">State</Label>
                    <StateSelect
                      value={newUser.state}
                      onChange={(val) => setNewUser({ ...newUser, state: val })}
                      data-testid="new-user-state"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                  data-testid="create-user-submit"
                >
                  {creating ? 'Creating...' : 'Create User'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Role Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'user', 'shop', 'agent', 'delivery', 'admin', 'employee'].map((role) => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                roleFilter === role
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
              data-testid={`filter-${role}`}
            >
              {role === 'all' && <Filter className="h-3 w-3" />}
              {role === 'user' && <UserIcon className="h-3 w-3" />}
              {role === 'shop' && <Store className="h-3 w-3" />}
              {role === 'agent' && <UserCheck className="h-3 w-3" />}
              {role === 'admin' && <Shield className="h-3 w-3" />}
              {role === 'delivery' && <Truck className="h-3 w-3" />}
              {role === 'employee' && <Briefcase className="h-3 w-3" />}
              {role === 'all' ? 'All' : role.charAt(0).toUpperCase() + role.slice(1)}
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${roleFilter === role ? 'bg-white/20' : 'bg-slate-100'}`}>
                {roleCounts[role]}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-6 bg-white rounded-xl p-4 shadow-card">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                placeholder="Search by name, email, phone, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="users-search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-36" data-testid="users-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="users-state-filter"><SelectValue placeholder="State" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {Array.from(new Set(users.map(u => u.state).filter(Boolean))).sort().map((st) => (
                  <SelectItem key={st} value={st}>{st}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-full sm:w-36" data-testid="users-tier-filter"><SelectValue placeholder="Loyalty Tier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Bronze">Bronze</SelectItem>
                <SelectItem value="Silver">Silver</SelectItem>
                <SelectItem value="Gold">Gold</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="users-verified-filter"><SelectValue placeholder="Phone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Phone: Any</SelectItem>
                <SelectItem value="verified">Phone Verified</SelectItem>
                <SelectItem value="unverified">Phone Unverified</SelectItem>
              </SelectContent>
            </Select>
            <Select value={messagingFilter} onValueChange={setMessagingFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="users-messaging-filter"><SelectValue placeholder="Messaging" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Messaging: Any</SelectItem>
                <SelectItem value="allowed">Can Message</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-44" data-testid="users-sort"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="name_asc">Name A-Z</SelectItem>
                <SelectItem value="name_desc">Name Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
            <span>Showing {paginatedUsers.length} of {filteredUsers.length} users</span>
            {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || stateFilter !== 'all' || tierFilter !== 'all' || messagingFilter !== 'all' || verifiedFilter !== 'all') && (
              <button
                onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); setStateFilter('all'); setTierFilter('all'); setMessagingFilter('all'); setVerifiedFilter('all'); }}
                className="font-semibold text-violet-600 hover:text-violet-800 flex items-center gap-1"
                data-testid="users-clear-filters"
              >
                <X className="h-3 w-3" /> Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-card overflow-hidden" data-testid="users-table">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">User</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Role</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Email</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Phone</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Location</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Details</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Points</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedUsers.map((user) => (
                  <tr key={user.id} data-testid={`user-row-${user.id}`} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full p-2 ${
                          user.role === 'admin' ? 'bg-red-100' :
                          user.role === 'shop' ? 'bg-emerald-100' :
                          user.role === 'delivery' ? 'bg-blue-100' : 'bg-violet-100'
                        }`}>
                          {getRoleIcon(user.role)}
                        </div>
                        <span className="font-medium" data-testid="user-name">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2" data-testid={`user-status-${user.id}`}>
                        <span className={`relative flex h-2.5 w-2.5 ${user.is_online ? '' : 'opacity-60'}`}>
                          {user.is_online && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${user.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        </span>
                        <div className="text-xs">
                          <p className={`font-medium ${user.is_online ? 'text-emerald-600' : 'text-slate-500'}`}>{user.is_online ? 'Online' : 'Offline'}</p>
                          <p className="text-[10px] text-slate-400">{formatLastSeen(user.last_seen)}</p>
                        </div>
                        {user.messaging_blocked && (
                          <span className="ml-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-semibold" title="Blocked from messaging"><Ban className="h-3 w-3" /> Blocked</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-slate-400" />
                        <span data-testid="user-email" className="text-sm">{user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm" data-testid="user-phone">{user.phone || '-'}</td>
                    <td className="px-6 py-4 text-sm">
                      {user.city || user.state ? `${user.city || ''}${user.city && user.state ? ', ' : ''}${user.state || ''}` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {user.role === 'shop' && user.shop_name && (
                        <div className="text-xs">
                          <p className="font-medium text-emerald-700">{user.shop_name}</p>
                          <p className="text-slate-500">{user.subscription_status || 'N/A'}</p>
                        </div>
                      )}
                      {user.role !== 'shop' && '-'}
                    </td>
                    <td className="px-6 py-4">
                      {(user.role === 'user' || user.role === 'shop') ? (
                        <div className="flex items-center gap-2">
                          <div className="text-center">
                            <p className="font-semibold text-amber-600" data-testid="user-points">{(user.loyalty_points_balance || 0).toLocaleString()}</p>
                            <p className="text-[10px] text-slate-400">{user.loyalty_tier || 'Bronze'}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-7 w-7 p-0"
                            onClick={() => handleEditPoints(user)}
                            data-testid={`edit-points-${user.id}`}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        {user.role === 'user' && (
                          <Button variant="ghost" size="sm" className="text-violet-600 hover:text-violet-700 hover:bg-violet-50" onClick={() => viewUserOrders(user)} data-testid={`view-orders-${user.id}`} title="View Orders">
                            <ShoppingBag className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleEditUser(user)} data-testid="edit-user-btn">
                          <Edit className="h-4 w-4" />
                        </Button>
                        {(user.role === 'user' || user.role === 'shop') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={user.messaging_blocked ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50' : 'text-amber-600 hover:text-amber-700 hover:bg-amber-50'}
                            onClick={() => handleToggleBlock(user)}
                            data-testid={`toggle-block-${user.id}`}
                            title={user.messaging_blocked ? 'Unblock messaging' : 'Block from messaging'}
                          >
                            {user.messaging_blocked ? <MessageSquareOff className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </Button>
                        )}
                      {user.role !== 'admin' ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" data-testid="delete-user-btn">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{user.name}</strong> ({user.email})?
                                <br /><br />
                                This action cannot be undone. The user's cart and wishlist will also be deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id, user.name)}
                                className="bg-red-600 hover:bg-red-700"
                                disabled={deletingUser === user.id}
                              >
                                {deletingUser === user.id ? 'Deleting...' : 'Delete User'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-xs text-slate-400">Protected</span>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
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

        {filteredUsers.length === 0 && (
          <div className="bg-white rounded-xl shadow-card p-12 text-center mt-6" data-testid="no-users">
            <UserIcon className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">
              {searchQuery || roleFilter !== 'all' || statusFilter !== 'all' || stateFilter !== 'all' || tierFilter !== 'all' || messagingFilter !== 'all' || verifiedFilter !== 'all' ? 'No users match your filters' : 'No users registered yet'}
            </p>
          </div>
        )}

        {/* Edit User Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="edit-first-name">First Name *</Label>
                    <Input
                      id="edit-first-name"
                      value={editingUser.first_name || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, first_name: e.target.value })}
                      required
                      data-testid="edit-user-first-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-last-name">Last Name</Label>
                    <Input
                      id="edit-last-name"
                      value={editingUser.last_name || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, last_name: e.target.value })}
                      data-testid="edit-user-last-name"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    required
                    data-testid="edit-user-email"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    value={editingUser.password || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                    placeholder="Leave blank to keep current"
                    data-testid="edit-user-password"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select value={editingUser.role} onValueChange={(val) => setEditingUser({ ...editingUser, role: val })}>
                    <SelectTrigger data-testid="edit-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-4 w-4 text-violet-500" />
                          Customer
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-red-500" />
                          Admin
                        </div>
                      </SelectItem>
                      <SelectItem value="delivery">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-blue-500" />
                          Delivery
                        </div>
                      </SelectItem>
                      <SelectItem value="shop">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-emerald-500" />
                          Shop
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-phone">Phone</Label>
                  <Input
                    id="edit-phone"
                    value={editingUser.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    data-testid="edit-user-phone"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit-city">City</Label>
                    <Input
                      id="edit-city"
                      value={editingUser.city || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, city: e.target.value })}
                      data-testid="edit-user-city"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit-state">State</Label>
                    <Input
                      id="edit-state"
                      value={editingUser.state || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, state: e.target.value })}
                      data-testid="edit-user-state"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600"
                  data-testid="save-user-edit"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Points Edit Dialog */}
        <Dialog open={pointsDialogOpen} onOpenChange={setPointsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-amber-500" />
                Edit Loyalty Points
              </DialogTitle>
            </DialogHeader>
            {pointsEditUser && (
              <div className="space-y-4 py-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600">User: <strong>{pointsEditUser.name}</strong></p>
                  <p className="text-sm text-slate-600">Email: {pointsEditUser.email}</p>
                  <p className="text-sm text-slate-600">Current Balance: <span className="font-semibold">{(pointsEditUser.loyalty_points_balance || 0).toLocaleString()} pts</span></p>
                  <p className="text-sm text-slate-600">Lifetime Points: <span className="font-semibold">{(pointsEditUser.loyalty_points_lifetime || 0).toLocaleString()} pts</span></p>
                </div>
                <div>
                  <Label htmlFor="new-tier">Loyalty Tier</Label>
                  <Select value={newTier} onValueChange={setNewTier}>
                    <SelectTrigger className="mt-1" data-testid="tier-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Bronze">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Bronze (1x points)</span>
                      </SelectItem>
                      <SelectItem value="Silver">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400" /> Silver (1.5x points)</span>
                      </SelectItem>
                      <SelectItem value="Gold">
                        <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /> Gold (2x points)</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {newTier !== (pointsEditUser.loyalty_tier || 'Bronze') && (
                    <p className="text-xs text-violet-600 mt-1 font-medium">
                      Tier change: {pointsEditUser.loyalty_tier || 'Bronze'} → {newTier}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="new-points">Points Balance</Label>
                  <Input
                    id="new-points"
                    type="number"
                    min={0}
                    value={newPointsBalance}
                    onChange={(e) => setNewPointsBalance(parseInt(e.target.value) || 0)}
                    className="mt-1"
                    data-testid="new-points-input"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {newPointsBalance > (pointsEditUser.loyalty_points_balance || 0)
                      ? `Adding ${newPointsBalance - (pointsEditUser.loyalty_points_balance || 0)} points`
                      : newPointsBalance < (pointsEditUser.loyalty_points_balance || 0)
                      ? `Removing ${(pointsEditUser.loyalty_points_balance || 0) - newPointsBalance} points`
                      : 'No change'}
                  </p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPointsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePoints} disabled={savingPoints} className="bg-amber-600 hover:bg-amber-700" data-testid="save-points-btn">
                {savingPoints ? 'Saving...' : 'Update Loyalty'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* User Orders Dialog */}
        <Dialog open={!!userOrdersDialog} onOpenChange={(open) => { if (!open) setUserOrdersDialog(null); }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-violet-600" />
                Orders by {userOrdersDialog?.name}
              </DialogTitle>
            </DialogHeader>
            {loadingUserOrders ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : userOrders.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">No orders found for this user</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-500">{userOrders.length} order(s)</p>
                {userOrders.map((order) => (
                  <div key={order.id} className="border rounded-xl p-4 hover:bg-slate-50 transition-colors" data-testid={`user-order-${order.id}`}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-slate-400">#{order.id.slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          order.order_status === 'cancelled' ? 'bg-red-100 text-red-700' :
                          order.order_status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                          order.order_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          order.order_status === 'shipped' ? 'bg-cyan-100 text-cyan-700' :
                          order.order_status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                          'bg-indigo-100 text-indigo-700'
                        }`}>
                          {order.order_status}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {order.payment_method} - {order.payment_status}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">${order.total_amount?.toFixed(2)}</p>
                        <p className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Order Details - Delivery Info */}
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/80 rounded-lg p-3">
                      {(order.customer_name || order.guest_name) && (
                        <div className="text-xs"><span className="text-slate-400">Customer:</span> <span className="font-medium text-slate-700">{order.customer_name || order.guest_name}</span></div>
                      )}
                      {(order.customer_email || order.guest_email) && (
                        <div className="text-xs"><span className="text-slate-400">Email:</span> <span className="font-medium text-slate-700">{order.customer_email || order.guest_email}</span></div>
                      )}
                      {(order.delivery_address || order.guest_address) && (
                        <div className="text-xs col-span-full"><span className="text-slate-400">Address:</span> <span className="font-medium text-slate-700">{order.delivery_address || order.guest_address}{order.delivery_city || order.guest_city ? `, ${order.delivery_city || order.guest_city}` : ''}{order.delivery_state || order.guest_state ? `, ${order.delivery_state || order.guest_state}` : ''}</span></div>
                      )}
                      {(order.customer_phone || order.guest_phone) && (
                        <div className="text-xs"><span className="text-slate-400">Phone:</span> <span className="font-medium text-slate-700">{order.customer_phone || order.guest_phone}</span></div>
                      )}
                      {order.delivery_fee > 0 && (
                        <div className="text-xs"><span className="text-slate-400">Delivery Fee:</span> <span className="font-medium text-slate-700">${order.delivery_fee?.toFixed(2)}</span></div>
                      )}
                      {order.commission_amount > 0 && (
                        <div className="text-xs"><span className="text-slate-400">Commission:</span> <span className="font-medium text-red-600">${order.commission_amount?.toFixed(2)}</span></div>
                      )}
                    </div>

                    {/* Order Items */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 text-xs">
                          {item.image && <img src={item.image} alt="" className="w-8 h-8 rounded object-cover" />}
                          <div>
                            <p className="font-medium truncate max-w-[150px]">{item.name}</p>
                            <p className="text-slate-400">x{item.quantity} | ${item.subtotal?.toFixed(2)}</p>
                            {item.size && <span className="text-[10px] text-violet-500">Size: {item.size}</span>}
                            {item.color && <span className="text-[10px] text-violet-500 ml-1">Color: {item.color}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {order.loyalty_points_redeemed > 0 && (
                      <div className="mt-2 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-lg inline-block">
                        {order.loyalty_points_redeemed} pts redeemed (-${(order.loyalty_discount_amount || 0).toFixed(2)})
                      </div>
                    )}
                    {order.notes && (
                      <div className="mt-2 text-xs text-slate-500 italic bg-slate-50 px-2 py-1 rounded">Note: {order.notes}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
