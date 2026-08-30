import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { businessService } from "@/modules/businesses/services/business.service";
import { headers } from "next/headers";
import AppTopBar from "./components/AppTopBar";
import AppFooter from "./components/AppFooter";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side session check — this is the authorization boundary for all (app) routes
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  // Check business membership to determine if onboarding is needed
  // session is guaranteed non-null here (redirect() throws above)
  const memberships = await businessService.getBusinessesForUser(session!.user.id);

  // If no businesses, redirect to onboarding (in (onboarding) route group — no loop)
  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const activeBusiness = memberships[0].business;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 antialiased">
      <AppTopBar user={session.user} businessName={activeBusiness.name} />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
      <AppFooter businessName={activeBusiness.name} />
    </div>
  );
}
