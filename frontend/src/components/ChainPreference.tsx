import { Save } from "lucide-react";
import { useEffect, useState } from "react";

import type { Chain, Recipient, Token } from "../types";

export function ChainPreference({ recipient }: { recipient: Recipient }) {
  const [chain, setChain] = useState<Chain>(recipient.preferred_chain);
  const [token, setToken] = useState<Token>(recipient.preferred_token);

  useEffect(() => {
    setChain(recipient.preferred_chain);
    setToken(recipient.preferred_token);
  }, [recipient]);

  function updateChain(value: Chain) {
    setChain(value);
    setToken(value === "near" ? "NEAR" : value === "ethereum" ? "USDC" : "BUSD");
  }

  return (
    <section className="panel p-6 lg:p-8">
      <p className="eyebrow">Delivery preference</p>
      <h2 className="mt-2 font-display text-2xl font-semibold">Where you get paid</h2>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-ink/50">Chain<select className="field mt-2" value={chain} onChange={(event) => updateChain(event.target.value as Chain)}><option value="near">NEAR</option><option value="ethereum" disabled>Ethereum — execution disabled</option><option value="bnb" disabled>BNB Chain — execution disabled</option></select></label>
        <label className="text-xs font-semibold text-ink/50">Token<select className="field mt-2" value={token} disabled><option>{token}</option></select></label>
      </div>
      <button type="button" className="button-primary mt-4 w-full" disabled title="Route changes require owner approval in this security model"><Save className="h-4 w-4" /> Request route update</button>
      <p className="mt-3 text-xs leading-5 text-ink/40">Only native NEAR can execute in this release. Route updates are owner-signed and trigger an anomaly review before the next authorization request.</p>
    </section>
  );
}
