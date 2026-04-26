import Link from 'next/link'
import { Leaf, CheckCircle, ArrowRight, Target, Sparkles, Receipt } from 'lucide-react'

export default function WelcomePage() {
  return (
    <div className="min-h-screen flex">

      {/* Left panel — dark sage, same style as login/signup */}
      <div className="hidden lg:flex lg:w-1/2 bg-sage-900 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-sage-600">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-semibold text-lg">Flow Finance</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-snug">
            Your budget is<br />ready to go.
          </h1>
          <p className="text-sage-300 text-sm leading-relaxed max-w-xs">
            24 default categories have been set up for you. Adjust them to match your life, then enter your first income to let the AI do its job.
          </p>
          <ul className="space-y-3 pt-2">
            {[
              { icon: Target,    text: 'Set your targets and priorities' },
              { icon: Sparkles,  text: 'AI allocates every income payment' },
              { icon: Receipt,   text: 'Log expenses and track history' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sage-300 text-sm">
                <Icon className="w-4 h-4 text-sage-500 shrink-0" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sage-600 text-xs">Flow Finance — built for freelancers.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col items-center justify-center bg-sage-50 px-6 py-12">

        {/* Mobile logo */}
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sage-600">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sage-900">Flow Finance</span>
        </div>

        <div className="w-full max-w-sm text-center space-y-6">

          {/* Success icon */}
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-sage-100 border-4 border-sage-200">
              <CheckCircle className="w-10 h-10 text-sage-600" />
            </div>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-sage-900">You&apos;re all set!</h2>
            <p className="text-sage-500 text-sm leading-relaxed">
              Your account is confirmed and your budget is ready. 24 categories have been created for you — customise them, then enter your first income to get started.
            </p>
          </div>

          {/* Steps */}
          <div className="bg-white rounded-xl border border-sage-200 p-5 text-left space-y-4">
            <p className="text-xs font-semibold text-sage-500 uppercase tracking-wide">Quick start</p>
            {[
              { step: '1', title: 'Review your categories', desc: 'Set targets, priorities, and due dates' },
              { step: '2', title: 'Enter your income', desc: 'The AI will allocate it for you' },
              { step: '3', title: 'Log expenses as you go', desc: 'Keep your balances accurate' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-sage-600 text-white text-xs font-bold shrink-0 mt-0.5">
                  {step}
                </div>
                <div>
                  <p className="text-sm font-medium text-sage-900">{title}</p>
                  <p className="text-xs text-sage-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-sage-600 hover:bg-sage-700 text-white font-medium text-sm rounded-lg transition-colors"
          >
            Go to my dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>

        </div>
      </div>
    </div>
  )
}
