/**
 * This example demonstrates how to scan the market for providers that meet specific requirements.
 */
import { GolemNetwork, ScanOptions } from "@golem-sdk/golem-js";
import { last, map, scan, takeUntil, tap, timer } from "rxjs";

// What providers are we looking for?
const scanOptions: ScanOptions = {
  subnetTag: "public",
  workload: {
    engine: "vm",
    minCpuCores: 4,
    minMemGib: 8,
    minCpuThreads: 8,
    capabilities: ["vpn"],
    minStorageGib: 16,
  },
};

(async () => {
  const glm = new GolemNetwork();
  await glm.connect();
  const spec = glm.market.buildScanSpecification(scanOptions);

  const SCAN_DURATION_MS = 10_000;

  console.log(`Scanning for ${SCAN_DURATION_MS / 1000} seconds...`);
  glm.market
    .scan(spec)
    .pipe(
      tap((scannedProposal) => {
        console.log("Received proposal from:", scannedProposal.getProviderInfo().name);
      }),
      // calculate the cost of an hour of work
      map(
        (scannedProposal) =>
          scannedProposal.pricing.start + //
          scannedProposal.pricing.cpuSec * 3600 +
          scannedProposal.pricing.envSec * 3600,
      ),
      // calculate the running average
      scan((total, cost) => total + cost, 0),
      map((totalCost, index) => totalCost / (index + 1)),
      // stop scanning after SCAN_DURATION_MS
      takeUntil(timer(SCAN_DURATION_MS)),
      last(),
    )
    .subscribe({
      next: (averageCost) => {
        console.log("Average cost for an hour of work:", averageCost.toFixed(6), "GLM");
      },
      complete: () => {
        console.log("Scan completed, shutting down...");
        glm.disconnect();
      },
    });
})();
