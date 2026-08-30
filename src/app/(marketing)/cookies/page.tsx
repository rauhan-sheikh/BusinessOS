export const metadata = {
  title: "Cookie Policy | BusinessOS",
  description: "Explanation of cookie usage, session tokens, and preferences on BusinessOS.",
};

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-12 text-slate-300">
      {/* Header */}
      <div className="space-y-3 border-b border-slate-800 pb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">
          Transparency
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight">
          Cookie Policy
        </h1>
        <p className="text-xs text-slate-400">Last updated: August 30, 2026</p>
      </div>

      {/* Content */}
      <div className="space-y-8 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">1. What Are Cookies?</h2>
          <p>
            Cookies are small text files stored on your device when you browse websites. They help web applications remember authentication status, session state, and user preferences.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">2. Cookies We Use</h2>
          <p>
            BusinessOS uses only strictly necessary cookies to provide core authentication and platform functionality. We do not use third-party tracking or advertising cookies.
          </p>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden mt-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Cookie Name</th>
                  <th className="py-3 px-4 font-semibold">Purpose</th>
                  <th className="py-3 px-4 font-semibold">Duration</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-300">
                <tr>
                  <td className="py-3 px-4 font-mono text-indigo-400">better-auth.session_token</td>
                  <td className="py-3 px-4">Maintains your authenticated session securely across pages.</td>
                  <td className="py-3 px-4">Session / 30 Days</td>
                  <td className="py-3 px-4">Essential (HttpOnly)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-mono text-indigo-400">better-auth.csrf_token</td>
                  <td className="py-3 px-4">Protects against Cross-Site Request Forgery (CSRF) attacks.</td>
                  <td className="py-3 px-4">Session</td>
                  <td className="py-3 px-4">Essential (Security)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">3. Managing Cookies</h2>
          <p>
            You can configure your browser to block or delete cookies. However, because our cookies are strictly essential for authentication and session management, disabling them will prevent you from signing in to your BusinessOS workspace.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-slate-100">4. Contact Us</h2>
          <p>
            For questions about our cookie practices, please contact{" "}
            <a href="mailto:support@mail.businessos.rauhansheikh.com" className="text-indigo-400 hover:underline">
              support@mail.businessos.rauhansheikh.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
}
