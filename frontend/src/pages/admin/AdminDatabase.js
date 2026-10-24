import React, { useEffect, useState, useCallback } from 'react';
import { Database, Table2, RefreshCw, Search, ChevronLeft, ChevronRight, X, Layers, FileText, Hash, Eye, Loader2, KeyRound, Server } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import AdminLayout from '../../components/AdminLayout';
import { api } from '../../lib/api';
import { toast } from 'sonner';

const typeColor = (t) => {
  if (!t) return 'bg-slate-100 text-slate-600';
  if (t.includes('string')) return 'bg-blue-50 text-blue-600 border border-blue-100';
  if (t.includes('integer') || t.includes('float')) return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
  if (t.includes('boolean')) return 'bg-amber-50 text-amber-600 border border-amber-100';
  if (t.includes('array')) return 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100';
  if (t.includes('object')) return 'bg-violet-50 text-violet-600 border border-violet-100';
  if (t.includes('null')) return 'bg-slate-100 text-slate-400 border border-slate-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
};

const formatCell = (v) => {
  if (v === null || v === undefined) return <span className="text-slate-300 italic">null</span>;
  if (typeof v === 'boolean') return <span className={v ? 'text-emerald-600 font-semibold' : 'text-rose-500 font-semibold'}>{String(v)}</span>;
  if (typeof v === 'object') {
    const str = JSON.stringify(v);
    return <span className="text-violet-600 font-mono text-[11px]">{str.length > 80 ? str.slice(0, 80) + '…' : str}</span>;
  }
  const s = String(v);
  return <span title={s}>{s.length > 80 ? s.slice(0, 80) + '…' : s}</span>;
};

const AdminDatabase = () => {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [collSearch, setCollSearch] = useState('');

  // Row viewer dialog state
  const [openColl, setOpenColl] = useState(null);
  const [rows, setRows] = useState(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [rowSearch, setRowSearch] = useState('');

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.admin.getDatabaseOverview();
      setOverview(data);
    } catch (e) {
      toast.error('Failed to load database overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const loadRows = useCallback(async (name, p = 1, search = '') => {
    try {
      setRowsLoading(true);
      const { data } = await api.admin.getDatabaseCollection(name, p, 25, search);
      setRows(data);
      setPage(p);
    } catch (e) {
      toast.error('Failed to load records');
    } finally {
      setRowsLoading(false);
    }
  }, []);

  const openCollection = (name) => {
    setOpenColl(name);
    setRowSearch('');
    setRows(null);
    loadRows(name, 1, '');
  };

  const closeCollection = () => { setOpenColl(null); setRows(null); };

  const filteredCollections = (overview?.collections || []).filter((c) =>
    !collSearch.trim() || c.name.toLowerCase().includes(collSearch.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 p-6 sm:p-8 shadow-xl">
          <div className="absolute top-[-50px] right-[-30px] w-64 h-64 bg-white/5 rounded-full blur-2xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <Database className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Database Tables</h1>
                <p className="text-white/70 text-sm mt-0.5 flex items-center gap-1.5">
                  <Server className="h-3.5 w-3.5" /> {overview?.database || '…'} · every collection of the website on one page
                </p>
              </div>
            </div>
            <Button onClick={fetchOverview} variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-xl gap-2 w-fit" data-testid="db-refresh-btn">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {/* summary chips */}
          <div className="relative grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6">
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-4" data-testid="db-stat-collections">
              <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider"><Layers className="h-3.5 w-3.5" /> Tables</div>
              <p className="text-3xl font-black text-white mt-1">{overview?.total_collections ?? '—'}</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-4" data-testid="db-stat-documents">
              <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider"><FileText className="h-3.5 w-3.5" /> Total Records</div>
              <p className="text-3xl font-black text-white mt-1">{overview?.total_documents?.toLocaleString() ?? '—'}</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-4 col-span-2 sm:col-span-1" data-testid="db-stat-secured">
              <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider"><KeyRound className="h-3.5 w-3.5" /> Security</div>
              <p className="text-sm font-bold text-emerald-300 mt-2">Passwords &amp; secrets hidden</p>
            </div>
          </div>
        </div>

        {/* collection search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search tables..."
            value={collSearch}
            onChange={(e) => setCollSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl"
            data-testid="db-collection-search"
          />
        </div>

        {/* Collections grid */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="db-collections-grid">
            {filteredCollections.map((coll) => (
              <Card key={coll.name} className="border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col" data-testid={`db-collection-card-${coll.name}`}>
                <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 px-4 py-3 border-b border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                        <Table2 className="h-4 w-4 text-white" />
                      </div>
                      <h3 className="font-bold text-slate-800 font-mono text-sm truncate" title={coll.name}>{coll.name}</h3>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 flex-shrink-0" data-testid={`db-collection-count-${coll.name}`}>
                      <Hash className="h-3 w-3 mr-0.5" />{coll.count.toLocaleString()}
                    </Badge>
                  </div>
                  {coll.description && <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{coll.description}</p>}
                </div>
                <CardContent className="p-0 flex-1 flex flex-col">
                  <div className="px-4 py-2 flex items-center justify-between text-[11px] text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-50">
                    <span>{coll.field_count} columns</span>
                    <span>Type</span>
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
                    {coll.fields.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-slate-400 italic">Empty table — no columns yet</p>
                    ) : coll.fields.map((f) => (
                      <div key={f.name} className="px-4 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-50/60">
                        <span className={`font-mono text-xs truncate ${f.name === 'id' ? 'text-slate-900 font-bold' : 'text-slate-600'}`} title={f.sample ? `e.g. ${f.sample}` : f.name}>
                          {f.name}{f.sensitive && <KeyRound className="inline h-3 w-3 ml-1 text-amber-500" />}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor(f.type)} flex-shrink-0`}>{f.type}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 border-t border-slate-100 mt-auto">
                    <Button onClick={() => openCollection(coll.name)} disabled={coll.count === 0} variant="outline" size="sm" className="w-full rounded-xl gap-1.5 text-xs" data-testid={`db-view-records-${coll.name}`}>
                      <Eye className="h-3.5 w-3.5" /> {coll.count === 0 ? 'No records' : `View ${coll.count.toLocaleString()} records`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredCollections.length === 0 && (
              <div className="col-span-full text-center py-16 text-slate-400">No tables match "{collSearch}"</div>
            )}
          </div>
        )}
      </div>

      {/* Records dialog */}
      <Dialog open={!!openColl} onOpenChange={(o) => { if (!o) closeCollection(); }}>
        <DialogContent className="max-w-[95vw] xl:max-w-[1300px] max-h-[90vh] flex flex-col p-0 gap-0" data-testid="db-records-dialog">
          <DialogHeader className="px-5 py-4 border-b border-slate-100">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Table2 className="h-5 w-5 text-indigo-500" />
              <span className="font-mono">{openColl}</span>
              {rows && <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 ml-1">{rows.total.toLocaleString()} records</Badge>}
            </DialogTitle>
          </DialogHeader>

          {/* search + pagination controls */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search records..."
                value={rowSearch}
                onChange={(e) => setRowSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadRows(openColl, 1, rowSearch); }}
                className="pl-10 h-9 rounded-lg text-sm"
                data-testid="db-records-search"
              />
              {rowSearch && (
                <button onClick={() => { setRowSearch(''); loadRows(openColl, 1, ''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {rows && (
              <div className="flex items-center gap-2 text-sm">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1 || rowsLoading} onClick={() => loadRows(openColl, page - 1, rowSearch)} data-testid="db-records-prev">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-slate-600 font-medium px-1" data-testid="db-records-pageinfo">Page {rows.page} / {rows.total_pages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= rows.total_pages || rowsLoading} onClick={() => loadRows(openColl, page + 1, rowSearch)} data-testid="db-records-next">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* table */}
          <ScrollArea className="flex-1 overflow-auto">
            {rowsLoading ? (
              <div className="flex items-center justify-center py-20 text-slate-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
            ) : !rows || rows.documents.length === 0 ? (
              <div className="py-20 text-center text-slate-400">No records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse" data-testid="db-records-table">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-50">
                      <th className="px-3 py-2 text-left font-bold text-slate-400 border-b border-slate-200 w-10">#</th>
                      {rows.columns.map((c) => (
                        <th key={c} className={`px-3 py-2 text-left font-bold border-b border-slate-200 whitespace-nowrap ${c === 'id' ? 'text-indigo-700' : 'text-slate-600'}`}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.documents.map((doc, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/40 border-b border-slate-50">
                        <td className="px-3 py-2 text-slate-300 font-mono">{(rows.page - 1) * rows.limit + idx + 1}</td>
                        {rows.columns.map((c) => (
                          <td key={c} className="px-3 py-2 text-slate-700 align-top max-w-[280px] truncate">{formatCell(doc[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminDatabase;
