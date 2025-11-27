"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </Link>
            <Image
              src="/logo.png"
              alt="Good Life Music"
              width={120}
              height={40}
              className="object-contain brightness-0"
              priority
            />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Title */}
          <div className="text-center border-b border-gray-200 pb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
              PRIVACY POLICY
            </h1>
            <p className="text-gray-500 text-sm">
              Last updated: 2025
            </p>
          </div>

          {/* Sections */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Introduction</h2>
              <p className="text-gray-600 leading-relaxed">
                This Privacy Policy explains how GOOD LIFE MUSIC S.L. ("we", "us", "our") collects, uses, and protects your personal data when you visit our website or use our services.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                We are committed to GDPR compliance and protecting your privacy.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Data We Collect</h2>
              <p className="text-gray-600 leading-relaxed mb-3">We may collect:</p>
              
              <h3 className="text-lg font-medium text-gray-800 mb-2">Information you provide</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4 mb-4">
                <li>Name / artist name</li>
                <li>Contact details</li>
                <li>Spotify or social links</li>
                <li>Music catalogue information</li>
                <li>Messages or submissions through our forms</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-800 mb-2">Information we automatically collect</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>IP address</li>
                <li>Device information</li>
                <li>Website usage data (via cookies)</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">How We Use Your Data</h2>
              <p className="text-gray-600 leading-relaxed mb-3">We use your data to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>provide and manage our services</li>
                <li>evaluate artist submissions</li>
                <li>communicate with you</li>
                <li>comply with legal obligations</li>
                <li>improve our website and systems</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3 font-medium">
                We do not sell your data.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Legal Basis for Processing</h2>
              <p className="text-gray-600 leading-relaxed mb-3">We process your data under:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>Contract (to deliver the service)</li>
                <li>Consent (e.g., forms, marketing opt-ins)</li>
                <li>Legitimate interest (security, analytics)</li>
                <li>Legal obligations</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Sharing Your Data</h2>
              <p className="text-gray-600 leading-relaxed mb-3">We may share data with:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>trusted service providers (hosting, analytics, storage)</li>
                <li>partners involved in providing the services</li>
                <li>legal authorities when required</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                All partners follow GDPR guidelines.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">International Transfers</h2>
              <p className="text-gray-600 leading-relaxed">
                Your data may be processed outside the EU when necessary.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                We ensure appropriate safeguards under GDPR (e.g., SCCs).
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Retention</h2>
              <p className="text-gray-600 leading-relaxed">
                We keep your data only for as long as needed to provide the service, comply with legal obligations, or resolve disputes.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
              <p className="text-gray-600 leading-relaxed mb-3">Under GDPR, you have the right to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>access your data</li>
                <li>correct inaccurate data</li>
                <li>request deletion</li>
                <li>restrict or object to processing</li>
                <li>withdraw consent</li>
                <li>request data portability</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Contact us anytime to exercise these rights.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies</h2>
              <p className="text-gray-600 leading-relaxed">
                We use cookies to improve website performance and analyze traffic.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                You can control cookies through your browser settings.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Security</h2>
              <p className="text-gray-600 leading-relaxed">
                We use technical and organizational measures to protect your data, but no system is 100% secure.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Policy</h2>
              <p className="text-gray-600 leading-relaxed">
                We may update this Privacy Policy at any time. The updated version will be posted on our website.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
              <p className="text-gray-600 leading-relaxed">
                If you have questions about this Privacy Policy or your data rights, please contact us through the details listed on our website.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
