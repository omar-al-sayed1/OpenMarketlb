import React, { useEffect, useState } from 'react';
import { Save, Image as ImageIcon, User, Lock, MapPin, Plus, Trash2, Edit2, CreditCard, Settings, FileText, Users, Star, Quote, Mail, Search, X, Instagram, Facebook } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import ImageUploader from '../../components/ImageUploader';
import { api } from '../../lib/api';
import { applyBrandColors } from '../../lib/brandTheme';
import { toast } from 'sonner';

// TOS Editor Component - Plain text editor with auto HTML conversion
const TosEditor = () => {
  const [tosContent, setTosContent] = useState('');
  const [tosPlainText, setTosPlainText] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  // Convert plain text to HTML
  const plainTextToHtml = (text) => {
    if (!text) return '';
    return text
      .split('\n\n')
      .map(paragraph => {
        const trimmed = paragraph.trim();
        if (!trimmed) return '';
        // Check if it looks like a heading (starts with # or is all caps short line)
        if (trimmed.startsWith('### ')) {
          return `<h3>${trimmed.slice(4)}</h3>`;
        }
        if (trimmed.startsWith('## ')) {
          return `<h2>${trimmed.slice(3)}</h2>`;
        }
        if (trimmed.startsWith('# ')) {
          return `<h2>${trimmed.slice(2)}</h2>`;
        }
        // Check if it's a list (starts with - or *)
        const lines = trimmed.split('\n');
        const isListBlock = lines.every(l => l.trim().startsWith('- ') || l.trim().startsWith('* ') || l.trim() === '');
        if (isListBlock && lines.some(l => l.trim().startsWith('- ') || l.trim().startsWith('* '))) {
          const items = lines
            .filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '))
            .map(l => `<li>${l.trim().slice(2)}</li>`)
            .join('');
          return `<ul>${items}</ul>`;
        }
        // Regular paragraph - preserve line breaks within
        const htmlContent = trimmed.split('\n').join('<br/>');
        return `<p>${htmlContent}</p>`;
      })
      .filter(Boolean)
      .join('\n');
  };

  // Convert HTML back to plain text for editing
  const htmlToPlainText = (html) => {
    if (!html) return '';
    return html
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<ul>(.*?)<\/ul>/gis, (_, items) => {
        return items.replace(/<li>(.*?)<\/li>/gi, '- $1\n').trim() + '\n\n';
      })
      .replace(/<p>(.*?)<\/p>/gis, (_, content) => {
        return content.replace(/<br\s*\/?>/gi, '\n') + '\n\n';
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  useEffect(() => {
    const fetchTos = async () => {
      try {
        const { data } = await api.tos.get();
        const content = data.content || '';
        setTosContent(content);
        setTosPlainText(htmlToPlainText(content));
      } catch {} finally { setLoading(false); }
    };
    fetchTos();
  }, []);

  const handleTextChange = (e) => {
    const text = e.target.value;
    setTosPlainText(text);
    setTosContent(plainTextToHtml(text));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.tos.update(tosContent);
      toast.success('Terms of Service updated successfully');
    } catch (err) {
      toast.error('Failed to update Terms of Service');
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm mt-8" id="tos-editor" data-testid="tos-editor-section">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
          <FileText className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-lg text-slate-900">Terms of Service</h3>
          <p className="text-sm text-slate-500">Write your Terms of Service in plain text</p>
        </div>
      </div>
      {loading ? (
        <div className="animate-pulse h-40 bg-slate-100 rounded-lg" />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setShowPreview(false)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${!showPreview ? 'bg-rose-100 text-rose-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Edit
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${showPreview ? 'bg-rose-100 text-rose-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Preview
            </button>
          </div>
          
          {!showPreview ? (
            <div>
              <Textarea
                value={tosPlainText}
                onChange={handleTextChange}
                className="min-h-[300px] text-sm leading-relaxed"
                placeholder={"## Terms of Service\n\nWrite your terms here using plain text.\n\n## Section Title\n\nUse ## for headings, ### for sub-headings.\n\nUse blank lines between paragraphs.\n\n- Use dashes for bullet points\n- Another point"}
                data-testid="tos-content-editor"
              />
              <div className="mt-2 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-500 font-medium mb-1">Formatting Tips:</p>
                <ul className="text-xs text-slate-400 space-y-0.5">
                  <li><code className="bg-slate-200 px-1 rounded">## Title</code> - Section heading</li>
                  <li><code className="bg-slate-200 px-1 rounded">### Subtitle</code> - Sub-heading</li>
                  <li><code className="bg-slate-200 px-1 rounded">- Item</code> - Bullet list</li>
                  <li>Blank line between paragraphs</li>
                </ul>
              </div>
            </div>
          ) : (
            <div 
              className="min-h-[300px] p-4 bg-slate-50 rounded-lg border prose prose-slate max-w-none
                prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed
                prose-h2:text-xl prose-h2:font-bold prose-h2:mt-6 prose-h2:mb-3
                prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-4 prose-h3:mb-2
                prose-ul:text-slate-600 prose-li:text-slate-600"
              dangerouslySetInnerHTML={{ __html: tosContent || '<p class="text-slate-400">No content yet. Switch to Edit to add content.</p>' }}
            />
          )}
          
          <div className="flex items-center justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-rose-600 hover:bg-rose-700" data-testid="save-tos-btn">
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Terms of Service'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const AdminSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);
  const [settings, setSettings] = useState({
    contact_email: '',
    contact_phone: '',
  });
  const [platformSettings, setPlatformSettings] = useState({
    subscription_price: 29,
    trial_days: 7,
    card_subscription_enabled: true,
    card_payment_enabled: true,
    logo_url: '',
    otp_verification_enabled: true,
    instagram_url: '',
    facebook_url: '',
  });
  const [adminProfile, setAdminProfile] = useState({
    email: '',
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [states, setStates] = useState([]);
  const [stateDialogOpen, setStateDialogOpen] = useState(false);
  const [editingState, setEditingState] = useState(null);
  const [stateForm, setStateForm] = useState({ name: '', delivery_fee: '', is_active: true });
  const [savingState, setSavingState] = useState(false);
  const [typeImages, setTypeImages] = useState({ men: '', women: '', kids: '' });
  const [savingTypeImages, setSavingTypeImages] = useState(false);
  const [aboutSections, setAboutSections] = useState([]);
  const [savingAbout, setSavingAbout] = useState(false);

  // Team Members state
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingTeamMember, setEditingTeamMember] = useState(null);
  const [teamForm, setTeamForm] = useState({ name: '', position: '', photo: '', order: 0 });
  const [savingTeamMember, setSavingTeamMember] = useState(false);

  // Testimonials state
  const [testimonials, setTestimonials] = useState([]);
  const [testimonialDialogOpen, setTestimonialDialogOpen] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState(null);
  const [testimonialForm, setTestimonialForm] = useState({ text: '', author: '', role: '', rating: 5, order: 0 });
  const [savingTestimonial, setSavingTestimonial] = useState(false);

  // ===== Settings search =====
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const SETTINGS_SECTIONS = [
    { id: 'admin-profile-settings', label: 'Admin Profile', icon: User, color: 'violet', keywords: 'admin profile email password change account login security credentials' },
    { id: 'contact-settings', label: 'Contact Information', icon: Settings, color: 'blue', keywords: 'contact phone email address support whatsapp social media facebook instagram footer' },
    { id: 'platform-settings', label: 'Platform Settings', icon: Settings, color: 'indigo', keywords: 'platform commission rate percent loyalty points currency tax delivery fee free shipping threshold trial subscription marketplace fees payout' },
    { id: 'type-images-settings', label: 'Type Images', icon: ImageIcon, color: 'pink', keywords: 'type images men women kids gender category banner photo homepage' },
    { id: 'about-page-editor', label: 'About Us Page', icon: FileText, color: 'violet', keywords: 'about us page content story mission vision company sections' },
    { id: 'team-members-section', label: 'Team Members', icon: Users, color: 'emerald', keywords: 'team members staff people employees photo position role meet our team' },
    { id: 'testimonials-section', label: 'Testimonials', icon: Quote, color: 'amber', keywords: 'testimonials reviews quotes customers sellers say feedback rating' },
    { id: 'states-section', label: 'States & Delivery', icon: MapPin, color: 'teal', keywords: 'states regions delivery fees shipping cost location area governorate' },
    { id: 'tos-editor', label: 'Terms of Service', icon: FileText, color: 'rose', keywords: 'terms of service tos legal conditions policy agreement privacy' },
  ];
  const filteredSections = searchQuery
    ? SETTINGS_SECTIONS.filter(s => (`${s.label} ${s.keywords}`).toLowerCase().includes(searchQuery.toLowerCase()))
    : SETTINGS_SECTIONS;
  const highlightSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.add('ring-4', 'ring-violet-400', 'ring-offset-2');
    setTimeout(() => el.classList.remove('ring-4', 'ring-violet-400', 'ring-offset-2'), 2200);
  };
  const runSearch = () => {
    const q = searchInput.trim();
    setSearchQuery(q);
    if (q) {
      const matches = SETTINGS_SECTIONS.filter(s => (`${s.label} ${s.keywords}`).toLowerCase().includes(q.toLowerCase()));
      if (matches.length > 0) {
        setTimeout(() => highlightSection(matches[0].id), 80);
      } else {
        toast.error('No settings found for "' + q + '"');
      }
    }
  };
  const clearSearch = () => { setSearchInput(''); setSearchQuery(''); };

  useEffect(() => {
    fetchSettings();
    fetchAdminProfile();
    fetchStates();
    fetchPlatformSettings();
    fetchTypeImages();
    fetchAboutPage();
    fetchTeamMembers();
    fetchTestimonials();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.settings.get();
      setSettings(data);
    } catch (error) {
      console.error('Failed to fetch settings', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlatformSettings = async () => {
    try {
      const { data } = await api.admin.getPlatformSettings();
      setPlatformSettings(data);
    } catch (error) {
      console.error('Failed to fetch platform settings', error);
    }
  };

  const fetchAdminProfile = async () => {
    try {
      const { data } = await api.auth.getMe();
      setAdminProfile(prev => ({ ...prev, email: data.email }));
    } catch (error) {
      console.error('Failed to fetch admin profile', error);
    }
  };

  const handleChange = (e) => {
    setSettings({ ...settings, [e.target.name]: e.target.value });
  };

  const handleProfileChange = (e) => {
    setAdminProfile({ ...adminProfile, [e.target.name]: e.target.value });
  };

  const handlePlatformChange = (field, value) => {
    setPlatformSettings({ ...platformSettings, [field]: value });
  };

  // Brand colors: update state AND live-apply so the admin previews instantly.
  const handleBrandColorChange = (field, value) => {
    const next = { ...platformSettings, [field]: value };
    setPlatformSettings(next);
    applyBrandColors(next.primary_color || '#000052', next.secondary_color || '#AA1233');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.admin.updateSettings(settings);
      toast.success('Settings updated successfully!');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handlePlatformSubmit = async () => {
    setSavingPlatform(true);
    try {
      await api.admin.updatePlatformSettings(platformSettings);
      toast.success('Platform settings updated!');
    } catch (error) {
      toast.error('Failed to update platform settings');
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    if (adminProfile.new_password && adminProfile.new_password !== adminProfile.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }
    
    if (adminProfile.new_password && !adminProfile.old_password) {
      toast.error('Please enter your current password');
      return;
    }
    
    setSavingProfile(true);
    try {
      const updateData = {};
      if (adminProfile.email) updateData.email = adminProfile.email;
      if (adminProfile.old_password && adminProfile.new_password) {
        updateData.old_password = adminProfile.old_password;
        updateData.new_password = adminProfile.new_password;
      }
      
      await api.admin.updateProfile(updateData);
      toast.success('Profile updated successfully!');
      setAdminProfile(prev => ({ ...prev, old_password: '', new_password: '', confirm_password: '' }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const fetchStates = async () => {
    try {
      const { data } = await api.admin.getStates();
      setStates(data);
    } catch (error) {
      console.error('Failed to fetch states', error);
    }
  };

  const fetchTypeImages = async () => {
    try {
      const { data } = await api.typeImages.get();
      setTypeImages({ men: data.men || '', women: data.women || '', kids: data.kids || '' });
    } catch (error) {
      console.error('Failed to fetch type images', error);
    }
  };

  const fetchAboutPage = async () => {
    try {
      const { data } = await api.aboutPage.get();
      setAboutSections(data.sections || []);
    } catch (error) {
      console.error('Failed to fetch about page', error);
    }
  };

  const handleSaveAboutPage = async () => {
    setSavingAbout(true);
    try {
      await api.aboutPage.update(aboutSections);
      toast.success('About page updated!');
    } catch (error) {
      toast.error('Failed to update about page');
    } finally {
      setSavingAbout(false);
    }
  };

  const addAboutSection = () => {
    setAboutSections([...aboutSections, { title: '', content: '', type: 'text', image: '', image_position: 'right', is_active: true, font_size: '16', text_align: 'left' }]);
  };

  const removeAboutSection = (index) => {
    setAboutSections(aboutSections.filter((_, i) => i !== index));
  };

  const updateAboutSection = (index, field, value) => {
    const updated = [...aboutSections];
    updated[index] = { ...updated[index], [field]: value };
    setAboutSections(updated);
  };

  const moveSection = (index, direction) => {
    const updated = [...aboutSections];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= updated.length) return;
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setAboutSections(updated);
  };

  const handleSaveTypeImages = async () => {
    setSavingTypeImages(true);
    try {
      await api.typeImages.update(typeImages);
      toast.success('Type images updated!');
    } catch (error) {
      toast.error('Failed to update type images');
    } finally {
      setSavingTypeImages(false);
    }
  };

  const openAddState = () => {
    setEditingState(null);
    setStateForm({ name: '', delivery_fee: '', is_active: true });
    setStateDialogOpen(true);
  };

  const openEditState = (state) => {
    setEditingState(state);
    setStateForm({ name: state.name, delivery_fee: state.delivery_fee.toString(), is_active: state.is_active });
    setStateDialogOpen(true);
  };

  const handleSaveState = async () => {
    if (!stateForm.name.trim()) {
      toast.error('State name is required');
      return;
    }
    setSavingState(true);
    try {
      const payload = {
        name: stateForm.name.trim(),
        delivery_fee: parseFloat(stateForm.delivery_fee) || 0,
        is_active: stateForm.is_active
      };
      if (editingState) {
        await api.admin.updateState(editingState.id, payload);
        toast.success('State updated');
      } else {
        await api.admin.createState(payload);
        toast.success('State created');
      }
      setStateDialogOpen(false);
      fetchStates();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save state');
    } finally {
      setSavingState(false);
    }
  };

  const handleDeleteState = async (stateId) => {
    if (!window.confirm('Are you sure you want to delete this state?')) return;
    try {
      await api.admin.deleteState(stateId);
      toast.success('State deleted');
      fetchStates();
    } catch (error) {
      toast.error('Failed to delete state');
    }
  };

  // ============ TEAM MEMBERS FUNCTIONS ============
  const fetchTeamMembers = async () => {
    try {
      const { data } = await api.teamMembers.getAll();
      setTeamMembers(data);
    } catch (error) {
      console.error('Failed to fetch team members', error);
    }
  };

  const openAddTeamMember = () => {
    setEditingTeamMember(null);
    setTeamForm({ name: '', position: '', photo: '', order: teamMembers.length });
    setTeamDialogOpen(true);
  };

  const openEditTeamMember = (member) => {
    setEditingTeamMember(member);
    setTeamForm({ name: member.name, position: member.position, photo: member.photo || '', order: member.order || 0 });
    setTeamDialogOpen(true);
  };

  const handleSaveTeamMember = async () => {
    if (!teamForm.name.trim() || !teamForm.position.trim()) {
      toast.error('Name and position are required');
      return;
    }
    setSavingTeamMember(true);
    try {
      if (editingTeamMember) {
        await api.teamMembers.update(editingTeamMember.id, teamForm);
        toast.success('Team member updated');
      } else {
        await api.teamMembers.create(teamForm);
        toast.success('Team member added');
      }
      setTeamDialogOpen(false);
      fetchTeamMembers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save team member');
    } finally {
      setSavingTeamMember(false);
    }
  };

  const handleDeleteTeamMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to delete this team member?')) return;
    try {
      await api.teamMembers.delete(memberId);
      toast.success('Team member deleted');
      fetchTeamMembers();
    } catch (error) {
      toast.error('Failed to delete team member');
    }
  };

  // ============ TESTIMONIALS FUNCTIONS ============
  const fetchTestimonials = async () => {
    try {
      const { data } = await api.testimonials.getAll();
      setTestimonials(data);
    } catch (error) {
      console.error('Failed to fetch testimonials', error);
    }
  };

  const openAddTestimonial = () => {
    setEditingTestimonial(null);
    setTestimonialForm({ text: '', author: '', role: '', rating: 5, order: testimonials.length });
    setTestimonialDialogOpen(true);
  };

  const openEditTestimonial = (testimonial) => {
    setEditingTestimonial(testimonial);
    setTestimonialForm({
      text: testimonial.text,
      author: testimonial.author,
      role: testimonial.role || '',
      rating: testimonial.rating || 5,
      order: testimonial.order || 0
    });
    setTestimonialDialogOpen(true);
  };

  const handleSaveTestimonial = async () => {
    if (!testimonialForm.text.trim() || !testimonialForm.author.trim()) {
      toast.error('Quote text and author are required');
      return;
    }
    setSavingTestimonial(true);
    try {
      if (editingTestimonial) {
        await api.testimonials.update(editingTestimonial.id, testimonialForm);
        toast.success('Testimonial updated');
      } else {
        await api.testimonials.create(testimonialForm);
        toast.success('Testimonial added');
      }
      setTestimonialDialogOpen(false);
      fetchTestimonials();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save testimonial');
    } finally {
      setSavingTestimonial(false);
    }
  };

  const handleDeleteTestimonial = async (testimonialId) => {
    if (!window.confirm('Are you sure you want to delete this testimonial?')) return;
    try {
      await api.testimonials.delete(testimonialId);
      toast.success('Testimonial deleted');
      fetchTestimonials();
    } catch (error) {
      toast.error('Failed to delete testimonial');
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex-1 flex items-center justify-center min-h-[80vh]">Loading...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-2 sm:p-4 lg:p-8" data-testid="admin-settings-content">
        {/* Modern Hero Header */}
        <div className="relative overflow-hidden rounded-3xl mb-6 lg:mb-8 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 p-6 lg:p-10 shadow-xl shadow-violet-200">
          <div className="absolute -top-12 -right-12 w-56 h-56 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-72 h-72 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute top-6 right-1/4 w-3 h-3 bg-white/40 rounded-full" />
          <div className="absolute bottom-10 right-1/3 w-2 h-2 bg-white/60 rounded-full" />
          <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-lg">
                <Settings className="h-7 w-7 lg:h-8 lg:w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-4xl font-bold text-white tracking-tight" data-testid="admin-settings-title">Platform Settings</h1>
                <p className="text-violet-100 text-sm mt-0.5">Configure your marketplace, content & integrations</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full text-white/90 text-xs font-semibold">
              <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse" /> All systems operational
            </div>
          </div>
        </div>

        {/* Settings Search Bar */}
        <div className="mb-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-3" data-testid="settings-search-bar">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } }}
                placeholder="Search settings… (e.g. commission, delivery, password, testimonials)"
                className="pl-10 pr-10 h-11 rounded-xl"
                data-testid="settings-search-input"
              />
              {searchInput && (
                <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500" data-testid="settings-search-clear">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button onClick={runSearch} className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold px-6" data-testid="settings-search-button">
              <Search className="h-4 w-4 mr-1.5" /> Search
            </Button>
          </div>
          {searchQuery && (
            <p className="mt-2 px-1 text-xs text-slate-500" data-testid="settings-search-results-count">
              {filteredSections.length === 0
                ? <>No settings match <span className="font-semibold text-slate-700">"{searchQuery}"</span>.</>
                : <>Showing <span className="font-semibold text-violet-700">{filteredSections.length}</span> section{filteredSections.length !== 1 ? 's' : ''} matching <span className="font-semibold text-slate-700">"{searchQuery}"</span>. Click a card to jump.</>}
            </p>
          )}
        </div>

        {/* Section Navigation Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8" data-testid="settings-section-nav">
          {filteredSections.map((section) => {
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                onClick={() => highlightSection(section.id)}
                className={`group relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl border border-slate-200 bg-white hover:bg-${section.color}-50 hover:border-${section.color}-200 transition-all duration-300 text-left shadow-sm hover:shadow-md hover:-translate-y-0.5`}
                data-testid={`settings-nav-${section.id}`}
              >
                <div className={`absolute -bottom-2 -right-2 w-12 h-12 rounded-full bg-${section.color}-100 opacity-60 group-hover:scale-125 transition-transform duration-500`} />
                <div className={`relative p-2 rounded-xl bg-${section.color}-100 group-hover:bg-${section.color}-200 group-hover:scale-110 transition-all duration-300`}>
                  <Icon className={`h-4 w-4 text-${section.color}-600`} />
                </div>
                <span className="relative text-sm font-semibold text-slate-700 group-hover:text-slate-900">{section.label}</span>
              </button>
            );
          })}
        </div>

        <div className="max-w-5xl space-y-8">
          {/* Admin Profile Section */}
          <form onSubmit={handleProfileSubmit} className="relative overflow-hidden bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100" id="admin-profile-settings" data-testid="admin-profile-settings">
            <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-violet-50 to-transparent rounded-full" />
            <div className="relative flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-200">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Admin Profile</h2>
                <p className="text-xs text-slate-500">Manage your administrator account</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="admin_email">Email</Label>
                <Input
                  id="admin_email"
                  name="email"
                  type="email"
                  value={adminProfile.email}
                  onChange={handleProfileChange}
                  data-testid="admin-email-input"
                />
              </div>
              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Change Password
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="old_password">Current Password</Label>
                    <Input
                      id="old_password"
                      name="old_password"
                      type="password"
                      value={adminProfile.old_password}
                      onChange={handleProfileChange}
                      placeholder="Enter current password"
                      data-testid="admin-old-password-input"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="new_password">New Password</Label>
                      <Input
                        id="new_password"
                        name="new_password"
                        type="password"
                        value={adminProfile.new_password}
                        onChange={handleProfileChange}
                        placeholder="Enter new password"
                        data-testid="admin-new-password-input"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm_password">Confirm New Password</Label>
                      <Input
                        id="confirm_password"
                        name="confirm_password"
                        type="password"
                        value={adminProfile.confirm_password}
                        onChange={handleProfileChange}
                        placeholder="Confirm new password"
                        data-testid="admin-confirm-password-input"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <Button
                type="submit"
                disabled={savingProfile}
                className="w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                data-testid="save-profile-button"
              >
                <Save className="h-4 w-4 mr-2" />
                {savingProfile ? 'Saving...' : 'Update Profile'}
              </Button>
            </div>
          </form>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative overflow-hidden bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100 mb-6" id="contact-settings" data-testid="contact-settings">
            <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-blue-50 to-transparent rounded-full" />
            <div className="relative flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-200">
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Contact Information</h2>
                <p className="text-xs text-slate-500">How customers can reach your platform</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="contact_email">Contact Email *</Label>
                <Input
                  id="contact_email"
                  name="contact_email"
                  type="email"
                  value={settings.contact_email}
                  onChange={handleChange}
                  required
                  data-testid="contact-email-input"
                />
              </div>
              <div>
                <Label htmlFor="contact_phone">Contact Phone *</Label>
                <Input
                  id="contact_phone"
                  name="contact_phone"
                  value={settings.contact_phone}
                  onChange={handleChange}
                  required
                  placeholder="12-345-6789"
                  data-testid="contact-phone-input"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            data-testid="save-settings-button"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </form>

          {/* Platform Settings Section */}
          <div className="relative overflow-hidden bg-white rounded-2xl p-6 lg:p-8 shadow-sm border border-slate-100 mt-8" id="platform-settings" data-testid="platform-settings">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-50 to-transparent rounded-full" />
            <div className="relative flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-200">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-lg text-slate-900">Platform Settings</h2>
                <p className="text-xs text-slate-500">Subscriptions, payments, OTP & feature toggles</p>
              </div>
            </div>
            <div className="space-y-6">
              {/* Site Logo */}
              <div className="border-b pb-6">
                <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  Site Logo
                </h3>
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden bg-slate-50">
                      {(platformSettings.logo_url) ? (
                        <img src={platformSettings.logo_url} alt="Logo" className="w-full h-full object-contain" />
                      ) : (
                        <img src="/logo.png" alt="Default Logo" className="w-full h-full object-contain" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <Label>Logo Upload or URL</Label>
                    <ImageUploader
                      value={platformSettings.logo_url || ''}
                      onChange={(url) => handlePlatformChange('logo_url', url)}
                      label=""
                      showUrlInput={true}
                    />
                    <p className="text-xs text-slate-500 mt-1">Leave empty to use the default logo. Upload from device or paste URL.</p>
                  </div>
                </div>
              </div>

              {/* Social Media Links (shown in footer) */}
              <div className="border-b pb-6">
                <h3 className="font-medium text-slate-700 mb-1 flex items-center gap-2">
                  <Instagram className="h-4 w-4" />
                  Social Media Links
                </h3>
                <p className="text-xs text-slate-500 mb-4">Shown as clickable icons in the website footer. Leave empty to hide an icon.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="instagram_url" className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5 text-pink-500" /> Instagram URL</Label>
                    <Input
                      id="instagram_url"
                      type="url"
                      placeholder="https://instagram.com/yourpage"
                      value={platformSettings.instagram_url || ''}
                      onChange={(e) => handlePlatformChange('instagram_url', e.target.value)}
                      data-testid="instagram-url-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebook_url" className="flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5 text-blue-500" /> Facebook URL</Label>
                    <Input
                      id="facebook_url"
                      type="url"
                      placeholder="https://facebook.com/yourpage"
                      value={platformSettings.facebook_url || ''}
                      onChange={(e) => handlePlatformChange('facebook_url', e.target.value)}
                      data-testid="facebook-url-input"
                    />
                  </div>
                </div>
              </div>

              {/* Subscription Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="trial_days">Trial Days</Label>
                  <Input
                    id="trial_days"
                    type="number"
                    value={platformSettings.trial_days}
                    onChange={(e) => handlePlatformChange('trial_days', parseInt(e.target.value))}
                    data-testid="trial-days-input"
                  />
                </div>
              </div>

              {/* Card Payment Toggles */}
              <div className="border-t pt-6">
                <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Card Payment Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                    <div>
                      <Label className="mb-0 text-blue-900">Card Subscription</Label>
                      <p className="text-xs text-blue-600">Allow sellers to pay subscription by card</p>
                    </div>
                    <Switch
                      checked={platformSettings.card_subscription_enabled}
                      onCheckedChange={(checked) => handlePlatformChange('card_subscription_enabled', checked)}
                      data-testid="card-subscription-switch"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                    <div>
                      <Label className="mb-0 text-emerald-900">Card Payment</Label>
                      <p className="text-xs text-emerald-600">Allow customers to pay orders by card</p>
                    </div>
                    <Switch
                      checked={platformSettings.card_payment_enabled}
                      onCheckedChange={(checked) => handlePlatformChange('card_payment_enabled', checked)}
                      data-testid="card-payment-switch"
                    />
                  </div>
                </div>
              </div>

              {/* OTP Verification Toggle */}
              <div className="border-t pt-6">
                <h3 className="font-medium text-slate-700 mb-4 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-violet-500" />
                  Phone Verification (OTP)
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  Control WhatsApp OTP verification for login and guest checkout. When disabled, users can log in directly and guests can checkout without phone verification.
                </p>
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-violet-50 to-indigo-50 rounded-xl border border-violet-200">
                  <div>
                    <p className="font-semibold text-violet-900">Enable OTP Verification</p>
                    <p className="text-sm text-violet-600">WhatsApp OTP required for login & guest checkout</p>
                  </div>
                  <Switch
                    checked={platformSettings.otp_verification_enabled !== false}
                    onCheckedChange={(checked) => handlePlatformChange('otp_verification_enabled', checked)}
                    data-testid="otp-verification-switch"
                  />
                </div>
              </div>

              {/* Subscription Sale Promotion - REMOVED */}

              {/* Promotions Settings */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="text-amber-500">📢</span> Promoted Products Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>Shop Cashback (% of commission)</Label>
                    <p className="text-xs text-gray-500 mb-1">When a shop places an order, this % of the order's commission is credited back to the shop's wallet once paid (the rest is admin profit).</p>
                    <Input
                      type="number"
                      value={platformSettings.shop_cashback_percent ?? 50}
                      onChange={(e) => handlePlatformChange('shop_cashback_percent', parseFloat(e.target.value))}
                      min="0" max="100" step="1"
                      data-testid="shop-cashback-percent-input"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Product Promotions</Label>
                      <p className="text-xs text-gray-500">Allow shops to boost their products</p>
                    </div>
                    <Switch
                      checked={platformSettings.promotion_enabled || false}
                      onCheckedChange={(checked) => handlePlatformChange('promotion_enabled', checked)}
                    />
                  </div>
                  {platformSettings.promotion_enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Daily Price ($)</Label>
                        <Input 
                          type="number" 
                          value={platformSettings.promotion_daily_price || 3}
                          onChange={(e) => handlePlatformChange('promotion_daily_price', parseFloat(e.target.value))}
                          min="0.5" step="0.5"
                        />
                      </div>
                      <div>
                        <Label>Max Slots Per Page</Label>
                        <Input 
                          type="number" 
                          value={platformSettings.promotion_max_slots_per_page || 4}
                          onChange={(e) => handlePlatformChange('promotion_max_slots_per_page', parseInt(e.target.value))}
                          min="1" max="10"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Advertising Channel Toggles + Pricing */}
              <div className="mt-8 pt-6 border-t" data-testid="advertising-toggles-section">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="text-violet-500">🚀</span> Advertising Channels & Pricing
                </h3>
                <p className="text-xs text-slate-500 mb-4">Independent on/off switches and pricing for each advertising channel. Money from these channels flows into <strong>Platform Services</strong> in the Finance Center.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Email Campaign toggle */}
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3" data-testid="toggle-email-campaign">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-semibold text-sm flex items-center gap-1.5"><span>📧</span> Email Campaigns</Label>
                        <p className="text-[11px] text-slate-500 mt-0.5">Shops pay per email delivered</p>
                      </div>
                      <Switch
                        checked={platformSettings.email_campaigns_enabled !== false}
                        onCheckedChange={(v) => handlePlatformChange('email_campaigns_enabled', v)}
                        data-testid="toggle-email-campaign-switch"
                      />
                    </div>
                    <div className="mt-3">
                      <Label className="text-[11px] uppercase tracking-wide text-slate-600">Price per email ($)</Label>
                      <Input
                        type="number" step="0.01" min="0"
                        value={platformSettings.email_price_per_email ?? 0.05}
                        onChange={(e) => handlePlatformChange('email_price_per_email', parseFloat(e.target.value) || 0)}
                        className="mt-1 h-9"
                        data-testid="setting-email-price-per-email"
                      />
                    </div>
                  </div>

                  {/* PPC Campaign toggle */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3" data-testid="toggle-ppc-campaign">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-semibold text-sm flex items-center gap-1.5"><span>🖱️</span> Pay-Per-Click</Label>
                        <p className="text-[11px] text-slate-500 mt-0.5">Charge only on actual clicks</p>
                      </div>
                      <Switch
                        checked={platformSettings.ppc_campaigns_enabled !== false}
                        onCheckedChange={(v) => handlePlatformChange('ppc_campaigns_enabled', v)}
                        data-testid="toggle-ppc-campaign-switch"
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] uppercase tracking-wide text-slate-600">$/click</Label>
                        <Input
                          type="number" step="0.01" min="0"
                          value={platformSettings.ppc_price_per_click ?? 0.05}
                          onChange={(e) => handlePlatformChange('ppc_price_per_click', parseFloat(e.target.value) || 0)}
                          className="mt-1 h-9"
                          data-testid="setting-ppc-price-per-click"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase tracking-wide text-slate-600">Min wallet</Label>
                        <Input
                          type="number" step="0.5" min="0"
                          value={platformSettings.ppc_min_wallet_to_start ?? 5}
                          onChange={(e) => handlePlatformChange('ppc_min_wallet_to_start', parseFloat(e.target.value) || 0)}
                          className="mt-1 h-9"
                          data-testid="setting-ppc-min-wallet"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banner / Event Sponsorship toggle */}
                  <div className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/60 p-3" data-testid="toggle-banner-campaign">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="font-semibold text-sm flex items-center gap-1.5"><span>🎨</span> Banner Sponsorship</Label>
                        <p className="text-[11px] text-slate-500 mt-0.5">Home banner / event sponsorship</p>
                      </div>
                      <Switch
                        checked={platformSettings.banner_campaigns_enabled !== false}
                        onCheckedChange={(v) => handlePlatformChange('banner_campaigns_enabled', v)}
                        data-testid="toggle-banner-campaign-switch"
                      />
                    </div>
                    <div className="mt-3">
                      <Label className="text-[11px] uppercase tracking-wide text-slate-600">Default $/day</Label>
                      <Input
                        type="number" step="0.5" min="0"
                        value={platformSettings.event_sponsorship_default_price ?? 2}
                        onChange={(e) => handlePlatformChange('event_sponsorship_default_price', parseFloat(e.target.value) || 0)}
                        className="mt-1 h-9"
                        data-testid="setting-banner-default-price"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Used when an event has no per-day price set.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shop Welcome Bonus (granted when admin approves a shop) */}
              <div className="mt-8 pt-6 border-t" data-testid="shop-welcome-bonus-section">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <span className="text-pink-500">🎁</span> Shop Welcome Bonus
                </h3>
                <p className="text-xs text-slate-500 mb-4">Awarded automatically when admin approves a new shop request. The wallet credit counts as <strong>New Shop Credits</strong> (deducted from admin profit).</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Wallet credit ($)</Label>
                    <Input
                      type="number" step="0.5" min="0"
                      value={platformSettings.shop_welcome_wallet_bonus ?? 2}
                      onChange={(e) => handlePlatformChange('shop_welcome_wallet_bonus', parseFloat(e.target.value) || 0)}
                      className="mt-1"
                      data-testid="setting-welcome-wallet"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Defaults to $2. Set to 0 to disable.</p>
                  </div>
                  <div>
                    <Label>Free sponsors</Label>
                    <Input
                      type="number" step="1" min="0"
                      value={platformSettings.shop_welcome_sponsor_count ?? 2}
                      onChange={(e) => handlePlatformChange('shop_welcome_sponsor_count', parseInt(e.target.value) || 0)}
                      className="mt-1"
                      data-testid="setting-welcome-sponsors"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Defaults to 2. Each is a free 7-day product boost.</p>
                  </div>
                </div>
              </div>

              {/* Product Variant Toggles — 4 toggles, each controls a variant type */}
              <div className="mt-8 pt-6 border-t" data-testid="product-variants-section">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <span className="text-violet-500">🎨</span> Product Variants
                </h3>
                <p className="text-xs text-slate-500 mb-4">Globally enable or disable each variant type. Disabled variants will be hidden from the product add/edit form everywhere (admin & shop).</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { key: 'variant_color_enabled', label: 'Color', icon: '🎨', desc: 'Different colors with photos', accent: 'border-violet-200 bg-violet-50' },
                    { key: 'variant_size_enabled', label: 'Size', icon: '📏', desc: 'XXS, XS, S, M, L, XL... or custom', accent: 'border-blue-200 bg-blue-50' },
                    { key: 'variant_shape_enabled', label: 'Shape', icon: '🔷', desc: 'Round, square, heart, custom...', accent: 'border-emerald-200 bg-emerald-50' },
                    { key: 'variant_type_enabled', label: 'Type', icon: '📱', desc: 'e.g. Samsung Galaxy S24, S24 Ultra...', accent: 'border-amber-200 bg-amber-50' },
                  ].map((v) => (
                    <div key={v.key} className={`rounded-2xl border-2 p-3.5 ${platformSettings[v.key] !== false ? v.accent : 'border-slate-200 bg-slate-50'}`} data-testid={`variant-toggle-${v.key.replace('variant_','').replace('_enabled','')}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{v.icon}</span>
                          <span className="text-sm font-bold text-slate-800">{v.label}</span>
                        </div>
                        <Switch
                          checked={platformSettings[v.key] !== false}
                          onCheckedChange={(checked) => handlePlatformChange(v.key, checked)}
                          data-testid={`switch-${v.key}`}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug">{v.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Delivery Availability Toggle */}
              <div className="mt-8 pt-6 border-t" data-testid="delivery-availability-section">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  <span className="text-orange-500">🚚</span> Delivery Availability
                </h3>
                <p className="text-xs text-slate-500 mb-4">Control whether delivery is available platform-wide. When OFF, the delivery section is removed from checkout and shop order pages.</p>
                <div className={`rounded-2xl border-2 p-4 ${platformSettings.available_delivery !== false ? 'border-orange-200 bg-orange-50' : 'border-slate-200 bg-slate-50'}`} data-testid="available-delivery-toggle">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${platformSettings.available_delivery !== false ? 'bg-orange-100' : 'bg-slate-200'}`}>
                        🚚
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">Available Delivery</p>
                        <p className="text-[11px] text-slate-500">
                          {platformSettings.available_delivery !== false
                            ? 'Delivery is visible to customers during checkout and to shops when creating orders.'
                            : 'Delivery is hidden from checkout and shop order pages.'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={platformSettings.available_delivery !== false}
                      onCheckedChange={(checked) => handlePlatformChange('available_delivery', checked)}
                      data-testid="switch-available-delivery"
                    />
                  </div>
                </div>
              </div>

              {/* Sponsored Placement Strategy */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="text-emerald-500">🎯</span> Sponsored Placement Strategy
                </h3>
                <div className="space-y-4">
                  <div>
                    <Label>Strategy</Label>
                    <select value={platformSettings.sponsored_strategy || 'interleave'} onChange={(e) => handlePlatformChange('sponsored_strategy', e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm">
                      <option value="interleave">Interleave (1 sponsored every N products)</option>
                      <option value="contextual">Contextual Match (match user filters)</option>
                      <option value="quality_weighted">Quality Weighted (rating + views)</option>
                      <option value="diversity">Diversity (spread across shops)</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">How sponsored products are mixed into listings</p>
                  </div>
                  <div>
                    <Label>Sponsored Density (every N products)</Label>
                    <Input type="number" value={platformSettings.sponsored_density || 3} onChange={(e) => handlePlatformChange('sponsored_density', parseInt(e.target.value))} min="2" max="10" className="mt-1" />
                    <p className="text-xs text-slate-500 mt-1">Insert a sponsored product every N organic products</p>
                  </div>
                </div>
              </div>

              {/* Sponsored Placements (where sponsored products are shown) */}
              <div className="mt-8 pt-6 border-t" data-testid="sponsored-placements-settings">
                <h3 className="font-semibold text-lg mb-1 flex items-center gap-2">
                  <span className="text-amber-500">✨</span> Sponsored Placements
                </h3>
                <p className="text-xs text-gray-500 mb-4">Control where sponsored / boosted products appear across the storefront. Defaults are all ON.</p>
                <div className="space-y-4">
                  {/* Master switch */}
                  <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3">
                    <div>
                      <Label className="font-semibold">Master Switch — All Sponsored Placements</Label>
                      <p className="text-xs text-gray-500">Turn every sponsored placement on or off at once</p>
                    </div>
                    <Switch
                      checked={platformSettings.sponsored_master_enabled !== false}
                      onCheckedChange={(checked) => handlePlatformChange('sponsored_master_enabled', checked)}
                      data-testid="sponsored-master-toggle"
                    />
                  </div>

                  <div className={`space-y-3 transition-opacity ${platformSettings.sponsored_master_enabled === false ? 'opacity-50 pointer-events-none' : ''}`}>
                    {[
                      { key: 'sponsored_placement_products', label: 'Products / Search page', desc: '"Sponsored picks" row + interleaved Ad cards in results', testid: 'toggle-placement-products' },
                      { key: 'sponsored_placement_product_detail', label: 'Product Detail page', desc: '"You may also like" carousel + "Promoted from this category" strip', testid: 'toggle-placement-product-detail' },
                      { key: 'sponsored_placement_cart_checkout', label: 'Cart & Checkout pages', desc: 'Compact "Sponsored add-ons" row above recommendations', testid: 'toggle-placement-cart-checkout' },
                      { key: 'sponsored_placement_category_band', label: 'Category landing band', desc: '"Featured in {Category}" band when a category is selected', testid: 'toggle-placement-category-band' },
                      { key: 'sponsored_placement_shop_public', label: 'Public Shop page', desc: '"Boosted by this shop" row + "Sponsored from other shops" band', testid: 'toggle-placement-shop-public' },
                    ].map((p) => (
                      <div key={p.key} className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-3">
                        <div className="pr-3">
                          <Label>{p.label}</Label>
                          <p className="text-xs text-gray-500">{p.desc}</p>
                        </div>
                        <Switch
                          checked={platformSettings[p.key] !== false}
                          onCheckedChange={(checked) => handlePlatformChange(p.key, checked)}
                          data-testid={p.testid}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                  <span className="text-blue-500">⚙️</span> Feature Toggles
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>Dark Mode</Label><p className="text-xs text-gray-500">Allow users to toggle dark mode</p></div>
                    <Switch checked={platformSettings.dark_mode_enabled !== false} onCheckedChange={(checked) => handlePlatformChange('dark_mode_enabled', checked)} data-testid="dark-mode-enabled-toggle" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><Label>Language Toggle (Arabic/English)</Label><p className="text-xs text-gray-500">Allow users to switch language</p></div>
                    <Switch checked={platformSettings.language_toggle_enabled !== false} onCheckedChange={(checked) => handlePlatformChange('language_toggle_enabled', checked)} data-testid="language-toggle-enabled" />
                  </div>
                </div>
              </div>

              {/* Event Popup Customization - REMOVED */}

              {/* Tier Settings - Link to separate page */}
              <div className="mt-8 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span className="text-violet-500">👑</span> Subscription Tier Settings
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Configure Starter & Pro plans, pricing, sales, and wallet credits</p>
                  </div>
                  <a href="/admin/subscription-tiers" className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium">
                    Manage Tiers →
                  </a>
                </div>
              </div>

              {/* ===== Brand Colors (themes the website + mobile app) ===== */}
              <div className="mt-8 pt-6 border-t" id="brand-colors-settings" data-testid="brand-colors-settings">
                <div className="mb-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <span className="text-violet-500">🎨</span> Brand Colors
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Set the Primary and Secondary colors used across the website and the mobile app. Changes preview instantly here and apply everywhere after you save.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { field: 'primary_color', label: 'Primary', fallback: '#000052' },
                    { field: 'secondary_color', label: 'Secondary', fallback: '#AA1233' },
                  ].map(({ field, label, fallback }) => {
                    const val = platformSettings[field] || fallback;
                    return (
                      <div key={field} className="rounded-xl border border-slate-200 p-4">
                        <Label className="mb-2 block">{label} color</Label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={val}
                            onChange={(e) => handleBrandColorChange(field, e.target.value)}
                            className="h-11 w-14 rounded-lg border border-slate-200 bg-white p-1 cursor-pointer"
                            data-testid={`brand-${field}-picker`}
                            aria-label={`${label} color picker`}
                          />
                          <Input
                            value={val}
                            onChange={(e) => handleBrandColorChange(field, e.target.value)}
                            placeholder={fallback}
                            className="font-mono uppercase"
                            data-testid={`brand-${field}-hex`}
                          />
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="h-8 flex-1 rounded-lg" style={{ backgroundColor: val }} />
                          <button type="button" onClick={() => handleBrandColorChange(field, fallback)} className="text-xs text-slate-500 hover:text-slate-800 underline">Reset</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-500">Preview:</span>
                  <span className="px-4 py-2 rounded-full text-white text-sm font-medium bg-gradient-to-r from-violet-600 to-indigo-600">Primary button</span>
                  <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-violet-100 text-violet-700">Soft badge</span>
                  <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-700">Secondary</span>
                </div>
              </div>

              {/* Save Platform Settings - at the very bottom */}
              <div className="mt-8 pt-6 border-t">
                <Button
                  onClick={handlePlatformSubmit}
                  disabled={savingPlatform}
                  className="w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                  data-testid="save-platform-settings-button"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {savingPlatform ? 'Saving...' : 'Save Platform Settings'}
                </Button>
              </div>
            </div>
          </div>

        {/* ===== TYPE IMAGES (Men/Women/Kids) SECTION ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm mt-8" id="type-images-settings" data-testid="type-images-settings">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-pink-50 rounded-xl">
              <ImageIcon className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-xl">Type Images (Men / Women / Kids)</h2>
              <p className="text-sm text-slate-500">These images appear on the homepage "Shop by Style" section</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['men', 'women', 'kids'].map(type => (
              <div key={type} className="space-y-3">
                <Label className="capitalize font-semibold">{type}</Label>
                {typeImages[type] && (
                  <img src={typeImages[type]} alt={type} className="w-full h-36 object-cover rounded-xl border" />
                )}
                <ImageUploader
                  value={typeImages[type] || ''}
                  onChange={(url) => setTypeImages(prev => ({ ...prev, [type]: url }))}
                  label={`${type.charAt(0).toUpperCase() + type.slice(1)} Image`}
                  showUrlInput={true}
                />
              </div>
            ))}
          </div>
          
          <Button
            onClick={handleSaveTypeImages}
            disabled={savingTypeImages}
            className="mt-6 w-full sm:w-auto rounded-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700"
            data-testid="save-type-images-button"
          >
            <Save className="h-4 w-4 mr-2" />
            {savingTypeImages ? 'Saving...' : 'Save Type Images'}
          </Button>
        </div>

        {/* ===== ABOUT PAGE EDITOR ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm mt-8" id="about-page-editor" data-testid="about-page-editor">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-violet-50 rounded-xl">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-xl">About Us Page</h2>
                <p className="text-sm text-slate-500">Add, edit, or remove sections on the About page</p>
              </div>
            </div>
            <Button
              onClick={addAboutSection}
              size="sm"
              className="bg-violet-600 hover:bg-violet-700"
              data-testid="add-about-section-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Section
            </Button>
          </div>

          {aboutSections.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No custom sections yet. The default About page will be shown.</p>
              <p className="text-xs mt-1">Add sections to customize your About page.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {aboutSections.map((section, index) => (
                <div key={index} className={`border rounded-xl p-4 transition-all ${section.is_active !== false ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-70'}`} data-testid={`about-section-${index}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Section {index + 1}</span>
                      {section.is_active === false && (
                        <span className="text-[10px] bg-slate-200 text-slate-500 px-2 py-0.5 rounded-full">Hidden</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Move up/down */}
                      <Button variant="ghost" size="sm" onClick={() => moveSection(index, 'up')} disabled={index === 0} className="h-7 px-2 text-slate-400 hover:text-slate-600">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => moveSection(index, 'down')} disabled={index === aboutSections.length - 1} className="h-7 px-2 text-slate-400 hover:text-slate-600">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                      </Button>
                      {/* Active toggle */}
                      <div className="flex items-center gap-1 mx-2">
                        <Switch
                          checked={section.is_active !== false}
                          onCheckedChange={(checked) => updateAboutSection(index, 'is_active', checked)}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAboutSection(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                        data-testid={`remove-about-section-${index}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Section Title</Label>
                      <Input
                        value={section.title}
                        onChange={(e) => updateAboutSection(index, 'title', e.target.value)}
                        placeholder="e.g., Our Story, Our Mission..."
                        data-testid={`about-section-title-${index}`}
                      />
                    </div>

                    {/* Text formatting toolbar */}
                    <div>
                      <Label>Content</Label>
                      <div className="flex items-center gap-2 mb-2 p-2 bg-slate-50 rounded-lg border border-slate-200">
                        <select
                          value={section.font_size || '16'}
                          onChange={(e) => updateAboutSection(index, 'font_size', e.target.value)}
                          className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                          title="Font Size"
                        >
                          <option value="12">12px</option>
                          <option value="14">14px</option>
                          <option value="16">16px</option>
                          <option value="18">18px</option>
                          <option value="20">20px</option>
                          <option value="24">24px</option>
                        </select>
                        <div className="h-4 w-px bg-slate-300" />
                        {['left', 'center', 'right'].map(align => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateAboutSection(index, 'text_align', align)}
                            className={`p-1.5 rounded text-xs ${section.text_align === align ? 'bg-violet-100 text-violet-700' : 'text-slate-500 hover:bg-slate-100'}`}
                            title={`Align ${align}`}
                          >
                            {align === 'left' && <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 10H3M21 6H3M21 14H3M17 18H3"/></svg>}
                            {align === 'center' && <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 10H6M21 6H3M21 14H3M18 18H6"/></svg>}
                            {align === 'right' && <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10H7M21 6H3M21 14H3M21 18H7"/></svg>}
                          </button>
                        ))}
                      </div>
                      <Textarea
                        value={section.content}
                        onChange={(e) => updateAboutSection(index, 'content', e.target.value)}
                        placeholder="Write the section content..."
                        rows={4}
                        style={{ fontSize: `${section.font_size || 16}px`, textAlign: section.text_align || 'left' }}
                        data-testid={`about-section-content-${index}`}
                      />
                    </div>

                    {/* Image with position selector */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label>Image URL (optional)</Label>
                        <Input
                          value={section.image || ''}
                          onChange={(e) => updateAboutSection(index, 'image', e.target.value)}
                          placeholder="https://..."
                          data-testid={`about-section-image-${index}`}
                        />
                        {section.image && (
                          <img src={section.image} alt="Preview" className="w-full h-24 object-cover rounded-lg mt-2 border" />
                        )}
                      </div>
                      <div>
                        <Label>Image Position</Label>
                        <div className="flex gap-2 mt-1">
                          {['left', 'right'].map(pos => (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => updateAboutSection(index, 'image_position', pos)}
                              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                                (section.image_position || 'right') === pos
                                  ? 'bg-violet-100 border-violet-300 text-violet-700'
                                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Image {pos === 'left' ? 'Left' : 'Right'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleSaveAboutPage}
            disabled={savingAbout}
            className="mt-6 w-full sm:w-auto rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            data-testid="save-about-page-button"
          >
            <Save className="h-4 w-4 mr-2" />
            {savingAbout ? 'Saving...' : 'Save About Page'}
          </Button>
        </div>

        {/* ===== TEAM MEMBERS MANAGEMENT ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm mt-8" id="team-members-section" data-testid="team-members-section">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-xl">Meet Our Team</h2>
                <p className="text-sm text-slate-500">Manage team members shown on the About page</p>
              </div>
            </div>
            <Button
              onClick={openAddTeamMember}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="add-team-member-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Member
            </Button>
          </div>

          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No team members added yet. Default team will be shown on About page.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamMembers.map((member) => (
                <div key={member.id} className="border border-slate-200 rounded-xl p-4 flex gap-4 items-start" data-testid={`team-member-card-${member.id}`}>
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                    {member.photo ? (
                      <img src={member.photo} alt={member.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <User className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-sm truncate">{member.name}</h4>
                    <p className="text-xs text-violet-600 font-medium">{member.position}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditTeamMember(member)}
                        className="h-7 px-2 text-slate-500 hover:text-slate-700"
                        data-testid={`edit-team-member-${member.id}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTeamMember(member.id)}
                        className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-team-member-${member.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Member Add/Edit Dialog */}
        <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTeamMember ? 'Edit Team Member' : 'Add Team Member'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="team-name">Name *</Label>
                <Input
                  id="team-name"
                  value={teamForm.name}
                  onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })}
                  placeholder="e.g., John Doe"
                  data-testid="team-name-input"
                />
              </div>
              <div>
                <Label htmlFor="team-position">Position *</Label>
                <Input
                  id="team-position"
                  value={teamForm.position}
                  onChange={(e) => setTeamForm({ ...teamForm, position: e.target.value })}
                  placeholder="e.g., CEO, CTO, Designer..."
                  data-testid="team-position-input"
                />
              </div>
              <div>
                <ImageUploader
                  value={teamForm.photo}
                  onChange={(url) => setTeamForm({ ...teamForm, photo: url })}
                  label="Photo (Upload or URL)"
                  showUrlInput={true}
                />
              </div>
              <div>
                <Label htmlFor="team-order">Display Order</Label>
                <Input
                  id="team-order"
                  type="number"
                  value={teamForm.order}
                  onChange={(e) => setTeamForm({ ...teamForm, order: parseInt(e.target.value) || 0 })}
                  min="0"
                  data-testid="team-order-input"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setTeamDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTeamMember}
                  disabled={savingTeamMember}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  data-testid="save-team-member-btn"
                >
                  {savingTeamMember ? 'Saving...' : (editingTeamMember ? 'Update' : 'Add Member')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===== TESTIMONIALS (WHAT SELLERS SAY) MANAGEMENT ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm mt-8" id="testimonials-section" data-testid="testimonials-section">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-xl">
                <Quote className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="font-heading font-semibold text-xl">What Sellers Say</h2>
                <p className="text-sm text-slate-500">Manage testimonials shown on the About page</p>
              </div>
            </div>
            <Button
              onClick={openAddTestimonial}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="add-testimonial-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Testimonial
            </Button>
          </div>

          {testimonials.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Quote className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No testimonials added yet. Default testimonials will be shown.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {testimonials.map((testimonial) => (
                <div key={testimonial.id} className="border border-slate-200 rounded-xl p-4" data-testid={`testimonial-card-${testimonial.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-0.5 mb-2">
                        {[...Array(testimonial.rating || 5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <p className="text-sm text-slate-700 mb-2 line-clamp-2">"{testimonial.text}"</p>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs">{testimonial.author}</span>
                        {testimonial.role && (
                          <span className="text-xs text-slate-500">- {testimonial.role}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditTestimonial(testimonial)}
                        className="h-7 px-2"
                        data-testid={`edit-testimonial-${testimonial.id}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTestimonial(testimonial.id)}
                        className="h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                        data-testid={`delete-testimonial-${testimonial.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Testimonial Add/Edit Dialog */}
        <Dialog open={testimonialDialogOpen} onOpenChange={setTestimonialDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingTestimonial ? 'Edit Testimonial' : 'Add Testimonial'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="testimonial-text">Quote Text *</Label>
                <Textarea
                  id="testimonial-text"
                  value={testimonialForm.text}
                  onChange={(e) => setTestimonialForm({ ...testimonialForm, text: e.target.value })}
                  placeholder="What the seller said..."
                  rows={3}
                  data-testid="testimonial-text-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="testimonial-author">Author Name *</Label>
                  <Input
                    id="testimonial-author"
                    value={testimonialForm.author}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, author: e.target.value })}
                    placeholder="e.g., Maria G."
                    data-testid="testimonial-author-input"
                  />
                </div>
                <div>
                  <Label htmlFor="testimonial-role">Role / Title</Label>
                  <Input
                    id="testimonial-role"
                    value={testimonialForm.role}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, role: e.target.value })}
                    placeholder="e.g., Jewelry Seller"
                    data-testid="testimonial-role-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="testimonial-rating">Rating (1-5)</Label>
                  <div className="flex gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setTestimonialForm({ ...testimonialForm, rating: star })}
                        className="p-0.5"
                      >
                        <Star className={`h-6 w-6 ${star <= testimonialForm.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label htmlFor="testimonial-order">Display Order</Label>
                  <Input
                    id="testimonial-order"
                    type="number"
                    value={testimonialForm.order}
                    onChange={(e) => setTestimonialForm({ ...testimonialForm, order: parseInt(e.target.value) || 0 })}
                    min="0"
                    data-testid="testimonial-order-input"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setTestimonialDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveTestimonial}
                  disabled={savingTestimonial}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  data-testid="save-testimonial-btn"
                >
                  {savingTestimonial ? 'Saving...' : (editingTestimonial ? 'Update' : 'Add Testimonial')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>


        {/* ===== STATES & DELIVERY FEES SECTION ===== */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 lg:p-8 shadow-sm mt-8" id="states-section">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-xl">
                <MapPin className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-900">States & Delivery Fees</h3>
                <p className="text-sm text-slate-500">Manage states with their delivery fees. These will appear in signup, checkout, and other forms.</p>
              </div>
            </div>
            <Button
              onClick={openAddState}
              size="sm"
              className="bg-teal-600 hover:bg-teal-700"
              data-testid="add-state-btn"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add State
            </Button>
          </div>

          {states.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MapPin className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>No states added yet. Add states to enable location-based delivery fees.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">State Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Delivery Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {states.map((state) => (
                    <tr key={state.id} data-testid={`state-row-${state.id}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{state.name}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-teal-700">${state.delivery_fee.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${state.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {state.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditState(state)}
                            data-testid={`edit-state-${state.id}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteState(state.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-state-${state.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* State Add/Edit Dialog */}
        <Dialog open={stateDialogOpen} onOpenChange={setStateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingState ? 'Edit State' : 'Add State'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label htmlFor="state-name">State Name *</Label>
                <Input
                  id="state-name"
                  value={stateForm.name}
                  onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })}
                  placeholder="e.g., California"
                  data-testid="state-name-input"
                />
              </div>
              <div>
                <Label htmlFor="state-delivery-fee">Delivery Fee ($)</Label>
                <Input
                  id="state-delivery-fee"
                  type="number"
                  value={stateForm.delivery_fee}
                  onChange={(e) => setStateForm({ ...stateForm, delivery_fee: e.target.value })}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  data-testid="state-delivery-fee-input"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="state-active"
                  checked={stateForm.is_active}
                  onChange={(e) => setStateForm({ ...stateForm, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                  data-testid="state-active-checkbox"
                />
                <Label htmlFor="state-active" className="mb-0">Active</Label>
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setStateDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveState}
                  disabled={savingState}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  data-testid="save-state-btn"
                >
                  {savingState ? 'Saving...' : (editingState ? 'Update' : 'Add State')}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Terms of Service Editor */}
        <TosEditor />

        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;