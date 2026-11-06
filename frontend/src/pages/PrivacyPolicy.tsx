import { LegalPage, type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "What Clavis collects",
    content: (
      <p>
        Clavis does not operate analytics profiles or an advertising database. The private
        VPS agent stores the scheduled amount, worker NEAR address, and destination address
        that an owner authorizes for automated delivery. These values are encrypted in
        transit, permission-restricted on the server, and never returned by the public
        contract API. If you opt into notifications, Clavis also stores the email address you
        verify and/or the Telegram chat ID connected through the bot. The browser stores your
        selected contract, short-lived service sessions, and worker preferences locally so
        the interface can restore them.
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
        recipient wallet addresses or payment amounts in the public audit entries. This is
        privacy minimization, not transaction confidentiality: standard NEAR function-call
        arguments, signer accounts, timestamps, and other chain metadata remain public.
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
