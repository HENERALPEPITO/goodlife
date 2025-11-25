import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy | Good Life Music",
  description: "Privacy Policy for Good Life Music's royalty management platform. Learn how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-emerald-50 text-lg">Last updated: November 25, 2025</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              1. Introduction
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                Good Life Music ("we," "us," "our") is committed to protecting your privacy. This Privacy Policy 
                explains how we collect, use, disclose, and safeguard your information when you use our royalty 
                splitter and analytics dashboard platform ("Platform").
              </p>
              <p>
                We understand the importance of data privacy, especially when handling sensitive financial and 
                royalty information. This policy describes our practices regarding personal data, uploaded files 
                (CSV/XLSX), analytics data, and how we ensure your information remains secure.
              </p>
              <p>
                By using our Platform, you consent to the data practices described in this Privacy Policy. If you 
                do not agree with our policies and practices, please do not use the Platform.
              </p>
            </div>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              2. Information We Collect
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>2.1 Personal Information:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Account registration data (name, email address, password)</li>
                <li>Profile information (artist name, bio, profile picture)</li>
                <li>Payment information (bank details, payment processor credentials)</li>
                <li>Contact information (phone number, address if provided)</li>
                <li>Communication data (support inquiries, feedback)</li>
              </ul>

              <p className="mt-4">
                <strong>2.2 Royalty & Financial Data:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Royalty statements and revenue data</li>
                <li>Track titles, ISRCs, and catalog information</li>
                <li>Payment history and transaction records</li>
                <li>Territory-based revenue breakdowns</li>
                <li>Streaming and usage statistics</li>
                <li>Royalty split percentages and beneficiary information</li>
              </ul>

              <p className="mt-4">
                <strong>2.3 Uploaded File Data (CSV/XLSX):</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Contents of CSV and XLSX files you upload for processing</li>
                <li>Metadata associated with uploaded files (filename, upload date, file size)</li>
                <li>Processed and parsed data from uploaded files</li>
                <li>Historical upload records</li>
              </ul>

              <p className="mt-4">
                <strong>2.4 Usage & Analytics Data:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Pages visited and features used within the Platform</li>
                <li>Time spent on the Platform and usage patterns</li>
                <li>Device information (browser type, operating system, IP address)</li>
                <li>Cookies and similar tracking technologies (see Section 6)</li>
                <li>Error logs and technical diagnostics</li>
              </ul>

              <p className="mt-4">
                <strong>2.5 Automatically Collected Information:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Log data (IP addresses, browser types, access times)</li>
                <li>Device identifiers and session information</li>
                <li>Referring/exit pages and URLs</li>
                <li>Click patterns and navigation paths</li>
              </ul>
            </div>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              3. How We Use Your Information
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>We use the collected information for the following purposes:</p>
              
              <p className="mt-4">
                <strong>3.1 Platform Functionality:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Process and analyze royalty data from uploaded CSV/XLSX files</li>
                <li>Calculate revenue splits and payment distributions</li>
                <li>Generate analytics dashboards and performance reports</li>
                <li>Display revenue by territory, source, and time period</li>
                <li>Track listener statistics and engagement metrics</li>
                <li>Provide monthly and quarterly revenue insights</li>
              </ul>

              <p className="mt-4">
                <strong>3.2 Account Management:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Create and manage your user account</li>
                <li>Authenticate your identity and maintain security</li>
                <li>Process payment requests and manage transactions</li>
                <li>Communicate important account updates and notifications</li>
              </ul>

              <p className="mt-4">
                <strong>3.3 Service Improvement:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Analyze usage patterns to improve Platform features</li>
                <li>Identify and fix technical issues</li>
                <li>Develop new features and functionalities</li>
                <li>Optimize user experience and performance</li>
              </ul>

              <p className="mt-4">
                <strong>3.4 Communication:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Send service-related notifications and updates</li>
                <li>Respond to support inquiries and provide assistance</li>
                <li>Send important platform announcements</li>
                <li>Provide marketing communications (with your consent)</li>
              </ul>

              <p className="mt-4">
                <strong>3.5 Legal Compliance:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Comply with legal obligations and regulations</li>
                <li>Enforce our Terms & Conditions</li>
                <li>Protect against fraud and security threats</li>
                <li>Respond to legal requests and prevent harm</li>
              </ul>
            </div>
          </section>

          {/* CSV/XLSX Data Handling */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              4. How CSV/XLSX Uploaded Data is Handled
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>4.1 Data Processing:</strong> When you upload CSV or XLSX files containing royalty data:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Files are securely transmitted using encrypted connections (HTTPS/TLS)</li>
                <li>Data is parsed and validated for accuracy and format compliance</li>
                <li>Information is stored in our secure database infrastructure</li>
                <li>Calculations are performed server-side to generate analytics</li>
                <li>Original files may be stored temporarily for verification purposes</li>
              </ul>

              <p className="mt-4">
                <strong>4.2 Data Retention:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Processed royalty data is retained as long as your account is active</li>
                <li>Historical data is maintained for audit and compliance purposes</li>
                <li>You can request deletion of specific uploads (see Section 9)</li>
                <li>Backup copies may exist for disaster recovery purposes</li>
              </ul>

              <p className="mt-4">
                <strong>4.3 Data Accuracy:</strong>
              </p>
              <p>
                You are responsible for the accuracy of uploaded data. We process files as provided and are not 
                liable for errors in the source data. We recommend verifying all information after processing.
              </p>

              <p className="mt-4">
                <strong>4.4 Access Control:</strong>
              </p>
              <p>
                Uploaded data is accessible only to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>The account owner who uploaded the data</li>
                <li>Authorized users within the same organization (if applicable)</li>
                <li>Good Life Music technical staff for support purposes (with your permission)</li>
                <li>Third-party service providers under strict confidentiality agreements</li>
              </ul>
            </div>
          </section>

          {/* Analytics Data Processing */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              5. How Analytics Data is Processed
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>5.1 Analytics Features:</strong> Our Platform processes your data to provide:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Revenue tracking and trend analysis</li>
                <li>Top performing tracks and catalog insights</li>
                <li>Geographic revenue distribution (territory-based analytics)</li>
                <li>Revenue by source (streaming platforms, digital stores, etc.)</li>
                <li>Time-based revenue trends (monthly, quarterly, yearly)</li>
                <li>Listener statistics and engagement metrics</li>
                <li>Payment history and projected earnings</li>
              </ul>

              <p className="mt-4">
                <strong>5.2 Aggregated Data:</strong>
              </p>
              <p>
                We may use aggregated, anonymized data for:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Industry trend analysis and reporting</li>
                <li>Platform performance benchmarks</li>
                <li>Research and development purposes</li>
                <li>Marketing and promotional materials</li>
              </ul>
              <p className="mt-2">
                Aggregated data cannot be used to identify individual users and is considered non-personal information.
              </p>

              <p className="mt-4">
                <strong>5.3 Real-Time Processing:</strong>
              </p>
              <p>
                Analytics dashboards update in real-time as new data is uploaded or calculated. This processing 
                occurs on secure servers with restricted access.
              </p>
            </div>
          </section>

          {/* Cookies */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              6. Cookies & Tracking Technologies
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>6.1 What Are Cookies:</strong> Cookies are small text files stored on your device that 
                help us provide and improve our services.
              </p>

              <p className="mt-4">
                <strong>6.2 Types of Cookies We Use:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Essential Cookies:</strong> Required for authentication and core platform functionality</li>
                <li><strong>Performance Cookies:</strong> Help us understand how users interact with the Platform</li>
                <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                <li><strong>Analytics Cookies:</strong> Track usage patterns to improve our services</li>
              </ul>

              <p className="mt-4">
                <strong>6.3 Managing Cookies:</strong>
              </p>
              <p>
                You can control cookie settings through your browser preferences. However, disabling essential 
                cookies may limit Platform functionality.
              </p>

              <p className="mt-4">
                <strong>6.4 Third-Party Cookies:</strong>
              </p>
              <p>
                We may use third-party analytics services (e.g., Google Analytics) that set their own cookies. 
                These are governed by the respective third-party privacy policies.
              </p>
            </div>
          </section>

          {/* Data Storage & Security */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              7. Data Storage & Security
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>7.1 Storage Infrastructure:</strong>
              </p>
              <p>
                Your data is stored on secure cloud infrastructure provided by:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Supabase:</strong> For database storage and authentication</li>
                <li><strong>AWS (Amazon Web Services):</strong> For file storage and backup services</li>
                <li>Other reputable cloud service providers with industry-standard security</li>
              </ul>

              <p className="mt-4">
                <strong>7.2 Security Measures:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Data encryption in transit (TLS/SSL) and at rest</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and role-based permissions</li>
                <li>Multi-factor authentication (MFA) for enhanced security</li>
                <li>Regular backups and disaster recovery procedures</li>
                <li>Monitoring and logging of system access</li>
                <li>Secure API endpoints with authentication tokens</li>
              </ul>

              <p className="mt-4">
                <strong>7.3 Data Location:</strong>
              </p>
              <p>
                Your data may be stored and processed in data centers located in various jurisdictions. We ensure 
                all locations meet appropriate security and privacy standards.
              </p>

              <p className="mt-4">
                <strong>7.4 No Absolute Security:</strong>
              </p>
              <p>
                While we implement industry-standard security measures, no system is completely secure. We cannot 
                guarantee absolute security but commit to protecting your data to the best of our ability.
              </p>
            </div>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              8. Third-Party Services
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>8.1 Service Providers:</strong> We work with third-party service providers to deliver 
                our Platform, including:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li><strong>Supabase:</strong> Database, authentication, and backend services</li>
                <li><strong>AWS:</strong> Cloud hosting, storage, and infrastructure</li>
                <li><strong>Payment Processors:</strong> To handle royalty payments and transactions</li>
                <li><strong>Email Services:</strong> For sending notifications and communications</li>
                <li><strong>Analytics Services:</strong> To understand platform usage and performance</li>
              </ul>

              <p className="mt-4">
                <strong>8.2 Data Sharing:</strong>
              </p>
              <p>
                We share data with third parties only:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>As necessary to provide Platform services</li>
                <li>With your explicit consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
              </ul>

              <p className="mt-4">
                <strong>8.3 Third-Party Links:</strong>
              </p>
              <p>
                Our Platform may contain links to external websites. We are not responsible for the privacy 
                practices of these third-party sites. We encourage you to review their privacy policies.
              </p>

              <p className="mt-4">
                <strong>8.4 Confidentiality Agreements:</strong>
              </p>
              <p>
                All third-party service providers are bound by strict confidentiality agreements and are required 
                to protect your data in accordance with this Privacy Policy and applicable laws.
              </p>
            </div>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              9. Your Rights & Data Control
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>9.1 Access & Portability:</strong>
              </p>
              <p>You have the right to:</p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Access your personal data and uploaded files</li>
                <li>Export your data in a machine-readable format</li>
                <li>Download your royalty reports and analytics</li>
                <li>Request a copy of your account information</li>
              </ul>

              <p className="mt-4">
                <strong>9.2 Correction & Update:</strong>
              </p>
              <p>
                You can update your profile information, payment details, and account settings at any time through 
                the Platform's user interface.
              </p>

              <p className="mt-4">
                <strong>9.3 Data Deletion:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>You can request deletion of your account and associated data</li>
                <li>Some data may be retained for legal, tax, or audit purposes</li>
                <li>Backup copies may persist temporarily in disaster recovery systems</li>
                <li>Anonymized aggregated data may be retained indefinitely</li>
              </ul>

              <p className="mt-4">
                <strong>9.4 Opt-Out Rights:</strong>
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Unsubscribe from marketing emails (service emails may still be sent)</li>
                <li>Disable non-essential cookies through browser settings</li>
                <li>Request restriction of data processing (where legally applicable)</li>
              </ul>

              <p className="mt-4">
                <strong>9.5 Exercising Your Rights:</strong>
              </p>
              <p>
                To exercise any of these rights, contact us at privacy@goodlifemusic.com. We will respond to 
                verified requests within 30 days.
              </p>
            </div>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              10. Children's Privacy
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                Our Platform is not intended for individuals under the age of 18. We do not knowingly collect 
                personal information from children. If we discover that a child has provided us with personal 
                information, we will promptly delete it from our systems.
              </p>
              <p>
                If you are a parent or guardian and believe your child has provided personal information to us, 
                please contact us immediately at privacy@goodlifemusic.com.
              </p>
            </div>
          </section>

          {/* International Users */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              11. International Data Transfers
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                Your data may be transferred to and processed in countries other than your country of residence. 
                These countries may have different data protection laws than your jurisdiction.
              </p>
              <p>
                By using our Platform, you consent to the transfer of your data to our servers and those of our 
                service providers, regardless of location. We ensure appropriate safeguards are in place to protect 
                your data in accordance with this Privacy Policy.
              </p>
            </div>
          </section>

          {/* Changes to Privacy Policy */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              12. Changes to This Privacy Policy
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices, 
                technology, legal requirements, or other factors.
              </p>
              <p>
                We will notify you of material changes by:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Posting a notice on the Platform</li>
                <li>Sending an email notification to your registered email address</li>
                <li>Updating the "Last Updated" date at the top of this policy</li>
              </ul>
              <p className="mt-4">
                Your continued use of the Platform after changes become effective constitutes your acceptance 
                of the revised Privacy Policy.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              13. Contact Information
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data 
                practices, please contact us:
              </p>
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded space-y-3">
                <p className="font-semibold text-gray-900 text-lg">Good Life Music - Privacy Team</p>
                <div className="space-y-1">
                  <p className="text-gray-700"><strong>Email:</strong> privacy@goodlifemusic.com</p>
                  <p className="text-gray-700"><strong>Support:</strong> support@goodlifemusic.com</p>
                  <p className="text-gray-700"><strong>Data Protection Officer:</strong> dpo@goodlifemusic.com</p>
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  We aim to respond to all privacy-related inquiries within 30 business days.
                </p>
              </div>
            </div>
          </section>

          {/* Your Consent */}
          <section className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Your Consent</h3>
            <p className="text-gray-700 leading-relaxed">
              By using Good Life Music's royalty management platform, you acknowledge that you have read and 
              understood this Privacy Policy and consent to the collection, use, and disclosure of your information 
              as described herein. If you do not agree with this Privacy Policy, please do not use the Platform.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
