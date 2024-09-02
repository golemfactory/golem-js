import { DemandBodyBuilder } from "../demand-body-builder";
import { WorkloadDemandDirector } from "./workload-demand-director";
import { WorkloadDemandDirectorConfig } from "./workload-demand-director-config";

describe("ActivityDemandDirector", () => {
  test("should create properties with task_package and package_format", async () => {
    const builder = new DemandBodyBuilder();

    const director = new WorkloadDemandDirector(
      new WorkloadDemandDirectorConfig({
        imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
        expirationSec: 600,
      }),
    );
    await director.apply(builder);

    const decorations = builder.getProduct();

    expect(decorations.properties).toEqual(
      expect.arrayContaining([
        {
          key: "golem.srv.comp.task_package",
          value:
            "hash:sha3:529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4:http://registry.golem.network/download/529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
        },
        { key: "golem.srv.comp.vm.package_format", value: "gvmkit-squash" },
      ]),
    );
  });

  test("should create package with manifest decorations", async () => {
    const builder = new DemandBodyBuilder();

    const manifest = "XNBdCI6ICIyMTAwLTAxLTAxVDAwOjAxOjAwLjAwMDAwMFoiLAogICJtZXRhZGF0YSI6IHsKICAgICJuYW1lI=";
    const manifestSig = "GzbdJDaW6FTajVYCKKZZvwpwVNBK3o40r/okna87wV9CVWW0+WUFwe=";
    const manifestCert = "HCkExVUVDZ3dOUjI5c1pXMGdSbUZqZEc5eWVURW1NQ1FHQTFVRUF3d2RSMjlzWl=";
    const manifestSigAlgorithm = "sha256";
    const capabilities = ["inet", "manifest-support"];

    const director = new WorkloadDemandDirector(
      new WorkloadDemandDirectorConfig({
        manifest,
        manifestSig,
        manifestCert,
        manifestSigAlgorithm,
        capabilities,
        expirationSec: 600,
      }),
    );
    await director.apply(builder);

    const decorations = builder.getProduct();

    expect(decorations.properties).toEqual(
      expect.arrayContaining([
        { key: "golem.srv.comp.payload", value: manifest },
        { key: "golem.srv.comp.payload.sig", value: manifestSig },
        { key: "golem.srv.comp.payload.cert", value: manifestCert },
        { key: "golem.srv.comp.payload.sig.algorithm", value: manifestSigAlgorithm },
        { key: "golem.srv.comp.vm.package_format", value: "gvmkit-squash" },
      ]),
    );

    expect(decorations.constraints).toEqual(
      expect.arrayContaining([
        "(golem.inf.mem.gib>=0.5)",
        "(golem.inf.storage.gib>=2)",
        "(golem.runtime.name=vm)",
        "(golem.inf.cpu.cores>=1)",
        "(golem.inf.cpu.threads>=1)",
        "(golem.runtime.capabilities=inet)",
        "(golem.runtime.capabilities=manifest-support)",
      ]),
    );
  });

  test("should throw an error if user providers a negative expirationSec value", () => {
    expect(
      () =>
        new WorkloadDemandDirector(
          new WorkloadDemandDirectorConfig({
            imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
            expirationSec: -3,
          }),
        ),
    ).toThrow("The expirationSec param has to be a positive integer");
  });

  test("should create constraints with runtime name and runtime version", async () => {
    const builder = new DemandBodyBuilder();

    const director = new WorkloadDemandDirector(
      new WorkloadDemandDirectorConfig({
        runtime: {
          name: "vm-test",
          version: "0.7.0",
        },
        expirationSec: 2,
        imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
      }),
    );
    await director.apply(builder);

    const decorations = builder.getProduct();

    expect(decorations.constraints).toEqual(
      expect.arrayContaining(["(golem.runtime.name=vm-test)", "(golem.runtime.version=0.7.0)"]),
    );
  });

  test("should throw an error if user providers a engine and runtime name", () => {
    expect(
      () =>
        new WorkloadDemandDirector(
          new WorkloadDemandDirectorConfig({
            engine: "vm",
            runtime: {
              name: "vm",
            },
            expirationSec: 2,
            imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
          }),
        ),
    ).toThrow(
      "The engine parameter is deprecated and cannot be used with the runtime parameter. Use the runtime option only",
    );
  });
});
