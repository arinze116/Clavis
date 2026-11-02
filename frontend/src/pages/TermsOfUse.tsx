import { LegalPage, type LegalSection } from "../components/LegalPage";

const sections: LegalSection[] = [
  {
    title: "Hackathon project",
    content: <p>Clavis is a hackathon project deployed on NEAR testnet for demonstration and evaluation.</p>,
  },
  {
    title: "Testnet only",
    content: <p>No real funds are at risk. The current deployment uses testnet assets with no monetary value.</p>,
  },
  {
    title: "No warranties",
    content: <p>The software is provided without warranties, expressed or implied, including warranties of merchantability or fitness for a particular purpose.</p>,
  },
  {
    title: "Open source",
    content: <p>Clavis is open-source software made available under the MIT License.</p>,
  },
  {
    title: "Use at your own risk",
    content: <p>You are responsible for evaluating the software and accept all risk arising from its use.</p>,
  },
];

export default function TermsOfUse() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Use"
      intro="These terms apply to the Clavis testnet application and its open-source code."
      sections={sections}
    />
  );
}
