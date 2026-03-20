import { useState } from 'react';
import { motion } from 'framer-motion';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const CONTACT_REASONS = [
  { value: 'general',     label: 'General Enquiry' },
  { value: 'correction',  label: 'Report a Factual Error' },
  { value: 'copyright',   label: 'Copyright / Content Removal' },
  { value: 'partnership', label: 'Partnership or Advertising' },
  { value: 'privacy',     label: 'Privacy or Data Request' },
  { value: 'other',       label: 'Other' },
];

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name:    '',
    email:   '',
    reason:  '',
    message: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name    = 'Please enter your name.';
    if (!form.email.trim())   e.email   = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address.';
    if (!form.reason)         e.reason  = 'Please select a reason.';
    if (!form.message.trim()) e.message = 'Please enter your message.';
    else if (form.message.trim().length < 20) e.message = 'Message must be at least 20 characters.';
    return e;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setErrors(prev => ({ ...prev, [e.target.name]: '' }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    // Build mailto link — works without a backend
    const subject = encodeURIComponent(`[Signal] ${CONTACT_REASONS.find(r => r.value === form.reason)?.label ?? 'Enquiry'} — ${form.name}`);
    const body    = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nReason: ${CONTACT_REASONS.find(r => r.value === form.reason)?.label}\n\n${form.message}`
    );
    window.location.href = `mailto:shivamkumarsingh8544@gmail.com?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20"
        >
          {/* Header */}
          <div className="mb-10 pb-8 border-b border-border">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary font-bold mb-3">
              Get in Touch
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tightest text-foreground mb-4">
              Contact Us
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed max-w-xl">
              Have a question, spotted an error, or want to collaborate? We read every message.
              Expect a reply within 2–3 business days.
            </p>
          </div>

          {/* Quick contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <div className="p-4 sm:p-5 bg-muted rounded-xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
                Email
              </p>
              <a
                href="mailto:shivamkumarsingh8544@gmail.com"
                className="font-medium text-sm text-foreground hover:text-primary transition-colors break-all"
              >
                shivamkumarsingh8544@gmail.com
              </a>
            </div>
            <div className="p-4 sm:p-5 bg-muted rounded-xl">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
                Response Time
              </p>
              <p className="font-medium text-sm text-foreground">
                2–3 business days
              </p>
            </div>
          </div>

          {/* Form or success */}
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="py-16 text-center"
            >
              <div className="text-5xl mb-5">✉️</div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tightest text-foreground mb-3">
                Message sent!
              </h2>
              <p className="text-muted-foreground text-sm sm:text-base max-w-sm mx-auto leading-relaxed">
                Your email client should have opened with your message pre-filled. If it didn't,
                email us directly at{' '}
                <a href="mailto:shivamkumarsingh8544@gmail.com" className="text-primary hover:underline">
                  shivamkumarsingh8544@gmail.com
                </a>.
              </p>
              <button
                onClick={() => { setSubmitted(false); setForm({ name: '', email: '', reason: '', message: '' }); }}
                className="mt-8 font-mono text-[11px] uppercase tracking-[0.15em] font-bold text-primary border-b-2 border-primary pb-0.5 hover:opacity-70 transition-opacity"
              >
                Send another message
              </button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-6">

              {/* Name */}
              <Field label="Your Name" error={errors.name} required>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Rahul Sharma"
                  className={inputClass(!!errors.name)}
                  autoComplete="name"
                />
              </Field>

              {/* Email */}
              <Field label="Email Address" error={errors.email} required>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="rahul@example.com"
                  className={inputClass(!!errors.email)}
                  autoComplete="email"
                />
              </Field>

              {/* Reason */}
              <Field label="Reason for Contact" error={errors.reason} required>
                <select
                  name="reason"
                  value={form.reason}
                  onChange={handleChange}
                  className={inputClass(!!errors.reason)}
                >
                  <option value="">Select a reason...</option>
                  {CONTACT_REASONS.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </Field>

              {/* Message */}
              <Field label="Message" error={errors.message} required>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  placeholder="Please describe your enquiry in detail..."
                  rows={6}
                  className={`${inputClass(!!errors.message)} resize-none`}
                />
              </Field>

              {/* GDPR notice */}
              <p className="text-xs text-muted-foreground leading-relaxed">
                By submitting this form you agree that the information provided will be used
                solely to respond to your enquiry, in accordance with our{' '}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
                We will never share your details with third parties for marketing purposes.
              </p>

              <button
                type="submit"
                className="w-full sm:w-auto font-mono text-[11px] uppercase tracking-[0.2em] font-bold bg-foreground text-background px-8 py-4 rounded-xl hover:opacity-80 active:scale-[0.98] transition-all"
              >
                Send Message →
              </button>

            </form>
          )}

          {/* Additional contact options */}
          <div className="mt-14 pt-8 border-t border-border">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground mb-5">
              Other Ways to Reach Us
            </h2>
            <div className="space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="font-bold text-foreground mb-1">Factual corrections</p>
                <p>
                  If you've spotted an error in one of our articles, please email us with the
                  article title, the specific error, and a source for the correct information.
                  We take accuracy seriously and will issue corrections promptly.
                </p>
              </div>
              <div>
                <p className="font-bold text-foreground mb-1">Copyright and content removal</p>
                <p>
                  If you believe any content on Signal infringes your copyright, please contact us
                  with details of the content in question and your ownership claim. We will respond
                  within 48 hours.
                </p>
              </div>
              <div>
                <p className="font-bold text-foreground mb-1">Privacy requests</p>
                <p>
                  For requests to access, correct, or delete your personal data under GDPR or other
                  applicable privacy laws, please email us with "Privacy Request" in the subject line.
                </p>
              </div>
            </div>
          </div>

        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
};

// ── Form helpers ──────────────────────────────────────────────────────────────
const inputClass = (hasError: boolean) =>
  `w-full px-4 py-3 rounded-xl border text-sm text-foreground bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all ${
    hasError
      ? 'border-red-500 focus:ring-red-500/30'
      : 'border-border focus:ring-primary/30 focus:border-primary'
  }`;

const Field = ({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    <label className="block font-mono text-[11px] uppercase tracking-[0.15em] text-foreground font-bold">
      {label}
      {required && <span className="text-primary ml-1">*</span>}
    </label>
    {children}
    {error && (
      <p className="text-xs text-red-500 mt-1">{error}</p>
    )}
  </div>
);

export default ContactPage;