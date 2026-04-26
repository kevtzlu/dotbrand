import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ESTIMAIT",
  description: "ESTIMAIT privacy policy.",
};

export default function PrivacyPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">ESTIMAIT Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Last Updated: April 25, 2026</p>

        <div className="mt-8 space-y-5 text-sm leading-7">
          <p>
            ESTIMAIT (a brand of DOTBRAND LLC, &quot;Company&quot;, &quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your
            privacy. This Privacy Policy explains how DOTBRAND LLC collects, uses, discloses, and safeguards your
            information when you visit our website (bid.estimait.io) and use our software-as-a-service platform (the
            &quot;Service&quot;).
          </p>
          <p>
            Please read this Privacy Policy carefully. By accessing or using the Service, you agree to the terms of this
            Privacy Policy.
          </p>

          <section>
            <h2 className="text-base font-semibold">1. Information We Collect</h2>
            <p className="mt-2">
              We collect information that identifies, relates to, describes, or could reasonably be linked, directly or
              indirectly, with a particular consumer or device (&quot;Personal Information&quot;), as well as highly sensitive
              commercial data.
            </p>
            <h3 className="mt-3 font-medium">1.1 Information You Provide to Us</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Account Information: Name, email address, phone number, company name, job title, and password.
              </li>
              <li>
                Payment Information: Credit card details and billing address (processed securely by our third-party
                payment processors on behalf of DOTBRAND LLC).
              </li>
              <li>
                Project Data (Highly Sensitive): Construction drawings, blueprints, project specifications, proposals,
                quotes, historical project costs, and proprietary estimating methodologies (&quot;Project Data&quot;).
              </li>
            </ul>
            <h3 className="mt-3 font-medium">1.2 Information Collected Automatically</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Usage Data: We collect anonymous usage behavior data to understand how users interact with our Service.
                This includes pages visited, features used, time spent on the platform, and clickstream data.
              </li>
              <li>Device and Technical Data: IP address, browser type, operating system, and device identifiers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">2. How We Use Your Information</h2>
            <p className="mt-2">We use the information we collect for the following purposes:</p>
            <h3 className="mt-3 font-medium">2.1 Core Service Delivery</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>To provide, operate, and maintain the Service.</li>
              <li>To process your transactions and manage your account.</li>
              <li>To provide customer support and respond to your inquiries.</li>
            </ul>
            <h3 className="mt-3 font-medium">2.2 AI Algorithm Improvement</h3>
            <p className="mt-1">
              We use aggregated and strictly anonymized Project Data to train, improve, and refine our AI cost estimation
              algorithms. This data is stripped of all personally identifiable information and specific project identifiers
              before being used for this purpose. Our algorithms learn general pricing trends and material relationships,
              not your specific proprietary pricing.
            </p>
            <h3 className="mt-3 font-medium">2.3 Analytics and Service Improvement</h3>
            <p className="mt-1">
              We use Usage Data to analyze trends, monitor platform performance, and improve the user experience.
            </p>
            <h3 className="mt-3 font-medium">2.4 Marketing and Communications (Marketing Consent)</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Consent to Receive Communications: By actively opting in during the registration process or within your
                account settings, you expressly consent to receive marketing and promotional communications from ESTIMAIT
                and DOTBRAND LLC.
              </li>
              <li>
                Types of Communications: These may include newsletters, product updates, promotional offers, and
                invitations to participate in surveys.
              </li>
              <li>
                Right to Opt-Out: You have the right to withdraw your consent and opt-out of receiving marketing
                communications at any time by clicking the &quot;Unsubscribe&quot; link in any marketing email, adjusting your
                account settings, or contacting us at info@estimait.io.
              </li>
              <li>
                Effect of Opting Out: Even if you opt-out of marketing communications, we will continue to send you
                essential transactional and service-related emails (e.g., billing statements, security alerts).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">3. How We Share Your Information</h2>
            <p className="mt-2">
              We do not sell your Personal Information or Project Data to third parties. We only share information in the
              following limited circumstances:
            </p>
            <h3 className="mt-3 font-medium">3.1 Within DOTBRAND LLC</h3>
            <p className="mt-1">
              As ESTIMAIT is a brand of DOTBRAND LLC, your data is processed by DOTBRAND LLC as the Data Controller. We
              may share your Personal Information and Usage Data with other products or services operated by DOTBRAND LLC
              (such as our interior design AI tools) solely for the purpose of improving our overall service offerings,
              providing integrated features, and conducting internal business analytics. We will not share your highly
              sensitive Project Data (like specific quotes or drawings) across different product lines without your
              explicit consent.
            </p>
            <h3 className="mt-3 font-medium">3.2 Service Providers</h3>
            <p className="mt-1">We share information with trusted third-party vendors who assist us in operating our Service. These include:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Cloud Hosting Providers: (e.g., AWS, Google Cloud) for secure data storage.</li>
              <li>
                Analytics Providers: We use Amplitude and Google Analytics to process anonymous usage behavior data. These
                providers are bound by strict confidentiality agreements and are prohibited from using the data for any
                purpose other than providing analytics services to us.
              </li>
              <li>Payment Processors: (e.g., Stripe) for secure payment handling.</li>
            </ul>
            <h3 className="mt-3 font-medium">3.3 Legal Requirements</h3>
            <p className="mt-1">
              We may disclose your information if required to do so by law or in response to valid requests by public
              authorities (e.g., a court or a government agency).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">4. Data Security</h2>
            <p className="mt-2">
              We implement industry-standard technical and organizational security measures to protect your Personal
              Information and highly sensitive Project Data. These measures include:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Encryption of data in transit (TLS/SSL) and at rest (AES-256).</li>
              <li>Strict role-based access controls (RBAC) for our employees.</li>
              <li>Regular security audits and vulnerability assessments.</li>
            </ul>
            <p className="mt-2">
              While we strive to use commercially acceptable means to protect your information, no method of transmission
              over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">5. Data Retention and Deletion Policy</h2>
            <h3 className="mt-2 font-medium">5.1 Retention</h3>
            <p className="mt-1">
              We retain your Personal Information and Project Data only for as long as necessary to fulfill the purposes
              outlined in this Privacy Policy, unless a longer retention period is required or permitted by law.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Active Accounts: Data is retained while your account is active.</li>
              <li>Terminated Accounts: Upon account termination, we will initiate our data deletion protocol.</li>
            </ul>
            <h3 className="mt-3 font-medium">5.2 Deletion</h3>
            <p className="mt-1">You have the right to request the deletion of your Personal Information and Project Data at any time.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>User-Initiated Deletion: You can delete specific projects or your entire account through the Service settings.</li>
              <li>
                Complete Purge: Upon a verified deletion request or account termination, we will permanently delete your
                Project Data from our active databases within thirty (30) days. Backups may be retained for up to an
                additional sixty (60) days for disaster recovery purposes before being permanently overwritten.
              </li>
              <li>
                Anonymized Data Exception: We may retain aggregated, strictly anonymized data that can no longer be
                associated with you or your company for ongoing algorithm improvement and analytical purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">6. Your Privacy Rights (Including CCPA/CPRA and NYSDPA)</h2>
            <p className="mt-2">
              Depending on your state of residence (such as California or New York), you may have the following rights
              regarding your Personal Information:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Right to Know/Access: You have the right to request the specific pieces and categories of Personal Information we have collected about you.</li>
              <li>Right to Delete: You have the right to request the deletion of your Personal Information, subject to certain exceptions.</li>
              <li>Right to Correct: You have the right to request the correction of inaccurate Personal Information.</li>
              <li>
                Right to Opt-Out of Sale/Sharing: We do not sell your Personal Information. However, you have the right to
                opt-out of the sharing of your Personal Information for cross-context behavioral advertising (e.g., through
                our analytics providers).
              </li>
              <li>Right to Non-Discrimination: We will not discriminate against you for exercising any of your privacy rights.</li>
            </ul>
            <p className="mt-2">
              To exercise your rights: Please submit a request to info@estimait.io. We will verify your identity before
              processing your request.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">7. Third-Party Links</h2>
            <p className="mt-2">
              Our Service may contain links to third-party websites. We are not responsible for the privacy practices or
              the content of those third-party websites. We encourage you to read the privacy policies of any website you
              visit.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">8. Changes to This Privacy Policy</h2>
            <p className="mt-2">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new
              Privacy Policy on this page and updating the &quot;Last Updated&quot; date. You are advised to review this Privacy
              Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">9. Contact Us</h2>
            <p className="mt-2">
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-2">
              Privacy Inquiries &amp; General Support: info@estimait.io
              <br />
              Legal Matters: info@dotbrand.design
              <br />
              DOTBRAND LLC
              <br />
              8 The Green Ste B
              <br />
              Dover, Delaware 19901 US
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
