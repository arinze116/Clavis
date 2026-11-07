import { BrainCircuit, Check, LoaderCircle, Route } from "lucide-react";
import { useId, useState } from "react";

import type { Chain, RecipientDraft, Token } from "../types";
import { optimizeRoute, type AiRouteResult } from "../utils/nearAi";

interface RecipientFormFieldsProps {
  value: RecipientDraft;
  onChange: (value: RecipientDraft) => void;
  disabled?: boolean;
  idPrefix?: string;
}

const routeByChain: Record<Chain, Token> = {
  near: "NEAR",
  ethereum: "USDC",
  bnb: "BUSD",
};

const chainByToken: Record<Token, Chain> = {
  NEAR: "near",
  USDC: "ethereum",
  BUSD: "bnb",
};

export function isSupportedRecipientRoute(value: RecipientDraft): boolean {
  return routeByChain[value.preferredChain] === value.preferredToken;
}

export function RecipientFormFields({
  value,
  onChange,
  disabled = false,
  idPrefix,
}: RecipientFormFieldsProps) {
  const generatedId = useId().replaceAll(":", "");
  const prefix = idPrefix ?? `recipient-${generatedId}`;
  const [recommendation, setRecommendation] = useState<AiRouteResult | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  function update<K extends keyof RecipientDraft>(key: K, next: RecipientDraft[K]) {
    onChange({ ...value, [key]: next });
  }

  function updateChain(chain: Chain) {
    onChange({
      ...value,
      preferredChain: chain,
      preferredToken: routeByChain[chain],
      destinationAddress: chain === "near" ? "" : value.destinationAddress,
    });
    setRecommendation(null);
    setRouteError(null);
  }

  function updateToken(token: Token) {
    onChange({
      ...value,
      preferredChain: chainByToken[token],
      preferredToken: token,
    });
    setRecommendation(null);
    setRouteError(null);
  }

  function updateRegion(region: string) {
    onChange({ ...value, region });
    setRecommendation(null);
    setRouteError(null);
  }

  function updateWalletAddress(walletAddress: string) {
    onChange({ ...value, walletAddress });
  }

  async function suggestRoute() {
    setRouteBusy(true);
    setRouteError(null);
    try {
      setRecommendation(
        await optimizeRoute({
          selectedChain: value.preferredChain,
          selectedToken: value.preferredToken,
          region: value.region,
        }),
      );
    } catch (reason) {
      setRouteError(reason instanceof Error ? reason.message : "Unable to recommend a route");
    } finally {
      setRouteBusy(false);
    }
  }

  function acceptRecommendation() {
    if (!recommendation) return;
    onChange({
      ...value,
      preferredChain: recommendation.chain,
      preferredToken: recommendation.token,
    });
  }

  const recommendationAccepted =
    recommendation?.chain === value.preferredChain &&
    recommendation.token === value.preferredToken;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-name`}>
          Display name
          <input
            id={`${prefix}-name`}
            className="field mt-2"
            value={value.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Sarah Okafor"
            autoComplete="name"
            disabled={disabled}
            required
          />
        </label>
        <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-wallet`}>
          NEAR testnet wallet
          <input
            id={`${prefix}-wallet`}
            className="field mt-2 font-mono text-xs"
            value={value.walletAddress}
            onChange={(event) => updateWalletAddress(event.target.value)}
            placeholder="sarah.testnet"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={disabled}
            required
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-region`}>
          Recipient region <span className="font-normal text-ink/35">(optional)</span>
          <input
            id={`${prefix}-region`}
            className="field mt-2"
            value={value.region ?? ""}
            onChange={(event) => updateRegion(event.target.value)}
            placeholder="West Africa"
            autoComplete="country-name"
            disabled={disabled}
          />
        </label>
        <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-cap`}>
          Personal cap (NEAR)
          <input
            id={`${prefix}-cap`}
            className="field mt-2"
            value={value.personalCapNear}
            onChange={(event) => update("personalCapNear", event.target.value)}
            placeholder="500"
            inputMode="decimal"
            disabled={disabled}
            required
          />
        </label>
        <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-amount`}>
          Scheduled payment (NEAR)
          <input
            id={`${prefix}-amount`}
            className="field mt-2"
            value={value.paymentAmountNear}
            onChange={(event) => update("paymentAmountNear", event.target.value)}
            placeholder="4"
            inputMode="decimal"
            disabled={disabled}
            required
          />
        </label>
      </div>

      <fieldset className="rounded-2xl border border-line bg-canvas/45 p-4" disabled={disabled}>
        <legend className="px-1 text-xs font-semibold text-ink/55">Destination route</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-chain`}>
            Chain
            <select
              id={`${prefix}-chain`}
              className="field mt-2"
              value={value.preferredChain}
              onChange={(event) => updateChain(event.target.value as Chain)}
            >
              <option value="near">NEAR</option>
              <option value="ethereum">Ethereum</option>
              <option value="bnb">BNB Chain</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-token`}>
            Token
            <select
              id={`${prefix}-token`}
              className="field mt-2"
              value={value.preferredToken}
              onChange={(event) => updateToken(event.target.value as Token)}
            >
              <option value="NEAR">NEAR</option>
              <option value="USDC">USDC</option>
              <option value="BUSD">BUSD</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-ink/55" htmlFor={`${prefix}-schedule`}>
            Schedule
            <select
              id={`${prefix}-schedule`}
              className="field mt-2"
              value={value.schedule}
              onChange={(event) =>
                update("schedule", event.target.value as RecipientDraft["schedule"])
              }
            >
              <option value="Weekly">Weekly</option>
              <option value="Biweekly">Biweekly</option>
              <option value="Milestone">Milestone</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          className="button-secondary mt-4 w-full sm:w-auto"
          onClick={() => void suggestRoute()}
          disabled={disabled || routeBusy}
        >
          {routeBusy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          )}
          {routeBusy ? "Checking supported routes" : "Check supported route"}
        </button>

        {value.preferredChain === "near" ? (
          <p className="mt-3 text-xs leading-5 text-ink/45">
            Native NEAR settles to the worker testnet wallet entered above.
          </p>
        ) : (
          <label
            className="mt-4 block text-xs font-semibold text-ink/55"
            htmlFor={`${prefix}-destination`}
          >
            {value.preferredChain === "ethereum" ? "Ethereum" : "BNB Chain"} destination
            address
            <input
              id={`${prefix}-destination`}
              className="field mt-2 font-mono text-xs"
              value={value.destinationAddress}
              onChange={(event) => update("destinationAddress", event.target.value)}
              placeholder="0x0000000000000000000000000000000000000000"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={disabled}
              required
            />
            <span className="mt-2 block font-normal leading-5 text-ink/40">
              This private delivery address is stored only by the payroll agent and is never
              written to the public contract.
            </span>
          </label>
        )}

        {routeError && (
          <p className="mt-3 text-xs leading-5 text-red-700" role="alert">
            {routeError}
          </p>
        )}

        {recommendation && (
          <div
            className="mt-4 rounded-xl border border-moss/20 bg-white p-4"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <Route className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  Recommended: {routeLabel(recommendation.chain)} {recommendation.token}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink/55">{recommendation.reason}</p>
                <dl className="mt-3 grid gap-2 text-xs leading-5 text-ink/55">
                  <div>
                    <dt className="font-semibold text-ink">Region note</dt>
                    <dd>{recommendation.region_rationale}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-ink">Live RPC evidence</dt>
                    <dd>{recommendation.gas_comparison}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-emerald-700">
                  {recommendation.evidence.source} · {new Date(recommendation.observed_at).toLocaleString()}
                </p>
                <p className="mt-2 text-[11px] text-ink/40">
                  {recommendation.confidence === "high"
                    ? "High"
                    : recommendation.confidence === "low"
                      ? "Low"
                      : "Medium"} confidence · recommendation selected only from code-supported routes — {recommendation.modelLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="button-secondary mt-3 w-full sm:w-auto"
              onClick={acceptRecommendation}
              disabled={recommendationAccepted}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {recommendationAccepted ? "Recommendation selected" : "Use this route"}
            </button>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function routeLabel(chain: Chain): string {
  return chain === "near" ? "NEAR native" : chain === "ethereum" ? "Ethereum" : "BNB Chain";
}
