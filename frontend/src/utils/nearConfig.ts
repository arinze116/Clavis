export interface TestnetConfiguration {
  networkId: string;
  rpcUrl: string;
  rootContractId: string;
  factoryContractId: string;
  explorerUrl: string;
  nearBlocksApiUrl: string;
}

const TESTNET_HOST_PATTERNS = [
  /^test\.rpc\.fastnear\.com$/,
  /(^|\.)testnet\.near\.org$/,
  /^near-testnet\.drpc\.org$/,
  /^testnet\.nearblocks\.io$/,
  /^api-testnet\.nearblocks\.io$/,
];

export function assertTestnetConfiguration(
  configuration: TestnetConfiguration,
  options: { allowLocalhost?: boolean } = {},
): void {
  if (configuration.networkId !== "testnet") {
    throw new Error("Clavis supports NEAR Testnet only");
  }
  assertTestnetAccount(configuration.rootContractId, "root contract");
  assertTestnetAccount(configuration.factoryContractId, "factory contract");
  assertTestnetUrl(configuration.rpcUrl, "RPC", options.allowLocalhost === true);
  assertTestnetUrl(configuration.explorerUrl, "explorer", false);
  assertTestnetUrl(configuration.nearBlocksApiUrl, "NearBlocks API", false);
}

function assertTestnetAccount(accountId: string, label: string): void {
  if (!accountId.endsWith(".testnet")) {
    throw new Error(`Clavis ${label} must be a NEAR Testnet account`);
  }
}

function assertTestnetUrl(value: string, label: string, allowLocalhost: boolean): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Clavis ${label} URL is invalid`);
  }
  const host = url.hostname.toLowerCase();
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const identifiesTestnet = TESTNET_HOST_PATTERNS.some((pattern) => pattern.test(host));
  if (url.protocol !== "https:" && !(allowLocalhost && isLocalhost)) {
    throw new Error(`Clavis ${label} URL must use HTTPS`);
  }
  if (!identifiesTestnet && !(allowLocalhost && isLocalhost)) {
    throw new Error(`Clavis ${label} URL must identify a Testnet endpoint`);
  }
}
