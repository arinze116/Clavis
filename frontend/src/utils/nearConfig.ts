export interface TestnetConfiguration {
  networkId: string;
  rpcUrl: string;
  rootContractId: string;
  factoryContractId: string;
  explorerUrl: string;
  nearBlocksApiUrl: string;
}

const TESTNET_RPC_HOST_PATTERNS = [
  /^test\.rpc\.fastnear\.com$/,
  /^rpc\.testnet\.fastnear\.com$/,
  /^archival-rpc\.testnet\.near\.org$/,
  /^near-testnet\.drpc\.org$/,
  /^testnet-rpc\.intea\.rs$/,
];

const TESTNET_EXPLORER_HOST_PATTERNS = [/^testnet\.nearblocks\.io$/];
const TESTNET_INDEXER_HOST_PATTERNS = [/^api-testnet\.nearblocks\.io$/];

export function assertTestnetConfiguration(
  configuration: TestnetConfiguration,
  options: { allowLocalhost?: boolean } = {},
): void {
  if (configuration.networkId !== "testnet") {
    throw new Error("Clavis supports NEAR Testnet only");
  }
  assertTestnetAccount(configuration.rootContractId, "root contract");
  assertTestnetAccount(configuration.factoryContractId, "factory contract");
  assertTestnetUrl(
    configuration.rpcUrl,
    "RPC",
    TESTNET_RPC_HOST_PATTERNS,
    options.allowLocalhost === true,
  );
  assertTestnetUrl(
    configuration.explorerUrl,
    "explorer",
    TESTNET_EXPLORER_HOST_PATTERNS,
    false,
  );
  assertTestnetUrl(
    configuration.nearBlocksApiUrl,
    "NearBlocks API",
    TESTNET_INDEXER_HOST_PATTERNS,
    false,
  );
}

export function isTestnetRpcUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      TESTNET_RPC_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname.toLowerCase()))
    );
  } catch {
    return false;
  }
}

function assertTestnetAccount(accountId: string, label: string): void {
  if (!accountId.endsWith(".testnet")) {
    throw new Error(`Clavis ${label} must be a NEAR Testnet account`);
  }
}

function assertTestnetUrl(
  value: string,
  label: string,
  hostPatterns: readonly RegExp[],
  allowLocalhost: boolean,
): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Clavis ${label} URL is invalid`);
  }
  const host = url.hostname.toLowerCase();
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "::1";
  const identifiesTestnet = hostPatterns.some((pattern) => pattern.test(host));
  if (url.protocol !== "https:" && !(allowLocalhost && isLocalhost)) {
    throw new Error(`Clavis ${label} URL must use HTTPS`);
  }
  if (!identifiesTestnet && !(allowLocalhost && isLocalhost)) {
    throw new Error(`Clavis ${label} URL must identify a Testnet endpoint`);
  }
}
