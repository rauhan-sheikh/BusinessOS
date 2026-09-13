import { redirect } from "next/navigation";
import { getActiveBusinessContext } from "@/modules/auth/utils/session-helper";
import { businessService } from "@/modules/businesses/services/business.service";
import { AppError } from "@/shared/errors/app-error";
import AppTopBar from "./components/AppTopBar";
import AppFooter from "./components/AppFooter";
import { ToastProvider } from "@/shared/components/ui";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // One resolution for the whole render: the helper is request-memoised, so the
  // pages below reuse this rather than repeating the session lookup and
  // membership join. The layout previously did both itself and then called the
  // helper anyway, which meant doing the work twice before rendering anything.
  let context;
  try {
    context = await getActiveBusinessContext();
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 401) {
      redirect("/login");
    }
    // 403 here means the account is authenticated but has no workspace yet.
    if (err instanceof AppError && err.statusCode === 403) {
      redirect("/onboarding");
    }
    throw err;
  }

  const { user, business: activeBusiness, role: activeRole } = context;

  // Only the workspace switcher needs the full membership list.
  const memberships = await businessService.getBusinessesForUser(user.id);
  const serializedMemberships = memberships.map((m) => ({
    id: m.business.id,
    name: m.business.name,
    role: m.role,
  }));

  return (
    // Wraps the shell rather than the root layout, so toasts are available to
    // every authenticated page without loading the provider on marketing pages.
    <ToastProvider>
      <div className="min-h-screen flex flex-col bg-canvas text-fg antialiased">
        <AppTopBar
          user={user}
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
    </ToastProvider>
  );
}
