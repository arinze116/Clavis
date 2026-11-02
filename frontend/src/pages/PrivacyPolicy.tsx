import { LegalPage, type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "What data Clavis collects",
    content: <p>None. Clavis does not create user accounts, and the frontend does not store personal data.</p>,
  },
  {
    title: "What the smart contract stores",
    content: <p>The contract stores only hashed recipient commitments and public audit decisions. It does not store payroll amounts, names, or wallet addresses.</p>,
  },
  {
    title: "Third-party services",
    content: <p>Clavis uses the NEAR testnet RPC through FastNEAR to read and submit blockchain data, and Vercel to host the frontend.</p>,
  },
  {
    title: "Contact",
    content: (
      <p>
        Questions or concerns can be submitted through the{" "}
        <a className="font-semibold text-moss underline underline-offset-4" href="https://github.com/arinze116/Clavis/issues" target="_blank" rel="noreferrer">
          Clavis GitHub issues
        </a>.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="Clavis is designed to keep payroll information private while making policy decisions publicly verifiable."
      sections={sections}
    />
  );
}
