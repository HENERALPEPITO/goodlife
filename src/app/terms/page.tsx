import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms & Conditions | Good Life Music",
  description: "Terms and Conditions for using Good Life Music's royalty splitter and analytics dashboard platform.",
};

export default function TermsPage() {
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
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms & Conditions</h1>
          <p className="text-emerald-50 text-lg">Last updated: November 25, 2025</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl shadow-sm p-8 md:p-12 space-y-8">
          
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              1. Introduction & Acceptance
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                Welcome to Good Life Music ("we," "us," "our," or "the Platform"). By accessing or using our 
                royalty splitter and analytics dashboard, you agree to be bound by these Terms & Conditions 
                ("Terms"). If you do not agree with any part of these Terms, you must not use our Platform.
              </p>
              <p>
                Good Life Music provides a comprehensive music royalty management solution, including revenue 
                tracking, royalty splitting, CSV/XLSX data upload capabilities, artist analytics, revenue by 
                territory, listener statistics, and monthly/quarterly revenue insights.
              </p>
              <p>
                These Terms constitute a legally binding agreement between you (the user or "Artist") and 
                Good Life Music. We reserve the right to update these Terms at any time, and continued use 
                of the Platform after changes constitutes acceptance of the modified Terms.
              </p>
            </div>
          </section>

          {/* Use of Platform */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              2. Use of the Platform
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>2.1 Eligibility:</strong> You must be at least 18 years old or have the legal capacity 
                to enter into contracts in your jurisdiction to use this Platform.
              </p>
              <p>
                <strong>2.2 Account Registration:</strong> You are responsible for maintaining the confidentiality 
                of your account credentials and are fully responsible for all activities that occur under your account.
              </p>
              <p>
                <strong>2.3 Permitted Use:</strong> You may use the Platform solely for lawful purposes related to 
                managing music royalties, tracking revenue, analyzing performance metrics, and managing artist payments.
              </p>
              <p>
                <strong>2.4 Prohibited Activities:</strong> You agree not to:
              </p>
              <ul className="list-disc list-inside ml-4 space-y-2">
                <li>Upload false, inaccurate, or misleading royalty data</li>
                <li>Attempt to gain unauthorized access to any part of the Platform</li>
                <li>Use the Platform to infringe upon intellectual property rights</li>
                <li>Interfere with or disrupt the Platform's functionality</li>
                <li>Use automated systems (bots, scrapers) without permission</li>
                <li>Impersonate another person or entity</li>
              </ul>
            </div>
          </section>

          {/* Data Upload Responsibility */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              3. Data Upload Responsibility (CSV/XLSX)
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>3.1 Accuracy of Data:</strong> You are solely responsible for the accuracy, completeness, 
                and legality of all data you upload to the Platform, including CSV and XLSX files containing 
                royalty information, revenue data, and artist metrics.
              </p>
              <p>
                <strong>3.2 Data Ownership:</strong> You represent and warrant that you own or have the necessary 
                rights to upload and process all data submitted to the Platform.
              </p>
              <p>
                <strong>3.3 File Format Compliance:</strong> Uploaded files must comply with our specified formats. 
                While we strive to process files correctly, we are not responsible for errors resulting from 
                improperly formatted data.
              </p>
              <p>
                <strong>3.4 Data Verification:</strong> It is your responsibility to verify the accuracy of 
                processed data after upload. We recommend reviewing all analytics and calculations before making 
                any financial decisions.
              </p>
            </div>
          </section>

          {/* Royalty Calculation Disclaimer */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              4. Royalty Calculation Disclaimer
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>4.1 Calculation Tools:</strong> Our Platform provides tools to calculate and split royalties 
                based on the data you provide. These calculations are performed automatically using algorithms and 
                formulas designed for accuracy.
              </p>
              <p>
                <strong>4.2 No Financial Guarantee:</strong> While we make every effort to ensure accuracy, 
                Good Life Music does not guarantee the absolute correctness of royalty calculations, revenue 
                projections, or analytics. You should independently verify all financial data.
              </p>
              <p>
                <strong>4.3 User Responsibility:</strong> You are solely responsible for verifying the accuracy 
                of splits, percentages, and payment amounts before executing any transactions or payments.
              </p>
              <p>
                <strong>4.4 Not Financial Advice:</strong> The Platform provides data analytics and calculation 
                tools but does not provide financial, legal, or tax advice. Consult with qualified professionals 
                for such matters.
              </p>
            </div>
          </section>

          {/* Account Security */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              5. Account Security
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>5.1 Password Security:</strong> You must maintain strong passwords and keep your login 
                credentials confidential. Never share your password with others.
              </p>
              <p>
                <strong>5.2 Unauthorized Access:</strong> You must immediately notify us of any unauthorized 
                access to or use of your account. We are not liable for any loss or damage from your failure 
                to comply with this security obligation.
              </p>
              <p>
                <strong>5.3 Account Termination:</strong> We reserve the right to suspend or terminate your 
                account at any time for violation of these Terms or for any other reason at our discretion.
              </p>
            </div>
          </section>

          {/* Payment & Payout Notes */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              6. Payment & Payout
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>6.1 Payment Processing:</strong> The Platform may facilitate royalty payment requests 
                and tracking, but actual fund transfers are subject to third-party payment processors and 
                banking regulations.
              </p>
              <p>
                <strong>6.2 Payment Delays:</strong> We are not responsible for delays caused by third-party 
                payment processors, banking institutions, or verification requirements.
              </p>
              <p>
                <strong>6.3 Tax Compliance:</strong> You are responsible for all tax obligations related to 
                royalty income. We may issue tax documents as required by law, but you should consult a tax 
                professional for your specific situation.
              </p>
              <p>
                <strong>6.4 Currency & Fees:</strong> Payments are processed in the currency specified in your 
                account settings. Transaction fees may apply and will be clearly disclosed.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              7. Limitation of Liability
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>7.1 Platform Availability:</strong> We strive to maintain uninterrupted service but do 
                not guarantee that the Platform will be available at all times. We are not liable for any 
                downtime or service interruptions.
              </p>
              <p>
                <strong>7.2 Data Loss:</strong> While we implement robust backup and security measures, we are 
                not liable for any data loss. You should maintain your own backups of important information.
              </p>
              <p>
                <strong>7.3 Maximum Liability:</strong> To the fullest extent permitted by law, our total liability 
                to you for all claims arising from your use of the Platform shall not exceed the amount you paid 
                us (if any) in the twelve (12) months preceding the claim.
              </p>
              <p>
                <strong>7.4 Exclusion of Damages:</strong> We shall not be liable for any indirect, incidental, 
                special, consequential, or punitive damages, including but not limited to loss of profits, data, 
                or goodwill.
              </p>
              <p>
                <strong>7.5 "As Is" Provision:</strong> The Platform is provided "as is" and "as available" 
                without warranties of any kind, either express or implied.
              </p>
            </div>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              8. Intellectual Property
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>8.1 Platform Ownership:</strong> All content, features, and functionality of the Platform, 
                including but not limited to text, graphics, logos, icons, images, and software, are the exclusive 
                property of Good Life Music and are protected by copyright, trademark, and other intellectual 
                property laws.
              </p>
              <p>
                <strong>8.2 Limited License:</strong> We grant you a limited, non-exclusive, non-transferable 
                license to access and use the Platform for its intended purpose.
              </p>
              <p>
                <strong>8.3 Your Data:</strong> You retain all rights to the data you upload. By using the Platform, 
                you grant us a license to process and display your data solely for the purpose of providing our services.
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              9. Governing Law & Dispute Resolution
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                <strong>9.1 Governing Law:</strong> These Terms shall be governed by and construed in accordance 
                with the laws of the jurisdiction in which Good Life Music operates, without regard to its conflict 
                of law provisions.
              </p>
              <p>
                <strong>9.2 Dispute Resolution:</strong> Any disputes arising out of or relating to these Terms 
                shall first be attempted to be resolved through good-faith negotiations. If negotiations fail, 
                disputes shall be resolved through binding arbitration or litigation in the courts of our jurisdiction.
              </p>
              <p>
                <strong>9.3 Severability:</strong> If any provision of these Terms is found to be invalid or 
                unenforceable, the remaining provisions shall continue in full force and effect.
              </p>
            </div>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              10. Changes to These Terms
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                We reserve the right to modify these Terms at any time. We will notify users of material changes 
                by posting a notice on the Platform or sending an email notification. Your continued use of the 
                Platform after such changes constitutes your acceptance of the new Terms.
              </p>
            </div>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2">
              11. Contact Information
            </h2>
            <div className="text-gray-700 leading-relaxed space-y-4">
              <p>
                If you have any questions about these Terms & Conditions, please contact us at:
              </p>
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded">
                <p className="font-semibold text-gray-900">Good Life Music</p>
                <p className="text-gray-700">Email: legal@goodlifemusic.com</p>
                <p className="text-gray-700">Support: support@goodlifemusic.com</p>
              </div>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Acknowledgment</h3>
            <p className="text-gray-700 leading-relaxed">
              By using Good Life Music's royalty splitter and analytics platform, you acknowledge that you have 
              read, understood, and agree to be bound by these Terms & Conditions. If you do not agree to these 
              Terms, you must discontinue use of the Platform immediately.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
