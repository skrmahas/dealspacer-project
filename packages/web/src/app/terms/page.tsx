export default function TermsPage() {
  return (
    <main style={{ minHeight: "100vh", padding: "48px 20px", background: "#f7fbff", color: "#21324a", fontFamily: "system-ui, sans-serif" }}>
      <article style={{ maxWidth: 760, margin: "0 auto", background: "#ffffff", border: "1px solid #d7e2f2", borderRadius: 16, padding: 28 }}>
        <a href="/" style={{ color: "#365d9c", fontWeight: 700, textDecoration: "none" }}>Back to DealSpacer</a>
        <h1 style={{ margin: "24px 0 0", color: "#0f2e52" }}>Terms of Service</h1>
        <p style={{ color: "#5f6f83", lineHeight: 1.6 }}>
          DealSpacer is offered as a private-preview financial document workflow tool. Generated reports are AI-assisted summaries and may contain errors or omissions.
        </p>
        <p style={{ color: "#5f6f83", lineHeight: 1.6 }}>
          Reports do not constitute financial advice, investment recommendations, or an offer to buy or sell securities. Users are responsible for verifying figures against original source filings.
        </p>
        <p style={{ color: "#5f6f83", lineHeight: 1.6 }}>
          For service questions, contact <a href="mailto:hello@dealspacer.com" style={{ color: "#365d9c" }}>hello@dealspacer.com</a>.
        </p>
      </article>
    </main>
  );
}
