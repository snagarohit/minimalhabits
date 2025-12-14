import { ResponsiveDialog } from './ResponsiveDialog'

interface PrivacyPolicyProps {
  isOpen: boolean
  onClose: () => void
}

export function PrivacyPolicy({ isOpen, onClose }: PrivacyPolicyProps) {
  return (
    <ResponsiveDialog isOpen={isOpen} onClose={onClose} title="Privacy Policy">
      <div className="px-4 py-4 space-y-4 text-sm text-zinc-400">
        <p className="text-xs text-zinc-500">Last updated: December 2024</p>

        <section className="bg-zinc-800/50 rounded-lg p-3 border border-zinc-700">
          <p className="text-xs text-zinc-300">
            <strong>IMPORTANT:</strong> We reserve the right to modify this Privacy Policy at any time without prior
            notice. Your continued use of the Service following any modifications constitutes your acceptance of the
            revised policy. It is your responsibility to review this Privacy Policy periodically to stay informed of
            any changes. By using the Service, you acknowledge that you have read, understood, and agree to be bound
            by this Privacy Policy.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Overview</h3>
          <p>
            Minimal Habits is designed with privacy in mind. We believe your personal data should stay personal.
            This policy explains what data we collect and how we handle it.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Data We Collect</h3>

          <h4 className="text-sm font-medium text-zinc-300 mt-3 mb-1">Local Data (Default)</h4>
          <p>
            By default, all your habit data is stored locally on your device using browser storage (localStorage).
            This data never leaves your device unless you enable cloud backup.
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Habit names and configurations</li>
            <li>Daily completion records</li>
            <li>Groups and visibility preferences</li>
            <li>App settings (view mode preferences)</li>
          </ul>

          <h4 className="text-sm font-medium text-zinc-300 mt-3 mb-1">With Google Sign-In (Optional)</h4>
          <p>
            If you choose to enable cloud backup, we access limited Google account information:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Your email address (for display purposes)</li>
            <li>Your name (for display purposes)</li>
            <li>Google Drive app data folder (to store your habit data)</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">How We Use Your Data</h3>
          <ul className="list-disc list-inside space-y-1 text-zinc-500">
            <li>To provide the habit tracking functionality</li>
            <li>To sync your data across devices (if cloud backup is enabled)</li>
            <li>To restore your data if you clear your browser or switch devices</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Data Storage</h3>

          <h4 className="text-sm font-medium text-zinc-300 mt-3 mb-1">Local Storage</h4>
          <p>
            Data stored locally remains on your device until you clear your browser data or uninstall the app.
          </p>

          <h4 className="text-sm font-medium text-zinc-300 mt-3 mb-1">Google Drive Storage</h4>
          <p>
            When cloud backup is enabled, your data is stored in your personal Google Drive account in the
            "app data" folder. This is a special folder that:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Is only accessible by this app (not visible in Drive file browser)</li>
            <li>Is encrypted in transit using HTTPS</li>
            <li>Is protected by Google's security infrastructure</li>
            <li>Is automatically deleted if you revoke the app's access</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Data We Don't Collect</h3>
          <p>We do NOT:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Track your usage with analytics</li>
            <li>Store your data on our servers</li>
            <li>Share your data with third parties</li>
            <li>Use your data for advertising</li>
            <li>Access any other files in your Google Drive</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Third-Party Services</h3>
          <p>
            The only third-party service used is Google Sign-In and Google Drive API (optional).
            Google's use of your data is governed by the{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-300 underline hover:text-zinc-100"
            >
              Google Privacy Policy
            </a>.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Your Rights</h3>
          <p>You have the right to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Use the app without signing in (fully local mode)</li>
            <li>Delete your local data by clearing browser storage</li>
            <li>Disconnect Google account and delete cloud backup at any time</li>
            <li>Revoke app access through your Google account settings</li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Data Deletion</h3>
          <p>To delete your data:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li><strong className="text-zinc-300">Local data:</strong> Clear your browser's site data for this site</li>
            <li><strong className="text-zinc-300">Cloud data:</strong> Sign out from the app, then revoke access at{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-300 underline hover:text-zinc-100"
              >
                Google Account Permissions
              </a>
            </li>
          </ul>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Children's Privacy</h3>
          <p>
            This Service is not intended for children under 13 years of age. We do not knowingly collect
            personal information from children.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Changes to This Policy</h3>
          <p>
            We reserve the right to modify this Privacy Policy at any time, at our sole discretion. Any changes
            will be effective immediately upon posting the revised policy. We will indicate the date of the last
            revision at the top of this page. Your continued use of the Service after any changes to this Privacy
            Policy constitutes your acceptance of such changes. It is your responsibility to review this Privacy
            Policy periodically to stay informed of any updates.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Disclaimer</h3>
          <p>
            THE SERVICE AND ALL INFORMATION, CONTENT, AND MATERIALS AVAILABLE THROUGH THE SERVICE ARE PROVIDED
            "AS IS" AND ON AN "AS AVAILABLE" BASIS. WE DISCLAIM ALL WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
            IMPLIED, WITH RESPECT TO THE SECURITY OF ANY DATA OR INFORMATION PROVIDED OR COLLECTED.
          </p>
        </section>

        <section>
          <h3 className="text-base font-medium text-zinc-200 mb-2">Contact</h3>
          <p>
            If you have any questions about this Privacy Policy, please contact us through the app or our website.
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
