import { motion } from 'framer-motion';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const PrivacyPage = () => {
  const lastUpdated = 'March 20, 2026';

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
              Legal
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tightest text-foreground mb-4">
              Privacy Policy
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </div>

          {/* Body */}
          <div className="prose-legal">

            <Section title="1. Introduction">
              <p>
                Welcome to Signal ("we", "our", or "us"). We are committed to protecting your personal
                information and your right to privacy. This Privacy Policy explains how we collect,
                use, disclose, and safeguard your information when you visit our website
                (the "Service").
              </p>
              <p>
                Please read this policy carefully. If you disagree with its terms, please discontinue
                use of the Service.
              </p>
            </Section>

            <Section title="2. Information We Collect">
              <p>We may collect the following types of information:</p>
              <SubSection title="Information You Provide">
                <ul>
                  <li>Contact information (name, email address) when you contact us directly.</li>
                  <li>Any other information you choose to provide to us.</li>
                </ul>
              </SubSection>
              <SubSection title="Information Collected Automatically">
                <ul>
                  <li>
                    <strong>Log data:</strong> IP address, browser type, browser version, pages
                    visited, time and date of your visit, time spent on pages, and other diagnostic
                    data.
                  </li>
                  <li>
                    <strong>Cookies and tracking technologies:</strong> We may use cookies, web
                    beacons, pixels, and similar tracking technologies to collect and store
                    information. You can instruct your browser to refuse all cookies or to indicate
                    when a cookie is being sent.
                  </li>
                  <li>
                    <strong>Usage data:</strong> Information on how the Service is accessed and used,
                    including pages viewed, links clicked, and referring URLs.
                  </li>
                </ul>
              </SubSection>
            </Section>

            <Section title="3. How We Use Your Information">
              <p>We use the information we collect to:</p>
              <ul>
                <li>Provide, operate, and maintain our Service.</li>
                <li>Improve, personalise, and expand our Service.</li>
                <li>Understand and analyse how you use our Service.</li>
                <li>Communicate with you, including for customer service and support.</li>
                <li>Send you updates, newsletters, or other information (where you have opted in).</li>
                <li>Detect, prevent, and address technical issues or fraudulent activity.</li>
                <li>Comply with applicable legal obligations.</li>
              </ul>
            </Section>

            <Section title="4. Legal Basis for Processing (GDPR)">
              <p>
                If you are located in the European Economic Area (EEA), our legal basis for
                collecting and using your personal information depends on the data concerned:
              </p>
              <ul>
                <li>
                  <strong>Performance of a contract:</strong> Where processing is necessary to
                  provide the Service you have requested.
                </li>
                <li>
                  <strong>Legitimate interests:</strong> Where processing is in our legitimate
                  interests and not overridden by your rights (e.g., improving our Service,
                  preventing fraud).
                </li>
                <li>
                  <strong>Consent:</strong> Where you have given us explicit consent to process
                  your data for a specific purpose.
                </li>
                <li>
                  <strong>Legal obligation:</strong> Where processing is necessary to comply with
                  a legal obligation.
                </li>
              </ul>
            </Section>

            <Section title="5. Sharing Your Information">
              <p>
                We do not sell, trade, or rent your personal information to third parties. We may
                share information in the following limited circumstances:
              </p>
              <ul>
                <li>
                  <strong>Service providers:</strong> Trusted third-party vendors who assist us in
                  operating our website and conducting our business, subject to confidentiality
                  agreements.
                </li>
                <li>
                  <strong>Legal requirements:</strong> If required by law, court order, or
                  governmental authority.
                </li>
                <li>
                  <strong>Protection of rights:</strong> To protect the rights, property, or safety
                  of Signal, our users, or the public.
                </li>
                <li>
                  <strong>Business transfers:</strong> In connection with a merger, acquisition, or
                  sale of assets, where your information may be transferred as a business asset.
                </li>
              </ul>
            </Section>

            <Section title="6. Third-Party Services">
              <p>
                Our Service may contain links to third-party websites or services. We are not
                responsible for the privacy practices of those sites and encourage you to review
                their privacy policies. Article images may be sourced from Pexels
                (pexels.com) and Wikimedia Commons — please refer to their respective privacy
                policies for details on data collection by those platforms.
              </p>
            </Section>

            <Section title="7. Data Retention">
              <p>
                We retain your personal information only for as long as necessary to fulfil the
                purposes outlined in this Privacy Policy, or as required by law. When no longer
                needed, we will securely delete or anonymise your information.
              </p>
            </Section>

            <Section title="8. Data Security">
              <p>
                We implement appropriate technical and organisational measures to protect your
                personal information against unauthorised access, alteration, disclosure, or
                destruction. However, no method of transmission over the Internet or electronic
                storage is 100% secure, and we cannot guarantee absolute security.
              </p>
            </Section>

            <Section title="9. Your Rights">
              <p>
                Depending on your location, you may have the following rights regarding your
                personal data:
              </p>
              <ul>
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you.</li>
                <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
                <li><strong>Erasure:</strong> Request deletion of your personal data ("right to be forgotten").</li>
                <li><strong>Restriction:</strong> Request that we restrict processing of your data.</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service.</li>
                <li><strong>Objection:</strong> Object to our processing of your data.</li>
                <li><strong>Withdraw consent:</strong> Where processing is based on consent, you may withdraw it at any time.</li>
              </ul>
              <p>
                To exercise any of these rights, please contact us at{' '}
                <a href="mailto:shivamkumarsingh8544@gmail.com" className="text-primary hover:underline">
                  shivamkumarsingh8544@gmail.com
                </a>
                . We will respond within 30 days.
              </p>
            </Section>

            <Section title="10. Children's Privacy">
              <p>
                Our Service is not directed at children under the age of 13. We do not knowingly
                collect personal information from children under 13. If you are a parent or guardian
                and believe your child has provided us with personal data, please contact us
                immediately and we will take steps to remove that information.
              </p>
            </Section>

            <Section title="11. Cookies Policy">
              <p>
                We use cookies and similar tracking technologies to enhance your experience. Cookies
                are small data files stored on your device. Types of cookies we may use:
              </p>
              <ul>
                <li><strong>Essential cookies:</strong> Necessary for the website to function.</li>
                <li><strong>Analytics cookies:</strong> Help us understand how visitors use the site.</li>
                <li><strong>Preference cookies:</strong> Remember your settings and preferences.</li>
              </ul>
              <p>
                You can control cookies through your browser settings. Disabling cookies may affect
                the functionality of parts of our Service.
              </p>
            </Section>

            <Section title="12. Changes to This Policy">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any
                significant changes by updating the "Last updated" date at the top of this page.
                Your continued use of the Service after changes are posted constitutes your
                acceptance of the revised policy.
              </p>
            </Section>

            <Section title="13. Contact Us">
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy,
                please contact us:
              </p>
              <div className="mt-3 p-4 bg-muted rounded-xl font-mono text-sm">
                <p><strong>Signal</strong></p>
                <p>Email:{' '}
                  <a href="mailto:shivamkumarsingh8544@gmail.com" className="text-primary hover:underline">
                    shivamkumarsingh8544@gmail.com
                  </a>
                </p>
              </div>
            </Section>

          </div>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
};

// ── Reusable layout helpers ───────────────────────────────────────────────────
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-10">
    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground mb-4 pb-2 border-b border-border">
      {title}
    </h2>
    <div className="space-y-3 text-sm sm:text-base leading-relaxed text-muted-foreground">
      {children}
    </div>
  </div>
);

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-4">
    <h3 className="text-sm font-bold text-foreground mb-2">{title}</h3>
    <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
  </div>
);

export default PrivacyPage;