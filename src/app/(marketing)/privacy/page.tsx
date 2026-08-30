export const metadata = {
  title: "Privacy Policy | BusinessOS",
  description: "Privacy Policy and data governance standards for BusinessOS users and customers.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-12 text-slate-300">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-800 pb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          Legal & Compliance
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Privacy Policy
        </h1>
        <p className="text-xs text-slate-400">Last updated: August 30, 2026</p>
      </div>

      {/* Content */}
      <div className="space-y-8 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">1. Introduction</h2>
          <p>
            Welcome to BusinessOS (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are committed to protecting the privacy, confidentiality, and security of your business and personal information. This Privacy Policy outlines how we collect, process, store, and safeguard your data when you use the BusinessOS platform at{" "}
            <span className="text-indigo-400">businessos.rauhansheikh.com</span>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">2. Information We Collect</h2>
          <p>We collect only the information necessary to provide and operate our multi-tenant business operating system:</p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong className="text-slate-200">Account & Identity Information:</strong> Name, work email address, password hashes (salted and encrypted), and OAuth credentials (when using Google Sign-In).
            </li>
            <li>
              <strong className="text-slate-200">Business Profile Data:</strong> Company name, legal entity name, GSTIN (Goods and Services Tax Identification Number), PAN (Permanent Account Number), registered address, phone number, and base operational currency.
            </li>
            <li>
              <strong className="text-slate-200">Operational & Financial Records:</strong> Customer and vendor details, ledger transactions (sales, purchases, payments, adjustments), transaction notes, reference numbers, and snapshot balance calculations.
            </li>
            <li>
              <strong className="text-slate-200">Technical & Audit Metadata:</strong> IP addresses, browser user-agents, authentication timestamps, and session logs for security auditability.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">3. Multi-Tenant Data Isolation</h2>
          <p>
            BusinessOS enforces strict multi-tenant boundaries. All queries, transactions, and customer balances are strictly scoped to your authenticated Business ID. Users belonging to other business workspaces cannot access, view, or query your records under any circumstances.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">4. How We Use Your Data</h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>To operate, compute, and present your company financial ledger and party statements.</li>
            <li>To authenticate users and verify role-based permissions (Owner, Admin, Accountant).</li>
            <li>To dispatch account verification emails, password reset links, and critical security notices.</li>
            <li>To detect, prevent, and log suspicious authentication attempts and security anomalies.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">5. Data Sharing & Third-Party Processors</h2>
          <p>
            We do not sell, rent, or monetize your business records or contact databases. We share data only with essential infrastructure service providers bound by strict confidentiality:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li><strong className="text-slate-200">Database Hosting:</strong> Neon PostgreSQL (encrypted at rest and in transit).</li>
            <li><strong className="text-slate-200">Transactional Email:</strong> Resend for automated transactional notices and verification links.</li>
            <li><strong className="text-slate-200">Application Hosting:</strong> Vercel for serverless edge execution.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">6. Data Retention & Your Rights</h2>
          <p>
            You retain ownership of all data entered into BusinessOS. You have the right to access, rectify, or request the export and deletion of your business and personal records at any time.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">7. Contact Us</h2>
          <p>
            If you have any questions regarding this Privacy Policy or wish to exercise your data rights, please contact our legal team at{" "}
            <a href="mailto:support@mail.businessos.rauhansheikh.com" className="text-indigo-400 hover:underline">
              support@mail.businessos.rauhansheikh.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
