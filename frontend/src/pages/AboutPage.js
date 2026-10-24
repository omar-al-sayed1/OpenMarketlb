import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, Users, Shield, Truck, Star, Heart, 
  ArrowRight, Globe, Zap, Award, TrendingUp,
  Target, Rocket, CheckCircle2, Quote, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, useInView } from 'framer-motion';
import Marquee from 'react-fast-marquee';
import EndOfPagePromos from '../components/EndOfPagePromos';
import { api } from '../lib/api';
import { useLanguage } from '../lib/i18n';

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } }
};

function AnimatedSection({ children, className = '', id, testId }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.section
      ref={ref}
      id={id}
      data-testid={testId}
      className={className}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={stagger}
    >
      {children}
    </motion.section>
  );
}

function CountUp({ target, suffix = '' }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  
  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, target]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const AboutPage = () => {
  const { t, language } = useLanguage();
  const [customSections, setCustomSections] = useState([]);
  const [hasCustomContent, setHasCustomContent] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [stats, setStats] = useState({ sellers: 0, products: 0, orders: 0, customers: 0 });

  useEffect(() => {
    fetchAboutContent();
    fetchTeamMembers();
    fetchTestimonials();
    fetchRealStats();
  }, []);

  const fetchRealStats = async () => {
    try {
      const { data } = await api.publicStats.get();
      setStats({
        sellers: data.sellers || 0,
        products: data.products || 0,
        orders: data.orders || 0,
        customers: data.customers || 0
      });
    } catch (error) { console.error('Failed to fetch stats', error); }
  };

  const fetchAboutContent = async () => {
    try {
      const { data } = await api.aboutPage.get();
      if (data.sections && data.sections.length > 0) {
        setCustomSections(data.sections);
        setHasCustomContent(true);
      }
    } catch (error) { console.error('Failed to fetch about page content', error); }
  };

  const fetchTeamMembers = async () => {
    try { const { data } = await api.teamMembers.getAll(); setTeamMembers(data); } catch (error) { console.error('Failed to fetch team members', error); }
  };

  const fetchTestimonials = async () => {
    try { const { data } = await api.testimonials.getAll(); setTestimonials(data); } catch (error) { console.error('Failed to fetch testimonials', error); }
  };

  const values = [
    { icon: Shield, title: 'Trust & Security', desc: 'Every transaction is protected with bank-level encryption', accent: 'emerald' },
    { icon: Heart, title: 'Customer First', desc: 'Your satisfaction is our #1 priority, always', accent: 'rose' },
    { icon: Zap, title: 'Innovation', desc: 'Constantly evolving to serve you better', accent: 'amber' },
    { icon: Globe, title: 'Community', desc: 'Building bridges between sellers and buyers', accent: 'violet' },
  ];

  const displayTeam = teamMembers.length > 0 ? teamMembers : [
    { name: 'Sarah Chen', position: 'CEO & Founder', photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop' },
    { name: 'Marcus Johnson', position: 'CTO', photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop' },
    { name: 'Elena Rodriguez', position: 'Head of Design', photo: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop' },
    { name: 'James Wilson', position: 'Head of Operations', photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop' },
  ];

  const displayTestimonials = testimonials.length > 0 ? testimonials : [
    { text: "OpenMarketlb transformed my small business into a thriving online store. The support is incredible!", author: "Maria G.", role: "Handmade Jewelry Seller", rating: 5 },
    { text: "Best marketplace platform I've used. The analytics help me understand my customers better.", author: "David K.", role: "Electronics Retailer", rating: 5 },
    { text: "From zero to 1000 orders in 6 months. OpenMarketlb made it possible!", author: "Lisa M.", role: "Fashion Boutique Owner", rating: 5 },
  ];

  const statsData = [
    { value: stats.sellers, suffix: '+', label: 'Active Sellers', icon: Users },
    { value: stats.products, suffix: '+', label: 'Products Listed', icon: ShoppingBag },
    { value: stats.orders, suffix: '+', label: 'Orders Fulfilled', icon: Truck },
    { value: stats.customers, suffix: '+', label: 'Happy Customers', icon: Star },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 font-body" data-testid="about-page">
      {/* ========== HERO — photo-less, animated, brand-aligned ========== */}
      <section className="relative min-h-[88vh] sm:min-h-[90vh] flex items-center justify-center overflow-hidden bg-slate-950" data-testid="about-hero">
        {/* Base brand gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-indigo-950 to-slate-950" />

        {/* Animated color blobs (no images) */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-40 -left-24 w-[34rem] h-[34rem] rounded-full bg-violet-600/30 blur-[130px]"
            animate={{ x: [0, 70, 0], y: [0, 50, 0], scale: [1, 1.18, 1] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute top-1/4 -right-28 w-[32rem] h-[32rem] rounded-full bg-emerald-500/25 blur-[130px]"
            animate={{ x: [0, -60, 0], y: [0, -30, 0], scale: [1, 1.22, 1] }}
            transition={{ duration: 17, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-[-6rem] left-1/3 w-[28rem] h-[28rem] rounded-full bg-fuchsia-500/20 blur-[120px]"
            animate={{ x: [0, 50, 0], y: [0, -40, 0], scale: [1, 1.12, 1] }}
            transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        {/* Subtle grid mesh */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
          }}
        />

        {/* Slow-rotating conic accent ring */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[42rem] h-[42rem] rounded-full opacity-20"
          style={{
            background:
              'conic-gradient(from 0deg, transparent, rgba(139,92,246,0.5), transparent, rgba(16,185,129,0.5), transparent)',
            maskImage: 'radial-gradient(circle, transparent 58%, black 60%, transparent 72%)',
            WebkitMaskImage: 'radial-gradient(circle, transparent 58%, black 60%, transparent 72%)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
        />

        {/* Floating sparkle accents */}
        {[
          { top: '18%', left: '12%', d: 6, s: 'h-4 w-4 text-emerald-300/70' },
          { top: '28%', right: '14%', d: 7, s: 'h-5 w-5 text-violet-300/70' },
          { bottom: '24%', left: '18%', d: 8, s: 'h-3.5 w-3.5 text-fuchsia-300/70' },
          { bottom: '30%', right: '20%', d: 9, s: 'h-4 w-4 text-cyan-300/60' },
        ].map((p, i) => (
          <motion.div
            key={i}
            className="absolute hidden sm:block"
            style={{ top: p.top, bottom: p.bottom, left: p.left, right: p.right }}
            animate={{ y: [0, -16, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: p.d, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Sparkles className={p.s} />
          </motion.div>
        ))}

        {/* Content */}
        <div className="relative max-w-5xl mx-auto px-6 text-center z-10 py-16">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-white text-xs font-semibold tracking-[0.18em] uppercase mb-8 shadow-lg shadow-violet-900/30">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Empowering Entrepreneurs
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-heading font-bold tracking-tight leading-[1.05] mb-6 text-white"
          >
            We're Building the
            <br />
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-violet-300 bg-clip-text text-transparent">
                Future of Commerce
              </span>
              <motion.span
                className="absolute -bottom-2 left-0 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-violet-400"
                initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 1, delay: 0.9, ease: 'easeOut' }}
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.45 }}
            className="text-base sm:text-lg text-white/75 max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            <span className="text-emerald-300 font-semibold">Open</span>
            <span className="text-violet-300 font-semibold">Market</span>
            <sup className="text-violet-300 text-xs">lb</sup> is more than a marketplace. We're a community of dreamers, creators, and entrepreneurs building Lebanon's digital economy.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.6 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            <Button asChild size="lg" className="rounded-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-8 border-0 shadow-lg shadow-emerald-900/40 hover:scale-[1.03] transition-transform" data-testid="about-hero-cta-sell">
              <Link to="/become-seller">Start Selling <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full border-white/30 bg-white/5 backdrop-blur-md text-white hover:bg-white/15 px-8" data-testid="about-hero-cta-explore">
              <Link to="/products">Explore Products</Link>
            </Button>
          </motion.div>

          {/* Live stat pills (real data, no photo) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.8 }}
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto"
          >
            {statsData.map((s, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xl sm:text-2xl font-bold text-white">
                  <s.icon className="h-4 w-4 text-emerald-300" />
                  <CountUp target={s.value} suffix={s.suffix} />
                </div>
                <p className="text-[11px] text-white/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bottom fade into the white page body */}
        <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ========== BRAND STORY / MISSION ========== */}
      <AnimatedSection className="py-24 lg:py-32 bg-white" testId="about-mission">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-12 gap-8 items-center">
            <motion.div variants={fadeUp} className="md:col-span-7">
              <span className="text-emerald-600 text-xs font-bold tracking-[0.2em] uppercase mb-4 block">Our Story</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold tracking-tight mb-6 leading-tight text-slate-900">
                Born in <span className="text-emerald-600">Beirut</span>,<br />Built for the World
              </h2>
              <p className="text-slate-600 text-base sm:text-lg leading-relaxed mb-6">
                We started with a simple idea: give every Lebanese entrepreneur the tools to reach customers online. Today, we power hundreds of shops across the country, helping small businesses thrive in the digital age.
              </p>
              <p className="text-slate-500 text-sm leading-relaxed">
                Our platform provides everything from storefront creation and inventory management to advanced analytics and marketing tools. We believe that technology should be accessible to everyone, not just the big players.
              </p>
            </motion.div>
            <motion.div variants={fadeUp} className="md:col-span-5">
              <div className="relative rounded-3xl overflow-hidden aspect-[4/5] border border-slate-200 shadow-xl">
                <img 
                  src="https://images.pexels.com/photos/5054951/pexels-photo-5054951.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940" 
                  alt="Beirut skyline" 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </AnimatedSection>

      {/* ========== CUSTOM ADMIN SECTIONS ========== */}
      {hasCustomContent && (
        <section className="py-16 bg-slate-50" data-testid="about-custom-sections">
          <div className="max-w-7xl mx-auto px-6">
            <div className="space-y-20">
              {customSections.filter(s => s.is_active !== false).map((section, idx) => (
                <div key={idx} className={`grid ${section.image ? 'lg:grid-cols-2 gap-12 items-center' : ''}`} data-testid={`custom-section-${idx}`}>
                  <div className={(section.image_position || 'right') === 'left' && section.image ? 'lg:order-2' : ''}>
                    <h2 className="text-2xl sm:text-3xl font-heading font-bold mb-4 text-slate-900">{section.title}</h2>
                    <div 
                      className="text-slate-600 whitespace-pre-line leading-relaxed"
                      style={{ 
                        fontSize: section.font_size ? `${section.font_size}px` : '16px',
                        textAlign: section.text_align || 'left'
                      }}
                    >
                      {section.content}
                    </div>
                  </div>
                  {section.image && (
                    <div className={(section.image_position || 'right') === 'left' ? 'lg:order-1' : ''}>
                      <div className="aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-lg">
                        <img src={section.image} alt={section.title} className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ========== ANIMATED STATS ========== */}
      <AnimatedSection className="py-24 relative overflow-hidden" testId="about-stats">
        <div className="absolute inset-0">
          <img 
            src="https://static.prod-images.emergentagent.com/jobs/9d89ddeb-269f-4464-a8b1-61ee1dee466f/images/956a48023e21214d7bbbd4ed85b0571ce580be89e53300a9ef39880e53cb9721.png"
            alt=""
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/70" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6">
          <motion.div variants={fadeUp} className="text-center mb-12">
            <span className="text-violet-400 text-xs font-bold tracking-[0.2em] uppercase mb-3 block">By The Numbers</span>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-white">Growing Every Day</h2>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {statsData.map((stat, idx) => (
              <motion.div 
                key={idx} 
                variants={fadeUp}
                className="relative bg-white/10 backdrop-blur-xl border border-white/15 rounded-2xl p-6 sm:p-8 text-center group hover:border-emerald-400/40 transition-colors duration-500"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 group-hover:bg-emerald-500/30 transition-colors">
                  <stat.icon className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-3xl sm:text-4xl font-heading font-bold text-white mb-1">
                  <CountUp target={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-xs sm:text-sm text-white/60 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ========== OUR VALUES ========== */}
      <AnimatedSection className="py-24 lg:py-32 bg-white" testId="about-values">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-emerald-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 block">What Drives Us</span>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-slate-900">Our Values</h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto text-sm sm:text-base">These principles guide everything we do</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {values.map((value, idx) => {
              const colorMap = { emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600', rose: 'bg-rose-50 border-rose-200 text-rose-600', amber: 'bg-amber-50 border-amber-200 text-amber-600', violet: 'bg-violet-50 border-violet-200 text-violet-600' };
              const iconBgMap = { emerald: 'bg-emerald-100', rose: 'bg-rose-100', amber: 'bg-amber-100', violet: 'bg-violet-100' };
              return (
                <motion.div 
                  key={idx}
                  variants={fadeUp}
                  className="group relative bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 transition-all duration-500 hover:shadow-xl hover:border-slate-300 cursor-default"
                  data-testid={`about-value-${idx}`}
                >
                  <div className={`w-12 h-12 rounded-xl ${iconBgMap[value.accent]} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                    <value.icon className={`h-5 w-5 ${colorMap[value.accent].split(' ').pop()}`} />
                  </div>
                  <h3 className="text-lg font-heading font-bold mb-2 text-slate-900">{value.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{value.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </AnimatedSection>

      {/* ========== MEET OUR TEAM ========== */}
      <AnimatedSection className="py-24 lg:py-32 bg-slate-50" testId="about-team">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div variants={fadeUp} className="text-center mb-16">
            <span className="text-violet-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 block">The People</span>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-slate-900">Meet Our Team</h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto text-sm sm:text-base">Passionate people building the future of e-commerce</p>
          </motion.div>
          <div className={`grid sm:grid-cols-2 ${displayTeam.length <= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-4 xl:grid-cols-5'} gap-5 sm:gap-6`}>
            {displayTeam.map((member, idx) => (
              <motion.div 
                key={member.id || idx} 
                variants={fadeUp}
                className="group text-center"
                data-testid={`team-member-${idx}`}
              >
                <div className="relative mb-5 inline-block">
                  <div className="w-40 h-40 sm:w-48 sm:h-48 rounded-2xl overflow-hidden mx-auto border border-slate-200 group-hover:border-emerald-300 transition-all duration-500 shadow-lg">
                    <img 
                      src={member.photo || member.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=10b981&color=fff&size=200&bold=true`} 
                      alt={member.name}
                      className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                </div>
                <h3 className="text-base font-heading font-bold text-slate-900">{member.name}</h3>
                <p className="text-xs text-emerald-600 font-medium mt-1">{member.position || member.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* ========== WHAT SELLERS SAY - Marquee ========== */}
      <AnimatedSection className="py-24 lg:py-32 overflow-hidden bg-white" testId="about-testimonials">
        <div className="max-w-7xl mx-auto px-6 mb-12">
          <motion.div variants={fadeUp} className="text-center">
            <span className="text-amber-600 text-xs font-bold tracking-[0.2em] uppercase mb-3 block">Testimonials</span>
            <h2 className="text-3xl sm:text-4xl font-heading font-bold tracking-tight text-slate-900">What Sellers Say</h2>
            <p className="text-slate-500 mt-3 max-w-lg mx-auto text-sm sm:text-base">Success stories from our community</p>
          </motion.div>
        </div>
        
        <Marquee speed={30} pauseOnHover gradient={false} className="py-2">
          {[...displayTestimonials, ...displayTestimonials].map((item, idx) => (
            <div 
              key={idx} 
              className="mx-3 sm:mx-4 w-[340px] sm:w-[400px] flex-shrink-0"
              data-testid={`testimonial-${idx % displayTestimonials.length}`}
            >
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 h-full hover:border-amber-300 hover:shadow-lg transition-all duration-500">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(item.rating || 5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <Quote className="h-6 w-6 text-slate-200 mb-3" />
                <p className="text-sm sm:text-base text-slate-700 leading-relaxed mb-6">"{item.text}"</p>
                <div className="border-t border-slate-200 pt-4">
                  <p className="font-heading font-bold text-slate-900 text-sm">{item.author}</p>
                  <p className="text-xs text-slate-500">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </Marquee>
      </AnimatedSection>

      {/* ========== CTA ========== */}
      <section className="py-24 lg:py-32 relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-600 to-violet-600" data-testid="about-cta">
        <div className="absolute top-[-200px] left-[20%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-200px] right-[20%] w-[400px] h-[400px] bg-white/10 rounded-full blur-[120px]" />
        
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <motion.div 
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <Rocket className="h-12 w-12 text-white/60 mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-bold tracking-tight mb-6 leading-tight text-white">
              Ready to Start Your<br /><span className="text-amber-300">Journey?</span>
            </h2>
            <p className="text-base sm:text-lg text-white/80 mb-10 max-w-xl mx-auto">
              Join thousands of successful sellers who trust <span className="text-amber-200 font-semibold">OpenMarket</span><sup className="text-amber-200 text-xs">lb</sup> to grow their business.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button asChild size="lg" className="rounded-full bg-white text-emerald-700 hover:bg-white/90 font-bold px-8 border-0" data-testid="about-cta-sell">
                <Link to="/become-seller">Become a Seller <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/40 text-white hover:bg-white/10 px-8" data-testid="about-cta-contact">
                <Link to="/contact">Contact Us</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== SPONSORED ADD-ONS + RECOMMENDED (with interleaved sponsored) ========== */}
      <div className="bg-white pb-8 sm:pb-12" data-testid="about-end-promos">
        <EndOfPagePromos />
      </div>
    </div>
  );
};

export default AboutPage;
