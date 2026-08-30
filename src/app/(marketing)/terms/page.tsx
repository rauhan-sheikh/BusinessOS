export const metadata = {
  title: "Terms of Service | BusinessOS",
  description: "Terms and conditions governing the use of BusinessOS software and services.",
};

export default function TermsOfServicePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-12 text-slate-300">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-800 pb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          Legal Agreement
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Terms of Service
        </h1>
        <p className="text-xs text-slate-400">Last updated: August 30, 2026</p>
      </div>

      {/* Content */}
      <div className="space-y-8 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">1. Acceptance of Terms</h2>
          <p>
            By accessing or using the BusinessOS web application, API, or related services (collectively, the &ldquo;Service&rdquo;), you agree to be bound by these Terms of Service. If you are entering into these terms on behalf of a business, company, or legal entity, you represent that you possess the authority to bind such entity.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">2. Account Registration & Multi-Tenancy</h2>
          <p>
            You agree to provide accurate, current, and complete information during registration and onboarding. You are responsible for maintaining the confidentiality of your account credentials and for all activities conducted under your workspace.
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li><strong className="text-slate-200">Workspace Owners:</strong> Account holders designated as OWNER hold primary administration and billing control over their business workspace.</li>
            <li><strong className="text-slate-200">Role Management:</strong> Business Owners and Admins are responsible for managing access permissions granted to accountants and team members.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">3. Financial Records & Accounting Accuracy</h2>
          <p>
            BusinessOS provides double-entry financial ledger software, snapshot balance calculations, and record-keeping tools. While the software uses strict minor-unit integer mathematics to ensure programmatic precision, users are solely responsible for ensuring the statutory accuracy and tax compliance of their invoices, receipts, GST filings, and business entries.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">4. Acceptable Use Policy</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>Use the Service for fraudulent, unlawful, or unauthorized financial activities.</li>
            <li>Attempt to probe, scan, breach, or circumvent multi-tenant data boundaries or security controls.</li>
            <li>Reverse engineer, decompile, or extract proprietary source code or underlying schemas of the Service.</li>
            <li>Introduce malicious code, denial-of-service attempts, or automated scrapers against our APIs.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">5. Service Availability & Modifications</h2>
          <p>
            We strive to maintain maximum uptime and high operational reliability. We reserve the right to deploy updates, improvements, and schema migrations. In the event of planned maintenance affecting availability, we will endeavor to provide reasonable advance notification.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">6. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, BusinessOS and its developers shall not be liable for any indirect, incidental, consequential, special, or punitive damages resulting from your use of or inability to use the Service.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">7. Governing Law & Contact</h2>
          <p>
            These terms are governed by the laws of India. For any inquiries regarding these terms, please reach out to{" "}
            <a href="mailto:support@mail.businessos.rauhansheikh.com" className="text-indigo-400 hover:underline">
              support@mail.businessos.rauhansheikh.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
