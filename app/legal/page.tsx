/**
 * app/legal/page.tsx — Privacy Policy & Terms of Use
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy & Terms",
  description: "Privacy Policy and Terms of Use for this website.",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-12">

        <h1 className="mb-2 text-3xl font-black tracking-tight text-white">
          Privacy Policy &amp; Terms of Use
        </h1>
        <p className="mb-10 text-sm text-gray-500">Last Updated: March 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-gray-300">

          {/* 1 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">1. Introduction</h2>
            <p className="mb-3">
              Welcome to this website. This site provides football-related games and interactive
              tools including tierlists, rankings, and other entertainment content.
            </p>
            <p className="mb-3">
              By accessing or using this website, you agree to the policies and terms described
              on this page. If you do not agree with these terms, you should not use the website.
            </p>
            <p>
              This website is an independent project created for entertainment purposes.
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">2. Privacy Policy</h2>
            <h3 className="mb-2 font-semibold text-white">Information We Collect</h3>
            <p className="mb-2">
              We may collect certain information when you use the website, including:
            </p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li>Account information if you choose to sign in</li>
              <li>Content you create or upload (such as tierlists or images)</li>
              <li>Device information such as browser type and device type</li>
              <li>IP address and approximate location</li>
              <li>Pages visited and interactions with the website</li>
            </ul>
            <p className="mb-4">
              This information may be collected automatically through website analytics or
              through the use of cookies.
            </p>
            <h3 className="mb-2 font-semibold text-white">How Information Is Used</h3>
            <p className="mb-2">Information collected may be used to:</p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li>operate and maintain the website</li>
              <li>improve website functionality and user experience</li>
              <li>analyze usage patterns</li>
              <li>maintain account features</li>
              <li>protect the website from misuse or abuse</li>
            </ul>
            <p>We do not sell personal information to third parties.</p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">3. Cookies Policy</h2>
            <p className="mb-3">
              This website may use cookies or similar technologies to improve functionality
              and user experience.
            </p>
            <p className="mb-2">Cookies may be used to:</p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li>remember user preferences</li>
              <li>maintain login sessions</li>
              <li>analyze website traffic</li>
              <li>improve performance and usability</li>
            </ul>
            <p>
              Users can disable cookies through their browser settings if they prefer not to
              allow them.
            </p>
          </section>

          {/* 4 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">4. Advertising</h2>
            <p className="mb-3">
              This website may display advertisements through third-party advertising networks
              such as Google Ads or other advertising providers.
            </p>
            <p className="mb-3">
              These advertising partners may use cookies or similar technologies to personalize
              advertisements and measure ad performance.
            </p>
            <p>
              The website owner does not control the data collection practices of third-party
              advertising networks. Users should review the privacy policies of those providers
              for more information.
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">5. User Generated Content</h2>
            <p className="mb-3">
              Users may create content on the website including tierlists, rankings, or by
              uploading images.
            </p>
            <p className="mb-2">
              By submitting or uploading content to the website, users confirm that:
            </p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li>they have the right to upload the content</li>
              <li>
                the content does not violate copyright, trademark, or intellectual property rights
              </li>
              <li>the content does not contain illegal, abusive, or harmful material</li>
            </ul>
            <p className="mb-3">Users remain responsible for the content they upload.</p>
            <p>
              The website owner reserves the right to remove or moderate content at any time
              without notice if it violates these policies or is deemed inappropriate.
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">6. Intellectual Property</h2>
            <p className="mb-3">
              All football player names, club names, league names, and other football-related
              references used on this website are used for informational and entertainment
              purposes only.
            </p>
            <p className="mb-3">
              All trademarks, team names, club logos, player likenesses, and related
              intellectual property belong to their respective owners.
            </p>
            <p>
              This website is not affiliated with, endorsed by, or associated with any football
              clubs, leagues, organizations, or players.
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">7. Copyright Removal Policy</h2>
            <p className="mb-3">
              If you believe that copyrighted material has been used on this website without
              proper authorization, please contact us with the following information:
            </p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li>identification of the copyrighted work</li>
              <li>the location of the material on the website</li>
              <li>your contact information</li>
            </ul>
            <p>
              Upon receiving a valid request, we will review the claim and remove the material
              if appropriate.
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">8. Acceptable Use</h2>
            <p className="mb-2">Users agree not to use the website in ways that:</p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li>violate any laws or regulations</li>
              <li>upload illegal or copyrighted material without permission</li>
              <li>harass or harm other users</li>
              <li>attempt to disrupt or damage the website</li>
              <li>attempt to gain unauthorized access to the website systems</li>
            </ul>
            <p>Accounts or content that violate these rules may be removed or restricted.</p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">9. Accounts</h2>
            <p className="mb-3">
              If the website provides account features, users are responsible for maintaining
              the confidentiality and security of their account credentials.
            </p>
            <p className="mb-3">
              Users are responsible for all activity that occurs under their account.
            </p>
            <p>
              The website owner reserves the right to suspend or remove accounts that violate
              these terms.
            </p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">10. Disclaimer</h2>
            <p className="mb-3">
              This website is provided for entertainment purposes only.
            </p>
            <p className="mb-3">
              The website owner makes no guarantees regarding the accuracy, completeness, or
              reliability of the content available on the site.
            </p>
            <p>
              This website is an independent fan project and is not officially connected with
              any football clubs, leagues, or players.
            </p>
          </section>

          {/* 11 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">11. Limitation of Liability</h2>
            <p className="mb-3">
              The website is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
            </p>
            <p className="mb-2">
              The website owner will not be responsible for any losses, damages, or issues
              arising from:
            </p>
            <ul className="mb-4 list-disc space-y-1.5 pl-5">
              <li>use of the website</li>
              <li>user-generated content</li>
              <li>interruptions or technical issues</li>
              <li>inaccuracies in content</li>
            </ul>
            <p>Use of the website is at your own risk.</p>
          </section>

          {/* 12 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">12. Changes to This Policy</h2>
            <p className="mb-3">
              These policies and terms may be updated from time to time.
            </p>
            <p>
              Any changes will be posted on this page. Continued use of the website after
              changes indicates acceptance of the updated terms.
            </p>
          </section>

          {/* 13 */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-white">13. Contact</h2>
            <p className="mb-3">
              If you have questions about this Privacy Policy or Terms of Use, or if you wish
              to request removal of copyrighted material, please contact:
            </p>
            <a
              href="mailto:contact@yourwebsite.com"
              className="text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              contact@yourwebsite.com
            </a>
          </section>

        </div>
      </div>
    </div>
  );
}
