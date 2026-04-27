import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-md">
          <img src="/favicon.svg" alt="Logo" className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Lake Travis High School — Peer Tutor Connect</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-8 space-y-8 text-sm leading-relaxed text-foreground">
        <p className="text-muted-foreground">
          <strong>Last updated: April 21, 2026</strong>
          <br />
          Please read these Terms of Service carefully before using Peer Tutor Connect. By creating
          an account and completing onboarding, you agree to be bound by these terms.
        </p>

        {/* Section 1 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Peer Tutor Connect ("the App," "the Service," or "the Platform"),
            you agree to these Terms of Service ("Terms") and any future updates to them. If you do
            not agree to these Terms, you may not access or use the App. These Terms apply to all
            users of the platform, including students seeking tutoring and students serving as tutors.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">2. Eligibility</h2>
          <p>
            Peer Tutor Connect is exclusively for currently enrolled students at Lake Travis High
            School (LTHS) in Lakeway, Texas. You may register using any valid email address. By
            creating an account, you represent and warrant that:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You are a currently enrolled student at Lake Travis High School.</li>
            <li>You are at least 13 years of age.</li>
            <li>
              You have the authority to enter into these Terms and your use does not violate any
              applicable law or regulation.
            </li>
          </ul>
          <p className="mt-2">
            Accounts found to be created by non-LTHS students may be suspended or permanently
            removed at any time.
          </p>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">3. User Accounts</h2>
          <p className="mb-2">
            You are responsible for your account and all activity that occurs under it. Specifically:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              You must provide accurate, current, and complete information during registration and
              keep it up to date, including your real name and current grade.
            </li>
            <li>
              You are responsible for maintaining the confidentiality of your login credentials and
              for restricting access to your account.
            </li>
            <li>You may not share your account or allow any other person to use it.</li>
            <li>
              You must notify an LTHS administrator immediately if you become aware of any
              unauthorized use of your account or any other breach of security.
            </li>
            <li>
              We reserve the right to suspend or terminate any account that violates these Terms
              or that we reasonably believe poses a risk to the platform or its users.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">4. Acceptable Use</h2>
          <p className="mb-2">
            You agree to use Peer Tutor Connect only for its intended purpose: connecting LTHS
            students for free academic peer tutoring. You agree <strong>not</strong> to:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Harass, bully, threaten, intimidate, or demean any other user in any way.</li>
            <li>
              Submit false, misleading, or fraudulent information, including fake subject credentials,
              fabricated reviews, or inaccurate session records.
            </li>
            <li>
              Use the App for any commercial purpose, to advertise services, or to solicit money or
              compensation from other students.
            </li>
            <li>
              Attempt to access, probe, or interfere with any part of the platform without
              authorization, including other users' accounts, the database, or server infrastructure.
            </li>
            <li>
              Upload, transmit, or distribute any content that is harmful, obscene, defamatory,
              discriminatory, or otherwise inappropriate.
            </li>
            <li>Impersonate another student, tutor, or LTHS staff member.</li>
            <li>
              Use automated scripts, bots, scrapers, or similar tools to interact with the platform.
            </li>
            <li>
              Take any action that places an unreasonable or disproportionately large load on the
              platform's infrastructure.
            </li>
          </ul>
          <p className="mt-2">
            Violations of this section may result in immediate account suspension and referral to
            LTHS administration. We reserve the right to remove any content and suspend any account
            at our sole discretion.
          </p>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">5. Tutoring Sessions</h2>
          <ul className="mt-1 list-disc space-y-2 pl-5">
            <li>
              <strong>Attendance:</strong> Both parties are expected to attend scheduled sessions on
              time and prepared. Repeated no-shows or last-minute cancellations without valid cause
              may result in account restrictions.
            </li>
            <li>
              <strong>Cancellations:</strong> Sessions may only be cancelled through the App more
              than 2 hours before the scheduled start time. Last-minute cancellations are not
              permitted through the platform. If an emergency arises, contact the other party
              directly and notify an administrator.
            </li>
            <li>
              <strong>Session Confirmation:</strong> After a session concludes, both the tutor and
              the student must confirm it through the App using the provided confirmation code.
              Volunteer hours are only credited once both parties have confirmed. Confirmation codes
              expire 72 hours after the session.
            </li>
            <li>
              <strong>Honesty:</strong> Confirming a session that did not actually take place, or
              misrepresenting the duration or nature of a session, is a violation of these Terms and
              constitutes academic dishonesty. Such conduct may be reported to LTHS administration.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">6. Tutor Responsibilities</h2>
          <ul className="mt-1 list-disc space-y-2 pl-5">
            <li>
              Tutors must accurately represent their subject knowledge and academic qualifications
              when applying for tutor status. Submitting false, exaggerated, or unverifiable
              credentials is a violation of these Terms.
            </li>
            <li>
              Tutors must provide genuine, good-faith academic assistance and maintain a
              respectful and professional relationship with every student they work with.
            </li>
            <li>
              Tutor applications are reviewed and approved by authorized LTHS staff. Tutor status
              may be revoked at any time for cause, including but not limited to conduct violations,
              false credentials, or sustained poor reviews.
            </li>
            <li>
              Tutors may not charge students money or any other form of compensation for sessions
              arranged through this platform.
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">7. Reviews &amp; Ratings</h2>
          <ul className="mt-1 list-disc space-y-2 pl-5">
            <li>
              Only students who have completed a fully confirmed session with a tutor — where both
              parties have confirmed — are eligible to leave a review for that tutor.
            </li>
            <li>
              Reviews must be honest, respectful, and based solely on your actual experience with
              that tutor. Reviews are not a place for personal grievances unrelated to tutoring.
            </li>
            <li>
              You may submit one review per tutor. You may delete and re-submit your review at any
              time, provided you remain eligible.
            </li>
            <li>
              Reviews containing harassment, threats, discriminatory language, false statements, or
              content unrelated to the tutoring experience may be removed by administrators without
              prior notice.
            </li>
          </ul>
        </section>

        {/* Section 8 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">8. Privacy &amp; Data</h2>
          <p className="mb-2">
            By using Peer Tutor Connect, you consent to the collection, storage, and use of the
            following information to operate the platform:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your name, email address, and grade level.</li>
            <li>Your optional bio and profile photo.</li>
            <li>
              Session history, including subjects tutored, dates, durations, and confirmation
              status.
            </li>
            <li>Volunteer hour logs used for school recognition and record-keeping.</li>
            <li>Messages sent through the in-app messaging system.</li>
            <li>Your acceptance of these Terms and the date of acceptance.</li>
          </ul>
          <p className="mt-2">
            Your information is used solely to operate the peer tutoring platform. It is not sold
            or shared with third parties outside of authorized LTHS administration. Volunteer hour
            data may be exported by authorized school staff for record-keeping purposes. You may
            request deletion of your account and associated data by contacting an LTHS administrator.
          </p>
        </section>

        {/* Section 9 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">9. Intellectual Property</h2>
          <p>
            All content, design, code, and materials that make up Peer Tutor Connect — excluding
            content submitted by users — are the property of the platform's developers and are
            protected by applicable intellectual property laws. You are granted a limited,
            non-exclusive, non-transferable license to use the App solely for its intended purpose.
            You may not copy, modify, distribute, reverse-engineer, or create derivative works from
            any part of the platform without prior written consent.
          </p>
          <p className="mt-2">
            By submitting content to the platform (such as a bio, review, or message), you grant
            Peer Tutor Connect a non-exclusive, royalty-free license to store and display that
            content solely for the purpose of operating the service.
          </p>
        </section>

        {/* Section 10 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">10. Disclaimer of Warranties</h2>
          <p>
            Peer Tutor Connect is provided <strong>"as is"</strong> and <strong>"as available"</strong>{" "}
            without warranties of any kind, either express or implied, including but not limited to
            implied warranties of merchantability, fitness for a particular purpose, or
            non-infringement. We do not guarantee that the App will be uninterrupted, error-free,
            or free of harmful components. We do not guarantee any particular academic outcome,
            grade improvement, or test score as a result of using the service.
          </p>
        </section>

        {/* Section 11 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">11. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by applicable law, LTHS, the platform operators, and
            its developers shall not be liable for any indirect, incidental, special, consequential,
            or punitive damages — including loss of data, loss of goodwill, or service interruption
            — arising out of or related to your use of or inability to use the App, even if advised
            of the possibility of such damages. Our total liability to you for any claims arising
            under these Terms shall not exceed the amount you have paid to use the service, which
            in all cases is zero.
          </p>
        </section>

        {/* Section 12 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">12. Changes to These Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. When changes are made, the
            "Last updated" date at the top of this page will be revised. If we make material
            changes, we will make reasonable efforts to notify users through the App. Your continued
            use of the App after any changes constitutes your acceptance of the revised Terms. If
            you do not agree to the updated Terms, you must stop using the App.
          </p>
        </section>

        {/* Section 13 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">13. Governing Law</h2>
          <p>
            These Terms are governed by and construed in accordance with the laws of the State of
            Texas, without regard to its conflict of law provisions. Any disputes arising under
            these Terms shall be subject to the exclusive jurisdiction of the courts located in
            Travis County, Texas.
          </p>
        </section>

        {/* Section 14 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">14. Contact</h2>
          <p>
            If you have questions about these Terms, need to report a violation, or wish to request
            deletion of your data, please contact an LTHS administrator or your school counselor.
            You may also use the feedback feature within the App.
          </p>
        </section>

        <div className="border-t pt-4 text-center text-xs text-muted-foreground">
          Lake Travis High School — Peer Tutor Connect ·{" "}
          <Link to="/" className="text-primary underline underline-offset-2">
            Return to app
          </Link>
        </div>
      </div>
    </div>
  );
}
