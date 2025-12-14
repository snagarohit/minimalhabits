import { ResponsiveDialog } from './ResponsiveDialog'

interface TermsOfServiceProps {
  isOpen: boolean
  onClose: () => void
}

export function TermsOfService({ isOpen, onClose }: TermsOfServiceProps) {
  return (
    <ResponsiveDialog isOpen={isOpen} onClose={onClose} title="Terms of Service">
      <div className="px-4 py-4 space-y-4 text-sm text-zinc-400">
        <p className="text-xs text-zinc-500">Last updated: December 2024</p>

        <section className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
          <p className="text-xs text-zinc-300">
            <strong>IMPORTANT:</strong> These Terms of Service constitute a legally binding agreement. We reserve the right
            to modify these terms at any time without prior notice. Your continued use of the Service following any
            modifications constitutes your acceptance of the revised terms. It is your responsibility to review these
            Terms periodically.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">1. Acceptance of Terms</h3>
          <p>
            By accessing, browsing, or using Minimal Habits ("the Service"), you acknowledge that you have read,
            understood, and agree to be bound by these Terms of Service and all applicable laws and regulations.
            If you do not agree to these terms, you must immediately discontinue use of the Service.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">2. Description of Service</h3>
          <p>
            Minimal Habits is a personal habit tracking application that allows you to:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Create and manage habit tracking goals</li>
            <li>Track daily progress on your habits</li>
            <li>Optionally backup your data to Google Drive</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">3. User Data</h3>
          <p>
            Your habit data is stored locally on your device by default. If you choose to enable Google Drive backup:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Data is stored in your personal Google Drive account</li>
            <li>Only the app data folder is accessed (no access to other files)</li>
            <li>You can disconnect at any time and delete your data</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">4. User Responsibilities</h3>
          <p>You are responsible for:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Maintaining the security of your Google account credentials</li>
            <li>All activity that occurs under your account</li>
            <li>Ensuring your use complies with applicable laws</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">5. Intellectual Property</h3>
          <p>
            The Service, including its design, functionality, and content, is owned by the developer and protected
            by copyright and other intellectual property laws. You may not copy, modify, or distribute the Service
            without permission.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">6. Disclaimer of Warranties</h3>
          <p>
            THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER
            EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
            PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED,
            TIMELY, SECURE, ERROR-FREE, OR THAT DEFECTS WILL BE CORRECTED. WE MAKE NO WARRANTY REGARDING THE QUALITY,
            ACCURACY, TIMELINESS, TRUTHFULNESS, COMPLETENESS, OR RELIABILITY OF ANY CONTENT OBTAINED THROUGH THE SERVICE.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">7. Limitation of Liability</h3>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE DEVELOPER, ITS AFFILIATES,
            OFFICERS, DIRECTORS, EMPLOYEES, AGENTS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
            CONSEQUENTIAL, PUNITIVE, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO DAMAGES FOR LOSS OF PROFITS,
            GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES (EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES),
            ARISING OUT OF OR IN CONNECTION WITH YOUR ACCESS TO OR USE OF (OR INABILITY TO ACCESS OR USE) THE SERVICE.
            IN NO EVENT SHALL OUR TOTAL LIABILITY EXCEED THE AMOUNT YOU PAID US, IF ANY, FOR ACCESS TO THE SERVICE.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">8. Assumption of Risk and Waiver</h3>
          <p>
            YOU EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SERVICE IS AT YOUR SOLE RISK. YOU ASSUME FULL
            RESPONSIBILITY FOR ANY LOSS OF DATA, DAMAGE TO YOUR DEVICE, OR OTHER HARM THAT RESULTS FROM YOUR USE
            OF THE SERVICE. TO THE FULLEST EXTENT PERMITTED BY LAW, YOU HEREBY WAIVE ANY AND ALL CLAIMS AGAINST
            THE DEVELOPER ARISING FROM YOUR USE OF THE SERVICE.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">9. Data Loss</h3>
          <p>
            WE ARE NOT RESPONSIBLE FOR ANY LOSS OF DATA UNDER ANY CIRCUMSTANCES. You are solely responsible for
            maintaining backup copies of your data. We recommend enabling cloud sync or otherwise backing up your
            data regularly. We make no guarantees regarding data persistence, availability, or recovery.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">10. Modifications to Service and Terms</h3>
          <p>
            We reserve the right, at our sole discretion, to modify, suspend, or discontinue the Service (or any
            part thereof) at any time without notice or liability. We further reserve the right to modify these
            Terms at any time. Any changes will be effective immediately upon posting. Your continued use of the
            Service after any modifications indicates your acceptance of the modified Terms. It is your responsibility
            to review these Terms periodically to stay informed of any changes.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">11. Termination</h3>
          <p>
            You may stop using the Service at any time. We may terminate or suspend your access to the
            Service immediately, without prior notice or liability, at our sole discretion, for any reason
            whatsoever, including without limitation if you breach these Terms.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">12. Indemnification</h3>
          <p>
            You agree to defend, indemnify, and hold harmless the Developer and its affiliates, licensors,
            and service providers from and against any claims, liabilities, damages, judgments, awards, losses,
            costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to your
            violation of these Terms or your use of the Service.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">13. Governing Law</h3>
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State of California,
            United States, without regard to conflict of law principles. Any legal action or proceeding arising
            under these Terms shall be brought exclusively in the courts located in Santa Clara County, California.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">14. Severability</h3>
          <p>
            If any provision of these Terms is held to be unenforceable or invalid, such provision will be changed
            and interpreted to accomplish the objectives of such provision to the greatest extent possible under
            applicable law, and the remaining provisions will continue in full force and effect.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">15. Entire Agreement</h3>
          <p>
            These Terms, together with the Privacy Policy, constitute the entire agreement between you and the
            Developer regarding the Service and supersede all prior agreements, understandings, and communications,
            whether written or oral.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">16. Contact</h3>
          <p>
            If you have any questions about these Terms, please contact us through the app or our website.
          </p>
        </section>

        <section className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700 mt-6">
          <p className="text-xs text-zinc-300 text-center">
            © {new Date().getFullYear()} Naga Samineni. All Rights Reserved.
          </p>
        </section>

        <div className="pt-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-lg bg-zinc-800 text-zinc-200 text-sm hover:bg-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
