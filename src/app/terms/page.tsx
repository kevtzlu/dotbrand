import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ESTIMAIT",
  description: "ESTIMAIT terms of service.",
};

export default function TermsPage() {
  return (
    <main className="h-screen overflow-y-auto bg-gray-50 dark:bg-[#09090b] text-gray-900 dark:text-gray-100">
      <div className="mx-auto w-full max-w-4xl px-6 py-10 md:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">ESTIMAIT Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Last Updated: April 25, 2026</p>

        <div className="mt-8 space-y-5 text-sm leading-7">
          <p>
            Welcome to ESTIMAIT (a brand of DOTBRAND LLC, &quot;Company&quot;, &quot;we&quot;, &quot;our&quot;, &quot;us&quot;). These Terms of Service
            (&quot;Terms&quot;) govern your access to and use of our construction cost estimation software-as-a-service
            platform available at bid.estimait.io, including any associated software, applications, and services
            (collectively, the &quot;Service&quot;).
          </p>
          <p>
            By clicking &quot;Continue&quot;, registering for an account, or otherwise accessing or using the Service, you
            agree to be bound by these Terms. If you are entering into these Terms on behalf of a company or other legal
            entity (such as a General Contractor firm), you represent that you have the authority to bind such entity and
            its affiliates to these Terms, in which case the terms &quot;you&quot; or &quot;your&quot; shall refer to such entity and its
            affiliates. If you do not have such authority, or if you do not agree with these Terms, you must not accept
            these Terms and may not use the Service.
          </p>

          <section>
            <h2 className="text-base font-semibold">1. Description of Service</h2>
            <p className="mt-2">
              ESTIMAIT provides a B2B platform designed for General Contractors (GCs) to streamline the construction cost
              estimation process. The Service allows users to upload, store, and analyze project data, including drawings,
              proposals, quotes, and related construction documents, to generate accurate cost estimates.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">2. Account Registration and Security</h2>
            <p className="mt-2">
              To use the Service, you must register for an account. You agree to provide accurate, current, and complete
              information during the registration process and to update such information to keep it accurate, current, and
              complete. You are responsible for safeguarding your password and for all activities that occur under your
              account. You agree to notify us immediately of any unauthorized use of your account or any other breach of
              security.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">3. User Content and Confidentiality</h2>
            <h3 className="mt-2 font-medium">3.1 Ownership of User Content</h3>
            <p className="mt-1">
              You retain all right, title, and interest in and to all data, information, drawings, blueprints, quotes,
              proposals, and other materials you upload, submit, or transmit to the Service (&quot;User Content&quot;). DOTBRAND
              LLC claims no ownership over your User Content.
            </p>
            <h3 className="mt-3 font-medium">3.2 Highly Confidential Information</h3>
            <p className="mt-1">
              We acknowledge that your User Content, particularly project drawings, financial quotes, and proprietary
              estimating methodologies, constitutes highly sensitive commercial information (&quot;Confidential Information&quot;).
              We agree to maintain the confidentiality of your Confidential Information and will not disclose it to any
              third party except as expressly permitted in these Terms, our Privacy Policy, or as required by law.
            </p>
            <h3 className="mt-3 font-medium">3.3 License to User Content</h3>
            <p className="mt-1">By submitting User Content to the Service, you grant DOTBRAND LLC a worldwide, non-exclusive, royalty-free license to use, host, store, reproduce, modify, and create derivative works from your User Content solely for the following purposes:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Providing, maintaining, and supporting the Service to you.</li>
              <li>
                Improving and training our AI estimation algorithms and machine learning models, provided that such data
                is aggregated and anonymized such that it cannot be reverse-engineered to identify you, your clients, or
                your specific projects.
              </li>
              <li>Addressing technical or security issues.</li>
              <li>As required by applicable law.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">4. Acceptable Use Policy</h2>
            <p className="mt-2">You agree not to use the Service to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Upload or transmit any content that infringes upon any third party&apos;s intellectual property rights or
                violates any privacy or confidentiality obligations.
              </li>
              <li>Upload any malicious code, viruses, or software that could disrupt or harm the Service.</li>
              <li>Attempt to gain unauthorized access to other users&apos; accounts or DOTBRAND LLC&apos;s systems.</li>
              <li>Reverse engineer, decompile, or disassemble the Service or its underlying algorithms.</li>
              <li>
                Use the Service for any illegal or unauthorized purpose, including but not limited to violating any local,
                state, national, or international law.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">5. Intellectual Property Rights</h2>
            <p className="mt-2">
              DOTBRAND LLC retains all right, title, and interest in and to the Service, including all software,
              algorithms, user interfaces, designs, and all related intellectual property rights. Your use of the Service
              does not grant you any ownership rights in the Service itself.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">6. Fees and Payment</h2>
            <p className="mt-2">
              If you subscribe to a paid tier of the Service, you agree to pay all applicable fees to DOTBRAND LLC as set
              forth on our pricing page or in a separate order form. All fees are non-refundable except as expressly
              provided in these Terms or required by law. We reserve the right to change our pricing upon reasonable
              notice to you. All invoices and payment processing will be handled by DOTBRAND LLC.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">7. Term and Termination</h2>
            <h3 className="mt-2 font-medium">7.1 Term</h3>
            <p className="mt-1">These Terms remain in effect until your subscription expires or is terminated by either party.</p>
            <h3 className="mt-3 font-medium">7.2 Termination</h3>
            <p className="mt-1">You may terminate your account at any time. We may suspend or terminate your access to the Service if you breach these Terms.</p>
            <h3 className="mt-3 font-medium">7.3 Effect of Termination</h3>
            <p className="mt-1">
              Upon termination, your right to use the Service will immediately cease. We will handle your User Content in
              accordance with our Data Retention and Deletion Policy outlined in our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">8. Disclaimer of Warranties</h2>
            <p className="mt-2 uppercase">
              THE SERVICE IS PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS. DOTBRAND LLC EXPRESSLY DISCLAIMS ALL
              WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE IMPLIED WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. DOTBRAND LLC DOES NOT WARRANT THAT
              THE ESTIMATES GENERATED BY THE SERVICE WILL BE 100% ACCURATE, ERROR-FREE, OR SUITABLE FOR YOUR SPECIFIC
              BIDDING NEEDS. YOU ARE SOLELY RESPONSIBLE FOR VERIFYING ALL ESTIMATES BEFORE SUBMITTING BIDS.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">9. Limitation of Liability</h2>
            <p className="mt-2 uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL DOTBRAND LLC, ITS AFFILIATES,
              DIRECTORS, EMPLOYEES, OR AGENTS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR
              EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER
              INTANGIBLE LOSSES, ARISING OUT OF OR RELATING TO THE USE OF, OR INABILITY TO USE, THE SERVICE. DOTBRAND
              LLC&apos;S TOTAL CUMULATIVE LIABILITY ARISING FROM OR RELATED TO THESE TERMS SHALL NOT EXCEED THE TOTAL AMOUNT
              PAID BY YOU TO DOTBRAND LLC FOR THE SERVICE DURING THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">10. Indemnification</h2>
            <p className="mt-2">
              You agree to defend, indemnify, and hold harmless DOTBRAND LLC and its affiliates from and against any
              claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable
              attorneys&apos; fees) arising out of or relating to your violation of these Terms or your use of the Service,
              including but not limited to your User Content.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">11. Governing Law and Dispute Resolution</h2>
            <p className="mt-2">
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, without
              regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the
              Service shall be resolved through binding arbitration administered by the American Arbitration Association
              (AAA) in accordance with its Commercial Arbitration Rules. The arbitration shall take place in Delaware.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">12. Changes to Terms</h2>
            <p className="mt-2">
              We reserve the right to modify these Terms at any time. We will notify you of any material changes by
              posting the new Terms on the Service or via email. Your continued use of the Service after any such changes
              constitutes your acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">13. Contact Information</h2>
            <p className="mt-2">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="mt-2">
              General Support: info@estimait.io
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
