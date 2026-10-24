import React, { useState, useEffect } from 'react';
import { Send, Mail, Phone, MapPin, MessageCircle, Upload, X, Loader2, CheckCircle, Sparkles, HelpCircle, Bug, Lightbulb, AlertTriangle, Handshake, ArrowRight, Clock, Heart, Shield, Globe, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ImageUploader from '../components/ImageUploader';
import EndOfPagePromos from '../components/EndOfPagePromos';
import { api } from '../lib/api';
import { toast } from 'sonner';
import { useLanguage } from '../lib/i18n';

const MESSAGE_TYPES = [
  { value: 'general', label: 'General Inquiry', icon: HelpCircle, color: 'bg-violet-100 text-violet-700 border-violet-300', activeBg: 'bg-violet-600' },
  { value: 'bug', label: 'Report a Bug', icon: Bug, color: 'bg-red-100 text-red-700 border-red-300', activeBg: 'bg-red-600' },
  { value: 'suggestion', label: 'Suggestion', icon: Lightbulb, color: 'bg-amber-100 text-amber-700 border-amber-300', activeBg: 'bg-amber-600' },
  { value: 'complaint', label: 'Complaint', icon: AlertTriangle, color: 'bg-orange-100 text-orange-700 border-orange-300', activeBg: 'bg-orange-600' },
  { value: 'partnership', label: 'Partnership', icon: Handshake, color: 'bg-emerald-100 text-emerald-700 border-emerald-300', activeBg: 'bg-emerald-600' },
];

const ContactPage = () => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [settings, setSettings] = useState(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '',
  });

  useEffect(() => { fetchSettings(); }, []);
  const fetchSettings = async () => { try { const { data } = await api.settings.get(); setSettings(data); } catch (e) {} };
  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.contact.send(formData);
      setSubmitted(true);
      toast.success('Message sent successfully!');
    } catch (error) {
      toast.error('Failed to send message. Please try again.');
    } finally { setLoading(false); }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-emerald-50 to-white px-4">
        <div className="text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 bg-emerald-200 rounded-full animate-ping opacity-30" />
            <div className="relative w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-emerald-600" />
            </div>
          </div>
          <h2 className="text-3xl font-heading font-bold mb-3">Message Sent!</h2>
          <p className="text-slate-600 mb-8">Thanks for reaching out. We'll get back to you within 24 hours.</p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', phone_number: '', message: '', message_type: 'general', photo: '' }); }} variant="outline" className="rounded-full">
              Send Another
            </Button>
            <Button onClick={() => window.location.href = '/products'} className="rounded-full bg-gradient-to-r from-violet-600 to-indigo-600">
              Browse Products <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 overflow-x-hidden">
      {/* Hero Section - Creative */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-pink-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute top-40 right-20 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl" />
          {/* Floating dots pattern */}
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '30px 30px'}} />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur-sm rounded-full text-white/90 font-medium text-sm mb-8 border border-white/20">
              <Sparkles className="h-4 w-4" />
              We'd love to hear from you
            </div>
            <h1 className="text-5xl md:text-7xl font-heading font-bold mb-5 text-white leading-tight" data-testid="contact-page-title">
              Get in <span className="bg-gradient-to-r from-amber-300 to-pink-300 bg-clip-text text-transparent">Touch</span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-12">
              Have a question, idea, or just want to say hello? We're here and ready to help you.
            </p>

            {/* Contact Info Cards - Floating */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto" data-testid="contact-info-header">
              <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Mail className="h-7 w-7 text-white" />
                </div>
                <p className="text-white/60 text-xs mb-1">Email</p>
                <p className="font-semibold text-white text-sm" data-testid="contact-email-display">
                  {settings?.contact_email || 'contact@openmarketlb.com'}
                </p>
              </div>
              <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Phone className="h-7 w-7 text-white" />
                </div>
                <p className="text-white/60 text-xs mb-1">Phone</p>
                <p className="font-semibold text-white text-sm" data-testid="contact-phone-display">
                  {settings?.contact_phone || '12-345-6789'}
                </p>
              </div>
              <div className="group bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="w-14 h-14 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <MapPin className="h-7 w-7 text-white" />
                </div>
                <p className="text-white/60 text-xs mb-1">Location</p>
                <p className="font-semibold text-white text-sm">Lebanon</p>
              </div>
            </div>
          </div>
        </div>
        {/* Wave separator */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 40C360 80 720 0 1440 40V100H0V40Z" className="fill-white dark:fill-slate-900"/>
          </svg>
        </div>
      </div>

      {/* Form Section */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 -mt-6 relative z-10">
        <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden" data-testid="contact-form">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-slate-50 to-violet-50 dark:from-slate-800 dark:to-violet-900/30 p-6 border-b dark:border-slate-700">
            <h2 className="font-heading font-bold text-2xl flex items-center gap-3 dark:text-white">
              <div className="bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl p-2">
                <MessageCircle className="h-5 w-5 text-white" />
              </div>
              Send us a Message
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 ml-12">Fill in the form below and we'll respond as soon as possible</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 lg:p-8 space-y-6">
            {/* Message Type - Creative pills */}
            <div>
              <Label className="mb-3 block text-sm font-semibold dark:text-slate-200">What's this about?</Label>
              <div className="flex flex-wrap gap-2">
                {MESSAGE_TYPES.map((type) => {
                  const Icon = type.icon;
                  const isSelected = formData.message_type === type.value;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, message_type: type.value })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 text-sm font-medium transition-all ${
                        isSelected
                          ? `${type.activeBg} text-white border-transparent shadow-lg scale-105`
                          : `${type.color} hover:scale-105`
                      }`}
                      data-testid={`msg-type-${type.value}`}
                    >
                      <Icon className="h-4 w-4" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label htmlFor="name" className="text-sm font-semibold dark:text-slate-200">Your Name *</Label>
                <Input id="name" name="name" value={formData.name} onChange={handleChange} required placeholder="John Doe" className="mt-1.5 rounded-xl h-12 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:bg-white dark:focus:bg-slate-600" data-testid="contact-name-input" />
              </div>
              <div>
                <Label htmlFor="email" className="text-sm font-semibold dark:text-slate-200">Your Email *</Label>
                <Input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required placeholder="john@example.com" className="mt-1.5 rounded-xl h-12 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:bg-white dark:focus:bg-slate-600" data-testid="contact-email-input" />
              </div>
            </div>

            <div>
              <Label htmlFor="phone_number" className="text-sm font-semibold dark:text-slate-200">Phone Number *</Label>
              <Input id="phone_number" name="phone_number" type="tel" value={formData.phone_number} onChange={handleChange} required placeholder="+961 XX XXX XXX" className="mt-1.5 rounded-xl h-12 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:bg-white dark:focus:bg-slate-600" data-testid="contact-phone-input" />
            </div>

            <div>
              <Label htmlFor="message" className="text-sm font-semibold dark:text-slate-200">Your Message *</Label>
              <Textarea id="message" name="message" value={formData.message} onChange={handleChange} required rows={6} placeholder="Tell us what's on your mind..." className="mt-1.5 rounded-xl bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 dark:text-white focus:bg-white dark:focus:bg-slate-600 resize-none" data-testid="contact-message-input" />
            </div>

            {/* Photo Upload */}
            <div>
              <ImageUploader value={formData.photo} onChange={(url) => setFormData({ ...formData, photo: url })} label="Attach a screenshot (optional)" showUrlInput={false} />
            </div>

            <Button type="submit" disabled={loading} className="w-full rounded-xl h-13 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-base font-semibold shadow-lg shadow-violet-200 hover:shadow-xl transition-all" data-testid="send-message-button">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="h-4 w-4 mr-2" /> Send Message</>}
            </Button>
          </form>
        </div>

        {/* Why Contact Us - Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
          {[
            { icon: Clock, title: 'Fast Response', desc: 'We reply within 24 hours', color: 'from-blue-500 to-cyan-500' },
            { icon: Heart, title: 'Customer First', desc: 'Your satisfaction matters', color: 'from-pink-500 to-rose-500' },
            { icon: Shield, title: 'Secure & Private', desc: 'Your data is safe with us', color: 'from-emerald-500 to-teal-500' },
            { icon: Globe, title: 'Lebanon-wide', desc: 'Supporting all regions', color: 'from-violet-500 to-indigo-500' },
          ].map((item, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 text-center hover:shadow-lg transition-all hover:-translate-y-0.5 group">
              <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <item.icon className="h-6 w-6 text-white" />
              </div>
              <h4 className="font-bold text-sm mb-1 dark:text-white">{item.title}</h4>
              <p className="text-xs text-slate-400 dark:text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sponsored add-ons + Recommended (with interleaved sponsored carousels) */}
      <div className="pb-8" data-testid="contact-end-promos">
        <EndOfPagePromos />
      </div>
    </div>
  );
};

export default ContactPage;
