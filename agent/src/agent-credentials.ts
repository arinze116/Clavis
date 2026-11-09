import { readFile, stat } from "node:fs/promises";

import { z } from "zod";

const nearAccountPattern = /^(?=.{2,64}$)[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const privateKeyPattern = /^(ed25519|secp256k1):/;

const credentialSchema = z.object({
  contract_id: z.string().trim().regex(nearAccountPattern),
  account_id: z.string().trim().regex(nearAccountPattern),
  private_key: z.string().regex(privateKeyPattern),
});

const credentialFileSchema = z.object({
  version: z.literal(1),
  credentials: z.array(credentialSchema).min(1),
});

export interface AgentCredential {
  accountId: string;
  privateKey: string;
}

interface CredentialFileEntry extends AgentCredential {
  contractId: string;
}

export interface AgentCredentialProviderOptions {
  credentialPath?: string;
  legacyCredential?: AgentCredential;
  legacyContractId?: string;
}

/**
 * Resolves one signing key per payroll contract. A configured credential file is
 * authoritative: missing contracts fail closed instead of reusing another
 * contract's key. The legacy environment pair remains available only when no
 * credential file is configured, preserving single-contract deployments.
 */
export class AgentCredentialProvider {
  readonly #credentials: ReadonlyMap<string, AgentCredential>;
  readonly #legacyCredential: AgentCredential | undefined;
  readonly #legacyContractId: string | undefined;

  private constructor(
    credentials: ReadonlyMap<string, AgentCredential>,
    legacyCredential?: AgentCredential,
    legacyContractId?: string,
  ) {
    this.#credentials = credentials;
    this.#legacyCredential = legacyCredential;
    this.#legacyContractId = legacyContractId;
  }

  static async load(options: AgentCredentialProviderOptions): Promise<AgentCredentialProvider> {
    if (!options.credentialPath) {
      if (!options.legacyCredential) {
        throw new Error(
          "Configure AGENT_CREDENTIALS_PATH or the single-contract NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY pair",
        );
      }
      if (!options.legacyContractId) {
        throw new Error("Legacy agent credentials require LEGACY_AGENT_CONTRACT_ID");
      }
      return new AgentCredentialProvider(
        new Map(),
        options.legacyCredential,
        options.legacyContractId,
      );
    }

    await assertPrivateCredentialFile(options.credentialPath);
    const entries = await readCredentialFile(options.credentialPath);
    return AgentCredentialProvider.fromEntries(entries);
  }

  static fromEntries(entries: CredentialFileEntry[]): AgentCredentialProvider {
    const credentials = new Map<string, AgentCredential>();
    for (const entry of entries) {
      if (credentials.has(entry.contractId)) {
        throw new Error(`Duplicate agent credential for ${entry.contractId}`);
      }
      credentials.set(entry.contractId, {
        accountId: entry.accountId,
        privateKey: entry.privateKey,
      });
    }
    if (credentials.size === 0) {
      throw new Error("At least one contract-scoped agent credential is required");
    }
    return new AgentCredentialProvider(credentials);
  }

  resolve(contractId: string): AgentCredential {
    const credential = this.#credentials.get(contractId);
    if (credential) return credential;

    if (this.#credentials.size > 0) {
      throw new Error(
        `No restricted agent credential is configured for ${contractId}`,
      );
    }
    if (!this.#legacyCredential) {
      throw new Error(`No agent credential is configured for ${contractId}`);
    }
    if (contractId !== this.#legacyContractId) {
      throw new Error(
        `The legacy agent credential is bound to ${this.#legacyContractId}, not ${contractId}`,
      );
    }
    return this.#legacyCredential;
  }
}

export function assertNoFullAccessOverride(value: string | undefined): void {
  if (value?.trim()) {
    throw new Error(
      "ALLOW_FULL_ACCESS_AGENT is no longer supported; configure a request_payment Function Call key for each contract",
    );
  }
}

async function readCredentialFile(filePath: string): Promise<CredentialFileEntry[]> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Unable to read the agent credential file at ${filePath}`, {
      cause: error,
    });
  }

  const parsed = credentialFileSchema.safeParse(value);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid agent credential file: ${details}`);
  }

  return parsed.data.credentials.map((credential) => ({
    contractId: credential.contract_id,
    accountId: credential.account_id,
    privateKey: credential.private_key,
  }));
}

async function assertPrivateCredentialFile(filePath: string): Promise<void> {
  if (process.platform === "win32") return;

  let fileStats;
  try {
    fileStats = await stat(filePath);
  } catch (error) {
    throw new Error(`Unable to inspect the agent credential file at ${filePath}`, {
      cause: error,
    });
  }
  if (!fileStats.isFile()) {
    throw new Error(`Agent credential path is not a file: ${filePath}`);
  }
  if ((fileStats.mode & 0o077) !== 0) {
    throw new Error(
      `Agent credential file must not be group- or world-readable: ${filePath}`,
    );
  }
}
