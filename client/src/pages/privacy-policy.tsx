export function PrivacyPolicy() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
          <p className="text-muted-foreground mt-2">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>

        <div className="prose dark:prose-invert max-w-none">
          <h2>1. Information We Collect</h2>
          <p>
            At NursePrep Analytics, we collect information that you provide directly to us, such as when you create an account, 
            upload assessment reports, or contact us for support.
          </p>

          <h3>Personal Information:</h3>
          <ul>
            <li>Name and email address</li>
            <li>Educational information (school, graduation date)</li>
            <li>Assessment reports and performance data</li>
            <li>Study progress and preferences</li>
          </ul>

          <h3>Usage Information:</h3>
          <ul>
            <li>How you interact with our platform</li>
            <li>Study session data and progress metrics</li>
            <li>Device and browser information</li>
            <li>IP address and location data</li>
          </ul>

          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Provide personalized study recommendations</li>
            <li>Track your learning progress and identify knowledge gaps</li>
            <li>Generate customized study guides and materials</li>
            <li>Improve our platform and develop new features</li>
            <li>Send you important updates and educational content (with your consent)</li>
          </ul>

          <h2>3. Information Sharing</h2>
          <p>
            We do not sell your personal information. We may share information in the following circumstances:
          </p>
          <ul>
            <li>With your explicit consent</li>
            <li>For legal compliance or to protect our rights</li>
            <li>With service providers who assist in platform operations</li>
            <li>In anonymized form for research and platform improvement</li>
          </ul>

          <h2>4. Data Security</h2>
          <p>
            We implement appropriate security measures to protect your personal information against unauthorized access, 
            alteration, disclosure, or destruction. This includes encryption, secure data storage, and regular security audits.
          </p>

          <h2>5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access and review your personal information</li>
            <li>Request corrections to inaccurate data</li>
            <li>Delete your account and associated data</li>
            <li>Export your data in a portable format</li>
            <li>Opt out of marketing communications</li>
            <li>Withdraw consent for data processing</li>
          </ul>

          <h2>6. Cookies and Tracking</h2>
          <p>
            We use cookies and similar technologies to enhance your experience, analyze usage patterns, 
            and provide personalized content. You can manage your cookie preferences through our privacy settings.
          </p>

          <h2>7. Data Retention</h2>
          <p>
            We retain your personal information for as long as necessary to provide our services and comply with legal obligations. 
            Assessment data and study progress are kept to maintain continuity of your educational experience.
          </p>

          <h2>8. International Data Transfers</h2>
          <p>
            Your information may be processed in countries other than your residence. We ensure appropriate safeguards 
            are in place to protect your data according to applicable privacy laws.
          </p>

          <h2>9. Changes to This Policy</h2>
          <p>
            We may update this privacy policy to reflect changes in our practices or applicable law. 
            We will notify you of material changes via email or platform notification.
          </p>

          <h2>10. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or our data practices, please contact us at:
          </p>
          <ul>
            <li>Email: privacy@nurseprep.com</li>
            <li>Address: 123 Education Lane, Learning City, LC 12345</li>
          </ul>
        </div>

        <div className="flex gap-4 text-sm">
          <a href="/privacy-settings" className="text-blue-600 hover:underline">
            Manage Privacy Settings
          </a>
          <a href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </a>
          <a href="/cookie-policy" className="text-blue-600 hover:underline">
            Cookie Policy
          </a>
        </div>
      </div>
    </div>
  );
}