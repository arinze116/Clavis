import { LegalPage, type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "What Clavis collects",
    content: (
      <p>
        Clavis does not operate user accounts, analytics profiles, or an advertising
        database. The browser stores your selected contract and worker preferences locally
        on your device so the interface can restore them.
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
