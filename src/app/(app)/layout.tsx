import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { headers } from "next/headers";
import AppTopBar from "./components/AppTopBar";
import AppFooter from "./components/AppFooter";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session) {
    redirect("/login");
  }

  // Check business memberships to determine if onboarding is needed
  const memberships = await businessService.getBusinessesForUser(session.user.id);

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const { business: activeBusiness, role: activeRole } =
    await getActiveBusinessContext(reqHeaders);

  const serializedMemberships = memberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    role: m.role,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
      <AppTopBar
        user={session.user}
        businessName={activeBusiness.name}
        activeBusinessId={activeBusiness.id}
        activeRole={activeRole}
        memberships={serializedMemberships}
      />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <AppFooter businessName={activeBusiness.name} />
    </div>
  );
}
