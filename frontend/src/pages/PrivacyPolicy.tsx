import { LegalPage, type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "What Clavis collects",
    content: (
      <p>
        Clavis does not operate user accounts, analytics profiles, or an advertising
        database. If you opt into notifications, Clavis stores the email address you verify
        and/or the Telegram chat ID connected through the bot in the private VPS agent data
        store. The browser also stores your selected contract, notification session, and
        worker preferences locally on your device so the interface can restore them.
        Notification contact details are never written to the NEAR blockchain and are
        removed from the private store when you unlink notifications. Verification and
        pairing secrets expire quickly; the server stores only one-way hashes, while the
        browser temporarily keeps the active Telegram connection link in session storage.
      </p>
    ),
  },
  {
    title: "What the smart contract stores",
    content: (
      <p>
        The contract stores hashed recipient wallet commitments, owner-approved policy
        configuration, display labels, and public audit decisions. It does not place raw
        recipient wallet addresses or payment amounts in the public audit entries.
      </p>
    ),
  },
  {
    title: "Third-party services",
    content: (
      <p>
        FastNEAR provides testnet RPC access, NearBlocks resolves explorer transaction
        links, Vercel hosts the interface, Resend delivers owner email notifications, and
        Telegram delivers bot notifications. Their own privacy terms apply when those
        services are configured.
      </p>
    ),
  },
  {
    title: "Contact",
    content: (
      <p>
        Questions can be submitted through the{" "}
        <a
          className="font-semibold text-moss underline underline-offset-4"
          href="https://github.com/arinze116/Clavis/issues"
          target="_blank"
          rel="noreferrer"
        >
          Clavis GitHub issues
        </a>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="Clavis minimizes application data while keeping testnet policy decisions independently verifiable."
      sections={sections}
    />
  );
}
