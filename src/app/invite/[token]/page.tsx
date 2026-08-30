import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { invitationService } from "@/modules/businesses/services/invitation.service";
import InviteClient from "./InviteClient";
import Link from "next/link";
import Logo from "@/shared/components/Logo";

export default async function InvitePage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;
  const session = await auth.api.getSession({ headers: await headers() });

  let invitation = null;
  let errorMessage: string | null = null;

  try {
    const res = await invitationService.getInvitationByToken(token);
    invitation = res.invitation;
  } catch (err: unknown) {
    errorMessage =
      err instanceof Error
        ? err.message
        : "This invitation link is not valid or has already expired.";
  }

  if (errorMessage || !invitation) {
    return (
      <div className="min-h-screen flex flex-col justify-between bg-slate-950 text-slate-100 p-4">
        <header className="mx-auto w-full max-w-7xl py-4 flex items-center justify-between">
          <Logo href="/" size="md" />
        </header>

        <div className="mx-auto max-w-md w-full my-auto rounded-3xl bg-slate-900/80 border border-slate-800 p-8 text-center space-y-4 shadow-2xl">
          <div className="h-12 w-12 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-2xl flex items-center justify-center mx-auto">
            ⚠️
          </div>
          <h1 className="text-xl font-bold text-slate-100">Invalid or Expired Invite</h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            {errorMessage || "This invitation link is not valid or has already expired."}
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition-all"
            >
              Sign In to BusinessOS
            </Link>
          </div>
        </div>

        <footer className="text-center text-xs text-slate-600 py-4">
          &copy; {new Date().getFullYear()} BusinessOS. All rights reserved.
        </footer>
      </div>
    );
  }

  return (
    <InviteClient
      token={token}
      invitation={invitation}
      currentUser={
        session?.user
          ? {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
            }
          : null
      }
    />
  );
}
