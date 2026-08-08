"use client";

import React, { useState, useEffect } from "react";

export default function ComingSoonPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Set your target launch date here
  const LAUNCH_DATE = new Date("2026-08-15T00:00:00").getTime();

  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = LAUNCH_DATE - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/emailList", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (Array.isArray(data.error)) {
          throw new Error(data.error[0].message || "Invalid email address");
        } else {
          throw new Error(data.error || "Failed to subscribe.");
        }
      }

      setStatus("success");
      setEmail("");
    } catch (error: any) {
      console.error("Subscribtion error:", error);
      setStatus("error");
      setErrorMessage(error.message || "An unexpected error occurred.");
    }
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 text-slate-100 px-4 select-none">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[120px]" />

      <div className="relative z-10 w-full max-w-2xl text-center space-y-12">
        {/* Branding / Badge */}
        <div className="space-y-4">
          <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold text-indigo-400 border border-indigo-500/20 uppercase tracking-widest animate-pulse">
            Under Construction
          </span>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            Something Big is Coming
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-lg mx-auto font-medium">
            We are working hard behind the scenes crafting an exceptional
            experience. Our backend systems are spinning up.
          </p>
        </div>

        {/* Countdown Grid */}
        <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-md mx-auto">
          {[
            { label: "Days", value: timeLeft.days },
            { label: "Hours", value: timeLeft.hours },
            { label: "Mins", value: timeLeft.minutes },
            { label: "Secs", value: timeLeft.seconds },
          ].map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center p-3 md:p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm shadow-xl"
            >
              <span className="text-2xl md:text-4xl font-bold font-mono tracking-tight text-indigo-400">
                {String(item.value).padStart(2, "0")}
              </span>
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider mt-1">
                {item.label}
              </span>
            </div>
          ))}
        </div>

        {/* Notification Form */}
        <div className="max-w-md mx-auto space-y-3">
          <form
            onSubmit={handleSubscribe}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email for early access"
              disabled={status === "loading" || status === "success"}
              className="w-full rounded-xl bg-slate-900 border border-slate-800 px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition disabled:opacity-50"
              required
            />
            <button
              type="submit"
              disabled={status === "loading" || status === "success"}
              className="sm:w-36 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {status === "loading" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : status === "success" ? (
                "✓ Done"
              ) : (
                "Notify Me"
              )}
            </button>
          </form>

          {/* Success Status Subtext */}
          {status === "success" && (
            <p className="text-xs text-emerald-400 font-medium animate-fade-in">
              Awesome! We will let you know as soon as the platform goes live.
            </p>
          )}

          {/* Error Status Subtext */}
          {status === "error" && (
            <p className="text-xs text-rose-400 font-medium animate-fade-in text-center bg-rose-500/10 border border-rose-500/20 py-2 px-3 rounded-xl">
              {errorMessage}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="absolute bottom-6 text-xs text-slate-600 font-medium">
        &copy; {new Date().getFullYear()} BusinessOS. All rights reserved.
      </footer>
    </main>
  );
}
