import { useState } from 'react'
import { TermsOfService } from './TermsOfService'
import { PrivacyPolicy } from './PrivacyPolicy'

interface WelcomeScreenProps {
  onAccept: () => void
}

export function WelcomeScreen({ onAccept }: WelcomeScreenProps) {
  const [showTerms, setShowTerms] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)

  const canContinue = termsAccepted && privacyAccepted

  const handleAccept = () => {
    if (canContinue) {
      // Record acceptance with timestamp
      localStorage.setItem('legal-acceptance', JSON.stringify({
        termsAccepted: true,
        privacyAccepted: true,
        acceptedAt: new Date().toISOString(),
        version: '1.0',
      }))
      onAccept()
    }
  }

  if (showTerms) {
    return (
      <TermsOfService
        isOpen={showTerms}
        onClose={() => setShowTerms(false)}
      />
    )
  }

  if (showPrivacy) {
    return (
      <PrivacyPolicy
        isOpen={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />
    )
  }

  return (
    <div className="min-h-screen-safe bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-zinc-100 mb-2">Minimal Habits</h1>
          <p className="text-sm text-zinc-500">Track your daily habits with simplicity</p>
        </div>

        {/* Welcome card */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h2 className="text-lg font-medium text-zinc-100 mb-4">Welcome</h2>

          <p className="text-sm text-zinc-400 mb-6">
            Before you get started, please review and accept our Terms of Service and Privacy Policy.
          </p>

          {/* Checkboxes */}
          <div className="space-y-4 mb-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-zinc-500 focus:ring-offset-zinc-900"
                />
              </div>
              <span className="text-sm text-zinc-300">
                I have read and agree to the{' '}
                <button
                  onClick={() => setShowTerms(true)}
                  className="text-zinc-100 underline hover:text-white"
                >
                  Terms of Service
                </button>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-zinc-500 focus:ring-offset-zinc-900"
                />
              </div>
              <span className="text-sm text-zinc-300">
                I have read and agree to the{' '}
                <button
                  onClick={() => setShowPrivacy(true)}
                  className="text-zinc-100 underline hover:text-white"
                >
                  Privacy Policy
                </button>
              </span>
            </label>
          </div>

          {/* Continue button */}
          <button
            onClick={handleAccept}
            disabled={!canContinue}
            className="w-full py-3 px-4 rounded-lg bg-zinc-100 text-zinc-900 text-sm font-medium transition-colors hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Get Started
          </button>
        </div>

        {/* Branding */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-600 mt-6">
          <span className="font-medium text-zinc-500">Minimal Habits</span>
          <span>·</span>
          <span>Designed in <span className="text-zinc-500">Cupertino</span></span>
          <span>·</span>
          <span className="text-zinc-500">Naga Samineni</span>
        </div>
      </div>
    </div>
  )
}
