import { motion } from 'framer-motion';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';

const TermsPage = () => {
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
              Terms of Service
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              Last updated: {lastUpdated}
            </p>
          </div>

          <div className="prose-legal">

            <Section title="1. Acceptance of Terms">
              <p>
                By accessing or using Signal ("the Service", "we", "our", "us"), you agree to be
                bound by these Terms of Service ("Terms"). If you do not agree to these Terms,
                please do not use the Service.
              </p>
              <p>
                We reserve the right to update or modify these Terms at any time. Continued use of
                the Service after changes are posted constitutes your acceptance of the revised Terms.
              </p>
            </Section>

            <Section title="2. Description of Service">
              <p>
                Signal is a news aggregation and editorial platform that publishes original articles,
                commentary, and curated news content across various categories including cricket,
                bollywood, technology, business, health, science, and more.
              </p>
              <p>
                Content on Signal is generated and curated independently. Some articles may be
                produced using automated tools. All content is published in good faith for
                informational purposes only.
              </p>
            </Section>

            <Section title="3. Intellectual Property">
              <p>
                All original content published on Signal — including articles, headlines, summaries,
                and editorial text — is the intellectual property of Signal and is protected by
                applicable copyright laws.
              </p>
              <p>
                You may share individual article links for personal, non-commercial purposes.
                You may <strong>not</strong>:
              </p>
              <ul>
                <li>Reproduce, copy, or republish full articles without prior written permission.</li>
                <li>Scrape, crawl, or systematically download content from the Service.</li>
                <li>Use our content for commercial purposes without a licence agreement.</li>
                <li>Remove or alter any copyright, trademark, or proprietary notices.</li>
              </ul>
              <p>
                Images used on this platform are sourced from Pexels and Wikimedia Commons under
                their respective free-use licences. Rights in those images belong to the respective
                photographers and contributors.
              </p>
            </Section>

            <Section title="4. Acceptable Use">
              <p>You agree not to use the Service to:</p>
              <ul>
                <li>Violate any applicable local, national, or international law or regulation.</li>
                <li>Transmit any unsolicited or unauthorised advertising or promotional material.</li>
                <li>Impersonate any person or entity, or misrepresent your affiliation.</li>
                <li>Engage in any conduct that restricts or inhibits anyone's use of the Service.</li>
                <li>Attempt to gain unauthorised access to any part of the Service or its systems.</li>
                <li>Introduce any viruses, trojans, worms, or other malicious code.</li>
                <li>Use the Service in any way that could damage, disable, or impair it.</li>
              </ul>
            </Section>

            <Section title="5. Content Accuracy and Disclaimer">
              <p>
                Signal strives to publish accurate, timely, and well-researched content. However,
                we make no warranties or representations regarding the accuracy, completeness,
                reliability, or suitability of any content on the Service.
              </p>
              <p>
                News and information published on Signal is for general informational purposes only
                and should not be relied upon as professional advice — including but not limited to
                legal, financial, medical, or investment advice. Always seek qualified professional
                guidance for specific matters.
              </p>
              <p>
                We are not responsible for the content of any external websites linked from the
                Service.
              </p>
            </Section>

            <Section title="6. Third-Party Links">
              <p>
                The Service may contain links to third-party websites or services. These links are
                provided for convenience only. We have no control over the content, privacy policies,
                or practices of any third-party sites and accept no responsibility for them. We
                encourage you to read the terms and privacy policies of any third-party sites you
                visit.
              </p>
            </Section>

            <Section title="7. Limitation of Liability">
              <p>
                To the fullest extent permitted by applicable law, Signal and its operators shall
                not be liable for any indirect, incidental, special, consequential, or punitive
                damages — including loss of profits, data, or goodwill — arising from:
              </p>
              <ul>
                <li>Your use of or inability to use the Service.</li>
                <li>Any content published on the Service.</li>
                <li>Unauthorised access to or alteration of your data.</li>
                <li>Any bugs, viruses, or errors in the Service.</li>
              </ul>
              <p>
                In jurisdictions that do not allow the exclusion of certain warranties or limitation
                of liability, our liability is limited to the maximum extent permitted by law.
              </p>
            </Section>

            <Section title="8. Disclaimer of Warranties">
              <p>
                The Service is provided on an "as is" and "as available" basis without warranties
                of any kind, either express or implied — including but not limited to implied
                warranties of merchantability, fitness for a particular purpose, and
                non-infringement. We do not warrant that the Service will be uninterrupted,
                error-free, or free of viruses or other harmful components.
              </p>
            </Section>

            <Section title="9. Privacy">
              <p>
                Your use of the Service is also governed by our{' '}
                <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>,
                which is incorporated into these Terms by reference.
              </p>
            </Section>

            <Section title="10. Governing Law">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of India,
                without regard to its conflict of law provisions. Any disputes arising from these
                Terms or the use of the Service shall be subject to the exclusive jurisdiction of
                the courts of India.
              </p>
            </Section>

            <Section title="11. Changes to the Service">
              <p>
                We reserve the right to modify, suspend, or discontinue the Service (or any part
                of it) at any time, with or without notice. We shall not be liable to you or any
                third party for any such modification, suspension, or discontinuation.
              </p>
            </Section>

            <Section title="12. Severability">
              <p>
                If any provision of these Terms is found to be unenforceable or invalid under
                applicable law, that provision shall be modified to the minimum extent necessary
                to make it enforceable, and the remaining provisions shall continue in full force
                and effect.
              </p>
            </Section>

            <Section title="13. Entire Agreement">
              <p>
                These Terms, together with our Privacy Policy, constitute the entire agreement
                between you and Signal with respect to the Service and supersede all prior
                agreements, understandings, or representations.
              </p>
            </Section>

            <Section title="14. Contact Us">
              <p>
                If you have any questions about these Terms, please contact us:
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

export default TermsPage;