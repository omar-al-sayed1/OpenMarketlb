import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { FileText } from 'lucide-react';

const TermsOfServicePage = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTos = async () => {
      try {
        const { data } = await api.tos.get();
        setContent(data.content || '');
      } catch (err) {
        console.error('Failed to fetch TOS', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTos();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen py-8 sm:py-12" data-testid="tos-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Terms of Service</h1>
        </div>
        <div 
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-10 prose prose-slate max-w-none
            prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed
            prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
            prose-ul:text-slate-600 prose-li:text-slate-600"
          dangerouslySetInnerHTML={{ __html: content }}
          data-testid="tos-content"
        />
      </div>
    </div>
  );
};

export default TermsOfServicePage;
