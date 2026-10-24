import React, { useState, useEffect } from 'react';
import BrandName from './BrandName';
import { Link } from 'react-router-dom';
import { Store, Mail, Phone, MapPin, Instagram, Facebook } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { api } from '../lib/api';

const Footer = () => {
  const { t } = useLanguage();
  const [logoUrl, setLogoUrl] = useState('/logo.png');
  const [socials, setSocials] = useState({ instagram_url: '', facebook_url: '' });
  
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await api.admin.getPlatformSettings();
        if (data?.logo_url) setLogoUrl(data.logo_url);
        setSocials({
          instagram_url: data?.instagram_url || '',
          facebook_url: data?.facebook_url || '',
        });
      } catch {}
    };
    fetchLogo();
  }, []);

  return (
    <footer className="bg-slate-950 text-slate-400 pt-14 pb-8" data-testid="site-footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img src={logoUrl} alt="OpenMarketlb" className="w-14 h-14 rounded-xl shadow-lg object-contain" />
              <span className="text-lg font-extrabold tracking-tight"><BrandName showLb /></span>
            </Link>
            <p className="text-sm leading-relaxed text-slate-500 max-w-[220px]">
              {t('footer.description')}
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="mailto:support@openmarketlb.com" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center text-slate-500 hover:text-violet-400 transition-colors" aria-label="Email us">
                <Mail className="h-4 w-4" />
              </a>
              <a href="tel:+1234567890" className="w-8 h-8 rounded-lg bg-white/5 hover:bg-violet-500/20 flex items-center justify-center text-slate-500 hover:text-violet-400 transition-colors" aria-label="Call us">
                <Phone className="h-4 w-4" />
              </a>
              {socials.instagram_url && (
                <a
                  href={socials.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-pink-500/20 flex items-center justify-center text-slate-500 hover:text-pink-400 transition-colors"
                  aria-label="Instagram"
                  data-testid="footer-instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {socials.facebook_url && (
                <a
                  href={socials.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-blue-500/20 flex items-center justify-center text-slate-500 hover:text-blue-400 transition-colors"
                  aria-label="Facebook"
                  data-testid="footer-facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
              <span className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-500">
                <MapPin className="h-4 w-4" />
              </span>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">{t('nav.shop')}</h4>
            <div className="space-y-2.5">
              <Link to="/products" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">{t('footer.products')}</Link>
              <Link to="/products?category=electronics" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">Electronics</Link>
              <Link to="/products?category=fashion" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">Fashion</Link>
              <Link to="/products?category=home" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">Home & Living</Link>
            </div>
          </div>

          {/* Sellers */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">{t('footer.becomeSeller')}</h4>
            <div className="space-y-2.5">
              <Link to="/become-seller" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">{t('nav.becomeSeller')}</Link>
              <Link to="/auth" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">{t('nav.login')}</Link>
              <Link to="/contact" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">{t('footer.customerService')}</Link>
            </div>
          </div>

          {/* Help */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-4">{t('footer.quickLinks')}</h4>
            <div className="space-y-2.5">
              <Link to="/track-order" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">{t('footer.trackOrder')}</Link>
              <Link to="/contact" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">{t('footer.contact')}</Link>
              <Link to="/about" className="block text-sm text-slate-500 hover:text-violet-400 transition-colors">{t('footer.about')}</Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} <span className="font-semibold"><BrandName showLb dim /></span>. {t('footer.rights')}</p>
          <div className="flex items-center gap-5">
            <Link to="/contact" className="text-xs text-slate-600 hover:text-violet-400 transition-colors">{t('footer.privacy')}</Link>
            <Link to="/terms-of-service" className="text-xs text-slate-600 hover:text-violet-400 transition-colors">{t('footer.terms')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
