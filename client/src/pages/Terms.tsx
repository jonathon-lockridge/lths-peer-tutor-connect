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
          <strong>Effective date: April 21, 2026</strong>
          <br />
          Please read these Terms of Service carefully before using Peer Tutor Connect. By creating an account and
          completing onboarding, you agree to be bound by these terms.
        </p>

        {/* Section 1 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Peer Tutor Connect ("the App"), you agree to these Terms of Service and any
            future updates to them. If you do not agree, you may not use the App. These terms apply to all users,
            including students and tutors.
          </p>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">2. Eligibility</h2>
          <p>
            Peer Tutor Connect is exclusively for currently enrolled students at Lake Travis High School (LTHS).
            You must register using a valid LTHS school email address (<code className="rounded bg-muted px-1 text-xs">@ltisdschools.org</code>).
            Accounts created with non-school email addresses will not be activated. By using the App, you represent
            that you are an enrolled LTHS student.
          </p>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">3. User Accounts</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You may not share your account or allow others to access it.</li>
            <li>You must provide accurate information — including your real name and grade — during onboarding.</li>
            <li>
              You must notify us immediately of any unauthorized use of your account by contacting a school
              administrator.
            </li>
          </ul>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">4. Acceptable Use</h2>
          <p className="mb-2">You agree to use Peer Tutor Connect only for its intended purpose: connecting LTHS students for academic peer tutoring. You agree <strong>not</strong> to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Harass, bully, or demean other users in any way.</li>
            <li>Submit false or misleading information (e.g., fake credentials or fraudulent reviews).</li>
            <li>Use the App for any commercial purpose or to solicit money from other students.</li>
            <li>Attempt to gain unauthorized access to another user's account or any part of the platform.</li>
            <li>Upload or transmit any harmful, offensive, or inappropriate content.</li>
            <li>Impersonate another student, tutor, or school staff member.</li>
          </ul>
          <p className="mt-2">
            Violations may result in immediate account suspension and referral to LTHS administration.
          </p>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">5. Tutoring Sessions</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <strong>Attendance:</strong> Both students are expected to attend scheduled sessions on time. Repeated
              no-shows may result in account restrictions.
            </li>
            <li>
              <strong>Cancellations:</strong> Sessions may only be cancelled more than 2 hours before the scheduled
              start time. Last-minute cancellations are not permitted through the App.
            </li>
            <li>
              <strong>Session confirmation:</strong> After a session, both the tutor and student must confirm it
              through the App using the provided confirmation code. Volunteer hours are only credited after both
              parties confirm.
            </li>
            <li>
              <strong>Honesty:</strong> Do not confirm sessions that did not actually take place. Falsifying session
              records is a violation of these Terms and may be reported to school administration.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">6. Tutor Responsibilities</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              Tutors must accurately represent their subject knowledge when applying for tutor status. Submitting
              false or exaggerated credentials is a violation of these Terms.
            </li>
            <li>
              Tutors must provide genuine academic help and maintain a respectful, professional relationship with
              their students.
            </li>
            <li>
              Tutor applications are reviewed and approved by LTHS staff. Approval can be revoked at any time for
              cause.
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">7. Reviews &amp; Ratings</h2>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              Only students who have completed a confirmed session with a tutor (both parties confirmed) may leave
              a review for that tutor.
            </li>
            <li>Reviews must be honest and based on your actual experience.</li>
            <li>You may leave one review per tutor. You may delete and re-submit your review at any time.</li>
            <li>
              Reviews that contain harassment, inappropriate language, or false information may be removed by
              administrators.
            </li>
          </ul>
        </section>

        {/* Section 8 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">8. Privacy &amp; Data</h2>
          <p className="mb-2">By using Peer Tutor Connect, you consent to the collection and use of the following information:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your name, school email address, and grade level.</li>
            <li>Your optional bio and profile photo.</li>
            <li>Session history (subjects tutored, dates, durations, confirmation status).</li>
            <li>Volunteer hour logs used for school recognition programs.</li>
            <li>Messages sent through the in-app messaging system.</li>
          </ul>
          <p className="mt-2">
            This information is used solely to operate the peer tutoring platform and is not shared with third
            parties outside of LTHS administration. Volunteer hour data may be exported by authorized school staff
            for record-keeping purposes.
          </p>
        </section>

        {/* Section 9 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">9. Limitation of Liability</h2>
          <p>
            Peer Tutor Connect is a student-run platform designed to connect peers for academic support. It does
            not guarantee any particular academic outcome, grade improvement, or test score as a result of using
            the service. The App is provided "as is" without warranties of any kind. LTHS and the platform
            operators are not liable for any damages arising from your use of the App.
          </p>
        </section>

        {/* Section 10 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">10. Changes to These Terms</h2>
          <p>
            These Terms may be updated from time to time. When changes are made, the effective date at the top of
            this page will be updated. Continued use of the App after changes constitutes acceptance of the revised
            Terms.
          </p>
        </section>

        {/* Section 11 */}
        <section>
          <h2 className="mb-2 text-base font-semibold">11. Contact</h2>
          <p>
            If you have questions about these Terms or need to report a violation, please contact your school
            counselor or an LTHS administrator. You may also use the feedback feature within the App.
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
