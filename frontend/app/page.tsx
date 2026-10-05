import Link from "next/link";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Scale, FileText, ShieldAlert, MessageCircle, Gavel, ArrowRight, ShieldCheck, Sparkles, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="relative">
      {/* Background Gradients removed as they are now in layout.tsx */}

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/10 bg-slate-950/50 backdrop-blur-md">
        <div className="container mx-auto px-4 flex h-20 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
              <Scale className="w-6 h-6 text-amber-500" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              LegalSaathi<span className="text-amber-500">.</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <SignedOut>
              <SignInButton mode="redirect">
                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/5">Sign in</Button>
              </SignInButton>
              <SignUpButton mode="redirect">
                <Button className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                  Get Started Free
                </Button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button variant="outline" className="border-amber-500/50 text-amber-500 hover:bg-amber-500/10">Dashboard</Button>
              </Link>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 container mx-auto px-4 pt-32 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          <span>India&apos;s First AI Legal Companion</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-tight">
          Demystifying Law <br className="hidden md:block" />
          <span className="bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600 bg-clip-text text-transparent">
            For Every Indian.
          </span>
        </h1>
        
        <p className="mt-6 text-xl md:text-2xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
          Rent agreements, FIRs, court notices — understand everything instantly in <strong className="text-white">Hindi or English</strong>. Spot risks before they become problems.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row justify-center gap-4">
          <SignedOut>
            <SignUpButton mode="redirect">
              <Button size="lg" className="h-14 px-8 text-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-[0_0_40px_rgba(245,158,11,0.4)] transition-all hover:shadow-[0_0_60px_rgba(245,158,11,0.6)] group">
                Try it for Free 
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </SignUpButton>
            <Link href="#features">
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-white backdrop-blur-md">
                See How It Works
              </Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard">
              <Button size="lg" className="h-14 px-8 text-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-[0_0_40px_rgba(245,158,11,0.4)]">
                Go to Dashboard
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </SignedIn>
        </div>

        <div className="mt-20 flex justify-center items-center gap-8 text-slate-500 text-sm font-medium">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span>100% Secure & Private</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>Lightning Fast Analysis</span>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="relative z-10 container mx-auto px-4 py-24 border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Powerful Legal Features</h2>
          <p className="text-slate-400 text-lg">Everything you need to understand legal documents without hiring a lawyer.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {/* Feature 1 */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-amber-500/50 transition-colors group">
            <CardContent className="pt-8 px-6 pb-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
              <div className="mx-auto w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 group-hover:scale-110 transition-transform">
                <FileText className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Smart PDF Analysis</h3>
              <p className="text-slate-400 leading-relaxed">
                Drag & drop any legal document. We extract the core meaning and summarize it in 5 simple bullet points.
              </p>
            </CardContent>
          </Card>

          {/* Feature 2 */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-amber-500/50 transition-colors group">
            <CardContent className="pt-8 px-6 pb-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
              <div className="mx-auto w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mb-6 border border-rose-500/20 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-8 h-8 text-rose-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Risk Detection</h3>
              <p className="text-slate-400 leading-relaxed">
                Our AI highlights hidden clauses, unfair terms, and potential legal risks in red before you sign anything.
              </p>
            </CardContent>
          </Card>

          {/* Feature 3 */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm hover:border-amber-500/50 transition-colors group">
            <CardContent className="pt-8 px-6 pb-8 text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
              <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                <MessageCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">AI Legal Chat</h3>
              <p className="text-slate-400 leading-relaxed">
                Chat with your document in Hindi or English. Ask questions, clarify doubts, and get simple answers instantly.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-slate-950 py-12 text-center relative z-10">
        <div className="flex justify-center items-center gap-2 mb-4">
          <Gavel className="w-6 h-6 text-amber-500" />
          <span className="text-xl font-bold text-white">LegalSaathi</span>
        </div>
        <p className="text-slate-500">Empowering every citizen with legal knowledge.</p>
        <p className="text-slate-600 mt-2 text-sm">© {new Date().getFullYear()} LegalSaathi AI. All rights reserved.</p>
      </footer>
    </main>
  );
}
