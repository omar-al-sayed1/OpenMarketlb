import React from 'react';
import { ShieldCheck } from 'lucide-react';

/**
 * Static privacy policy — self-contained (no admin CMS needed) so the URL
 * openmarketlb.com/privacy is always available (required by Google Play / app stores).
 */
const LAST_UPDATED = 'July 26, 2026';
const CONTACT_EMAIL = 'contact@openmarketlb.com';

const PrivacyPolicyPage = () => {
  return (
    <div className="min-h-screen py-8 sm:py-12" data-testid="privacy-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Privacy Policy</h1>
        </div>
        <p className="text-sm text-slate-400 mb-8">Last updated: {LAST_UPDATED}</p>

        <div
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sm:p-10 prose prose-slate max-w-none
            prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed
            prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-4
            prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3
            prose-ul:text-slate-600 prose-li:text-slate-600 prose-a:text-violet-700"
        >
          <p>
            This Privacy Policy explains how <strong>OpenMarketlb</strong> ("OpenMarketlb", "we",
            "us", or "our") collects, uses, shares, and protects your information when you use our
            website (openmarketlb.com) and our mobile application (together, the "Services"). We
            operate an online marketplace connecting buyers and sellers in Lebanon. By using the
            Services, you agree to this Policy.
          </p>

          <h2>1. Information We Collect</h2>

          <h3>Information you give us</h3>
          <ul>
            <li><strong>Account &amp; profile:</strong> name, email address, phone number, and password.</li>
            <li><strong>Orders &amp; delivery:</strong> delivery address, recipient name and phone, and order details.</li>
            <li><strong>Seller applications:</strong> shop name, description, contact details, and business address (if you apply to sell).</li>
            <li><strong>Communications:</strong> messages you send to shops or support, reviews, and contact-form submissions.</li>
            <li><strong>Uploads:</strong> images you upload (e.g. shop logos, product photos, support attachments).</li>
          </ul>

          <h3>Payment information</h3>
          <p>
            When you pay by card, your card details are collected and processed directly by our
            payment processor (Stripe). We do <strong>not</strong> store your full card number. We
            may retain limited transaction data (amount, status, method) to fulfil orders. Cash on
            delivery and wallet payments are also supported.
          </p>

          <h3>Location information</h3>
          <p>
            With your permission, we collect precise <strong>device location</strong> to show nearby
            shops on the map, provide "near me" results, and help fill delivery addresses. You can
            enable or disable location access at any time in your device settings.
          </p>

          <h3>Information collected automatically</h3>
          <ul>
            <li><strong>Device &amp; usage:</strong> device type, operating system, app version, IP address, and how you interact with the Services.</li>
            <li><strong>Cookies &amp; similar technologies</strong> on our website to keep you signed in, remember preferences, and improve the Services.</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <ul>
            <li>Create and manage your account, and authenticate you (including one-time codes sent by SMS).</li>
            <li>Process, deliver, and track your orders, and enable communication with shops and delivery.</li>
            <li>Send transactional messages (order updates, receipts) by email and/or SMS, and app notifications.</li>
            <li>Provide the in-app AI shopping assistant and improve product recommendations and search.</li>
            <li>Provide customer support and respond to your requests.</li>
            <li>Detect, prevent, and address fraud, abuse, and security issues.</li>
            <li>Comply with legal obligations and enforce our Terms of Service.</li>
          </ul>

          <h2>3. How We Share Your Information</h2>
          <p>We do not sell your personal information. We share it only as needed to run the Services:</p>
          <ul>
            <li><strong>Shops (sellers):</strong> when you place an order or message a shop, we share the information needed to fulfil it (e.g. name, delivery address, phone, order details).</li>
            <li><strong>Delivery personnel:</strong> the delivery address and contact needed to complete your delivery.</li>
            <li><strong>Service providers</strong> that operate the Services on our behalf, including:
              <ul>
                <li>Stripe — payment processing</li>
                <li>Unimatrix — SMS / one-time verification codes</li>
                <li>Resend — transactional email delivery</li>
                <li>OpenAI — powering the AI assistant (your messages to the assistant are processed to generate replies)</li>
                <li>Google — sign-in with Google (if you choose it) and maps</li>
                <li>Cloudflare — content delivery and security; MongoDB Atlas &amp; DigitalOcean — hosting and data storage</li>
              </ul>
            </li>
            <li><strong>Legal &amp; safety:</strong> when required by law, or to protect the rights, safety, and property of OpenMarketlb, our users, or others.</li>
            <li><strong>Business transfers:</strong> in connection with a merger, acquisition, or sale of assets, subject to this Policy.</li>
          </ul>

          <h2>4. Data Retention</h2>
          <p>
            We keep your information for as long as your account is active or as needed to provide
            the Services, comply with legal obligations, resolve disputes, and enforce our
            agreements. You may request deletion of your account and personal data (see "Your
            Rights").
          </p>

          <h2>5. Security</h2>
          <p>
            We use reasonable technical and organizational measures to protect your information,
            including encrypted connections (HTTPS), hashed passwords, and restricted access. No
            method of transmission or storage is completely secure, and we cannot guarantee absolute
            security.
          </p>

          <h2>6. Your Rights &amp; Choices</h2>
          <ul>
            <li><strong>Access &amp; correction:</strong> view and update your profile information in the app.</li>
            <li><strong>Deletion:</strong> request deletion of your account and associated personal data on our <a href="/delete-account">account deletion page</a>, or by emailing us.</li>
            <li><strong>Location &amp; notifications:</strong> control these permissions in your device settings.</li>
            <li><strong>Marketing:</strong> opt out of non-essential emails using the unsubscribe option.</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

          <h2>7. Children's Privacy</h2>
          <p>
            The Services are not directed to children under 13, and we do not knowingly collect
            personal information from them. If you believe a child has provided us information,
            please contact us and we will delete it.
          </p>

          <h2>8. International Users</h2>
          <p>
            OpenMarketlb is operated for users in Lebanon. Your information may be processed and
            stored on servers located outside your country by the service providers listed above.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this Policy from time to time. We will post the updated version here with a
            new "Last updated" date. Your continued use of the Services after changes means you
            accept the updated Policy.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy or your data, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
