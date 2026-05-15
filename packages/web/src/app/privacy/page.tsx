export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "48px 20px", background: "#f7fbff", color: "#21324a", fontFamily: "system-ui, sans-serif" }}>
      <article style={{ maxWidth: 760, margin: "0 auto", background: "#ffffff", border: "1px solid #d7e2f2", borderRadius: 16, padding: 28 }}>
        <a href="/" style={{ color: "#365d9c", fontWeight: 700, textDecoration: "none" }}>Back to DealSpacer</a>
        <h1 style={{ margin: "24px 0 0", color: "#0f2e52" }}>Privacy Policy</h1>
        <p style={{ color: "#5f6f83", lineHeight: 1.6 }}>
          DealSpacer is currently in private preview. We collect submitted work emails to manage access requests and product onboarding.
        </p>
        <p style={{ color: "#5f6f83", lineHeight: 1.6 }}>
          Uploaded filings are processed to generate reports for the requesting user. They are not used to train public models. Access to operational data is limited to what is necessary to provide and support the service.
        </p>
        <p style={{ color: "#5f6f83", lineHeight: 1.6 }}>
          For privacy questions or deletion requests, contact us at <a href="mailto:hello@dealspacer.com" style={{ color: "#365d9c" }}>hello@dealspacer.com</a>.
        </p>
      </article>
    </main>
  );
}
