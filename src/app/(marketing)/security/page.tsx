export const metadata = {
  title: "Security & Data Integrity | BusinessOS",
  description: "Overview of BusinessOS security architecture, encryption, multi-tenant isolation, and data integrity standards.",
};

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-12 text-slate-300">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-800 pb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
          Trust & Architecture
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Security & Data Integrity
        </h1>
        <p className="text-xs text-slate-400">
          How BusinessOS safeguards enterprise accounting data and financial operations.
        </p>
      </div>

      {/* Grid of Security Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-lg">
            🛡️
          </div>
          <h3 className="text-base font-bold text-slate-100">Server-Side Session Authentication</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All user sessions are backed by Better Auth with cryptographically signed, HttpOnly cookies. We never store raw passwords or trust client-provided user IDs.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-lg">
            🏢
          </div>
          <h3 className="text-base font-bold text-slate-100">Strict Multi-Tenant Boundaries</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Every database query is automatically scoped to the authenticated Business ID. Users cannot access counterparties, transactions, or statements across business tenants.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 text-lg">
            ⚡
          </div>
          <h3 className="text-base font-bold text-slate-100">Database Transaction Atomicity</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Financial ledger writes and `PartyBalance` snapshot recalculations are executed within atomic PostgreSQL transactions (`prisma.$transaction`). Either all updates succeed or the entire operation rolls back.
          </p>
        </div>

        <div className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-lg">
            📝
          </div>
          <h3 className="text-base font-bold text-slate-100">Immutable Audit Trails</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            All party creation, profile edits, ledger postings, and transaction reversals are recorded to an append-only `AuditLog` table with IP addresses, timestamps, and user attribution.
          </p>
        </div>
      </div>

      {/* Technical Detail Sections */}
      <div className="space-y-8 text-sm leading-relaxed border-t border-slate-800 pt-8">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">Integer Minor-Unit Precision</h2>
          <p>
            Traditional floating-point arithmetic introduces rounding drift (e.g., `0.1 + 0.2 = 0.30000000000000004`). BusinessOS stores all financial values as 64-bit integer minor units (`BigInt`) representing paise or cents, ensuring zero precision loss across millions of ledger entries.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">Encryption at Rest and in Transit</h2>
          <p>
            All network communication with BusinessOS uses TLS 1.3 encryption. Database persistence through Neon PostgreSQL uses AES-256 encryption at rest.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">Responsible Disclosure</h2>
          <p>
            If you discover a vulnerability or security flaw, please contact our security team directly at{" "}
            <a href="mailto:support@mail.businessos.rauhansheikh.com" className="text-indigo-400 hover:underline">
              support@mail.businessos.rauhansheikh.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
