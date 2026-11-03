import { LegalPage, type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Testnet only",
    content: (
      <p>
        Clavis currently runs only on NEAR testnet. Testnet assets have no monetary value
        and must not be represented as real funds.
      </p>
    ),
  },
  {
    title: "MIT License",
    content: (
      <p>
        The Clavis source code is provided under the MIT License. The license notice and
        copyright terms remain part of every substantial copy.
      </p>
    ),
  },
  {
    title: "No warranties",
    content: (
      <p>
        The software is provided “as is,” without warranties of any kind, express or
        implied, including merchantability, fitness for a particular purpose, and
        non-infringement.
      </p>
    ),
  },
  {
    title: "Use at your own risk",
    content: (
      <p>
        You are responsible for validating wallet addresses, policy limits, notification
        recipients, and testnet transactions. Clavis is not financial, legal, or tax advice.
      </p>
    ),
  },
];

export default function TermsOfUse() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      intro="These terms apply to the Clavis testnet application, contracts, agent, and open-source code."
      sections={sections}
    />
  );
}
