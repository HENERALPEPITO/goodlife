"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";

export default function TermsAndConditionsPage() {
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
              TERMS AND CONDITIONS
            </h1>
            <p className="text-gray-500 text-sm">
              Last updated: 2025
            </p>
          </div>

          {/* Sections */}
          <section className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">About Us</h2>
              <p className="text-gray-600 leading-relaxed">
                These Terms of Service ("Terms") apply to your use of the services provided by GOOD LIFE MUSIC S.L. ("we", "us", "our"). By accessing our website or using our services, you agree to these Terms.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Services We Provide</h2>
              <p className="text-gray-600 leading-relaxed">
                We offer neighbouring rights collection, catalogue administration, sync submissions, and other music-related services as agreed with you.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                Details of our services are available on our website.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Responsibilities</h2>
              <p className="text-gray-600 leading-relaxed mb-3">You agree to:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>provide accurate information</li>
                <li>comply with all applicable laws</li>
                <li>keep your account secure</li>
                <li>not misuse, copy, reverse-engineer, or distribute our software, systems, or content</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                You must not upload harmful, illegal, or infringing material.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Fees & Payment</h2>
              <p className="text-gray-600 leading-relaxed mb-3">
                Fees are listed on our website or in your agreement with us.
              </p>
              <p className="text-gray-600 leading-relaxed mb-2">All fees:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>are payable in EUR</li>
                <li>may include VAT</li>
                <li>are non-refundable unless we terminate your account without cause</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Data & Privacy</h2>
              <p className="text-gray-600 leading-relaxed">
                You own your data. We process it only to provide the service and in line with our{" "}
                <Link href="/privacy-policy" className="text-blue-600 hover:underline">
                  Privacy Policy
                </Link>.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                Some data may be stored or processed outside the EU when required.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Intellectual Property</h2>
              <p className="text-gray-600 leading-relaxed">
                All rights in our software, brand, and materials belong to GOOD LIFE MUSIC S.L. or our licensors.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                You may not use our trademarks or content without permission.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h2>
              <p className="text-gray-600 leading-relaxed mb-3">To the maximum extent allowed by law:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>our services are provided "as is"</li>
                <li>we are not responsible for lost profits, data, revenue, or indirect damages</li>
                <li>our total liability is limited to the fees paid by you in the month before the claim</li>
              </ul>
              <p className="text-gray-600 leading-relaxed mt-3">
                Nothing limits liability for fraud or personal injury caused by negligence.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Termination</h2>
              <p className="text-gray-600 leading-relaxed">
                You may stop using our services at any time.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                We may suspend or terminate access if you violate these Terms.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3 mb-2">Upon termination:</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1 ml-4">
                <li>your access ends</li>
                <li>we may delete your data after 10 days unless you request it</li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to These Terms</h2>
              <p className="text-gray-600 leading-relaxed">
                We may update these Terms at any time. Changes take effect once posted.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Governing Law</h2>
              <p className="text-gray-600 leading-relaxed">
                These Terms are governed by Spanish law.
              </p>
              <p className="text-gray-600 leading-relaxed mt-3">
                Disputes will be resolved exclusively in Spain's courts.
              </p>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
              <p className="text-gray-600 leading-relaxed">
                For questions, contact us via the details on our website.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
