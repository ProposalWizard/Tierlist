/**
 * app/legal/page.tsx — Privacy Policy & Terms of Service
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & Terms",
  description: "Privacy Policy and Terms of Service for Tierlist Maker.",
};

const LAST_UPDATED = "11 March 2026";
const SITE_NAME = "Tierlist Maker";
const CONTACT_EMAIL = "support@tierlistmaker.com";

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Page title */}
        <h1 className="mb-2 text-4xl font-black tracking-tight text-white">
          Privacy &amp; Terms
        </h1>
        <p className="mb-10 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        {/* Jump links */}
        <nav className="mb-12 rounded-xl border border-gray-800 bg-gray-900 px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Contents
          </p>
          <ul className="space-y-1.5 text-sm">
            <li>
              <a href="#privacy" className="text-indigo-400 hover:text-indigo-300 hover:underline">
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="#terms" className="text-indigo-400 hover:text-indigo-300 hover:underline">
                Terms of Service
              </a>
            </li>
          </ul>
        </nav>

        {/* ── Privacy Policy ─────────────────────────────────────────── */}
        <section id="privacy" className="mb-16 scroll-mt-20">
          <h2 className="mb-6 text-2xl font-black text-white">Privacy Policy</h2>

          <div className="space-y-8 text-sm leading-relaxed text-gray-300">
            <div>
              <h3 className="mb-2 text-base font-bold text-white">1. Who We Are</h3>
              <p>
                {SITE_NAME} ("we", "us", "our") operates the tierlist creation and sharing
                platform at this website. This Privacy Policy explains what personal data we
                collect, why we collect it, and how we use and protect it.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">2. What We Collect</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-white">Account information</strong> — when you register,
                  we store your email address and a hashed password via Supabase Auth.
                </li>
                <li>
                  <strong className="text-white">Profile information</strong> — an optional display
                  name you choose.
                </li>
                <li>
                  <strong className="text-white">Content you create</strong> — tierlists, tier
                  layouts, and images you upload are stored on our servers (Supabase Storage).
                </li>
                <li>
                  <strong className="text-white">Usage data</strong> — view counts per tierlist,
                  which tierlists you have liked or saved, and votes you cast on vote tierlists.
                </li>
                <li>
                  <strong className="text-white">Anonymous identifiers</strong> — if you vote
                  without an account, a random ID is stored in your browser&apos;s localStorage
                  so your votes persist; no personal information is linked to this ID.
                </li>
                <li>
                  <strong className="text-white">Log data</strong> — standard server logs
                  (IP address, browser type, pages visited) retained for up to 30 days for
                  security and debugging.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">3. How We Use Your Data</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>To provide, operate, and improve the service.</li>
                <li>To display your tierlists and profile to other users.</li>
                <li>To send essential service emails (e.g. password reset). We do not send marketing emails.</li>
                <li>To detect and prevent abuse, spam, or fraudulent activity.</li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">4. Data Sharing</h3>
              <p>
                We do not sell, rent, or trade your personal information to third parties. Your
                data is processed by the following sub-processors:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong className="text-white">Supabase</strong> — database, authentication,
                  and file storage (hosted in the EU or US depending on your region).
                </li>
                <li>
                  <strong className="text-white">Netlify</strong> — web hosting and edge delivery.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">5. Cookies &amp; Local Storage</h3>
              <p>
                We use a single session cookie set by Supabase Auth to keep you logged in. We
                also store a small anonymous voter ID in localStorage if you cast votes without
                an account. We do not use advertising cookies or third-party tracking.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">6. Data Retention</h3>
              <p>
                Your account data is kept for as long as your account is active. If you delete
                your account, your personal information and uploaded content will be permanently
                deleted within 30 days. Aggregated, anonymised data (e.g. total vote counts)
                may be retained indefinitely.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">7. Your Rights</h3>
              <p>
                Depending on your location, you may have rights to access, correct, or delete
                your personal data, or to object to or restrict processing. To exercise these
                rights, contact us at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-400 hover:underline">
                  {CONTACT_EMAIL}
                </a>
                . We will respond within 30 days.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">8. Security</h3>
              <p>
                We use industry-standard security measures including TLS encryption in transit
                and Supabase Row Level Security policies to protect your data. No system is
                perfectly secure; if you suspect unauthorised access to your account, contact us
                immediately.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">9. Children</h3>
              <p>
                This service is not directed to children under the age of 13. We do not
                knowingly collect personal data from children. If you believe a child has
                provided us with their data, please contact us to have it removed.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">10. Changes to This Policy</h3>
              <p>
                We may update this Privacy Policy from time to time. We will post the updated
                version on this page with a new "Last updated" date. Continued use of the
                service after changes constitutes acceptance of the updated policy.
              </p>
            </div>
          </div>
        </section>

        <div className="mb-16 border-t border-gray-800" />

        {/* ── Terms of Service ───────────────────────────────────────── */}
        <section id="terms" className="scroll-mt-20">
          <h2 className="mb-6 text-2xl font-black text-white">Terms of Service</h2>

          <div className="space-y-8 text-sm leading-relaxed text-gray-300">
            <div>
              <h3 className="mb-2 text-base font-bold text-white">1. Acceptance of Terms</h3>
              <p>
                By accessing or using {SITE_NAME} you agree to be bound by these Terms of
                Service. If you do not agree, please do not use the service.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">2. The Service</h3>
              <p>
                {SITE_NAME} is a platform that lets users create, share, and vote on
                tierlists. We reserve the right to modify, suspend, or discontinue any part
                of the service at any time without prior notice.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">3. Accounts</h3>
              <ul className="list-disc space-y-2 pl-5">
                <li>You must be at least 13 years old to create an account.</li>
                <li>
                  You are responsible for keeping your login credentials secure and for all
                  activity that occurs under your account.
                </li>
                <li>
                  You must provide accurate information when registering and keep it up to date.
                </li>
                <li>
                  We reserve the right to suspend or terminate accounts that violate these terms.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">4. User Content</h3>
              <p>
                You retain ownership of the content (tierlists, images) you create and upload.
                By posting content, you grant us a non-exclusive, worldwide, royalty-free licence
                to host, display, and distribute that content as part of operating the service.
              </p>
              <p className="mt-2">
                You are solely responsible for the content you upload. You must not upload content
                that:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Infringes any third-party copyright, trademark, or other intellectual property right.</li>
                <li>Is unlawful, defamatory, harassing, obscene, or otherwise objectionable.</li>
                <li>Contains viruses, malware, or other harmful code.</li>
                <li>Violates the privacy or rights of any individual.</li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">5. Prohibited Conduct</h3>
              <p>You agree not to:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Use the service for any unlawful purpose.</li>
                <li>Attempt to gain unauthorised access to any part of the service or its infrastructure.</li>
                <li>Scrape, crawl, or systematically extract data without our prior written consent.</li>
                <li>Impersonate any person or entity.</li>
                <li>Post spam or engage in any form of manipulation of the platform.</li>
              </ul>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">6. Intellectual Property</h3>
              <p>
                The {SITE_NAME} name, logo, design, and underlying software are our property
                and are protected by applicable intellectual property laws. You may not copy,
                redistribute, or create derivative works of our platform without our express
                written permission.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">7. Disclaimers</h3>
              <p>
                The service is provided "as is" and "as available" without warranties of any
                kind, either express or implied. We do not warrant that the service will be
                uninterrupted, error-free, or that any defects will be corrected.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">8. Limitation of Liability</h3>
              <p>
                To the fullest extent permitted by law, {SITE_NAME} and its operators shall
                not be liable for any indirect, incidental, special, consequential, or punitive
                damages, or any loss of data, profits, or goodwill arising out of or in
                connection with your use of the service.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">9. Termination</h3>
              <p>
                You may stop using the service and request deletion of your account at any time
                by contacting us. We may terminate or suspend your access immediately if you
                breach these terms.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">10. Governing Law</h3>
              <p>
                These terms are governed by and construed in accordance with applicable law.
                Any disputes shall be resolved in the courts of competent jurisdiction.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">11. Changes to These Terms</h3>
              <p>
                We may update these Terms of Service at any time. Changes will be posted on
                this page with a new "Last updated" date. Continued use of the service after
                changes constitutes your acceptance of the revised terms.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-base font-bold text-white">12. Contact</h3>
              <p>
                Questions about these terms or our privacy practices? Email us at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-indigo-400 hover:underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
