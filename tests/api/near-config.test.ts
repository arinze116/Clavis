import assert from "node:assert/strict";
import test from "node:test";

import { assertTestnetConfiguration } from "../../frontend/src/utils/nearConfig.js";

const validConfiguration = {
  networkId: "testnet",
  rpcUrl: "https://test.rpc.fastnear.com",
  rootContractId: "clavis.testnet",
  factoryContractId: "factory.clavis.testnet",
  explorerUrl: "https://testnet.nearblocks.io",
  nearBlocksApiUrl: "https://api-testnet.nearblocks.io",
};

test("accepts the configured Clavis Testnet boundary", () => {
  assert.doesNotThrow(() => assertTestnetConfiguration(validConfiguration));
  assert.doesNotThrow(() =>
    assertTestnetConfiguration({
      ...validConfiguration,
      rpcUrl: "https://rpc.testnet.fastnear.com",
    }),
  );
  assert.doesNotThrow(() =>
    assertTestnetConfiguration({
      ...validConfiguration,
      rpcUrl: "https://archival-rpc.testnet.near.org",
    }),
  );
});

test("rejects a mainnet network or account configuration", () => {
  assert.throws(
    () => assertTestnetConfiguration({ ...validConfiguration, networkId: "mainnet" }),
    /Testnet only/,
  );
  assert.throws(
    () =>
      assertTestnetConfiguration({
        ...validConfiguration,
        rootContractId: "clavis.near",
      }),
    /Testnet account/,
  );
});

test("rejects endpoints that do not identify Testnet", () => {
  assert.throws(
    () =>
      assertTestnetConfiguration({
        ...validConfiguration,
        rpcUrl: "https://rpc.mainnet.near.org",
      }),
    /Testnet endpoint/,
  );
  assert.throws(
    () =>
      assertTestnetConfiguration({
        ...validConfiguration,
        rpcUrl: "https://not-testnet.example",
      }),
    /Testnet endpoint/,
  );
  assert.throws(
    () =>
      assertTestnetConfiguration({
        ...validConfiguration,
        rpcUrl: "https://rpc.mainnet.fastnear.com",
      }),
    /Testnet endpoint/,
  );
  assert.throws(
    () =>
      assertTestnetConfiguration({
        ...validConfiguration,
        explorerUrl: "https://test.rpc.fastnear.com",
      }),
    /Testnet endpoint/,
  );
});
