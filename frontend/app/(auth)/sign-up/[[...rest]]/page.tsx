import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] opacity-20 pointer-events-none -z-10">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-600 blur-[120px] rounded-full mix-blend-screen" />
      </div>
      <SignUp appearance={{ 
        baseTheme: dark,
        elements: { 
          formButtonPrimary: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold',
          card: 'bg-slate-900/80 border border-slate-800 backdrop-blur-md',
          footerActionLink: 'text-amber-500 hover:text-amber-400'
        } 
      }} />
    </div>
  );
}
