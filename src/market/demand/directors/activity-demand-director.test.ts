import { DemandDetailsBuilder } from "../demand-details-builder";
import { ActivityDemandDirector } from "./activity-demand-director";
import { ActivityDemandDirectorConfig } from "./activity-demand-director-config";

describe("ActivityDemandDirector", () => {
  test("should create properties with task_package and package_format", async () => {
    const builder = new DemandDetailsBuilder();

    const director = new ActivityDemandDirector(
      new ActivityDemandDirectorConfig({
        imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
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
    const builder = new DemandDetailsBuilder();

    const manifest = "XNBdCI6ICIyMTAwLTAxLTAxVDAwOjAxOjAwLjAwMDAwMFoiLAogICJtZXRhZGF0YSI6IHsKICAgICJuYW1lI=";
    const manifestSig = "GzbdJDaW6FTajVYCKKZZvwpwVNBK3o40r/okna87wV9CVWW0+WUFwe=";
    const manifestCert = "HCkExVUVDZ3dOUjI5c1pXMGdSbUZqZEc5eWVURW1NQ1FHQTFVRUF3d2RSMjlzWl=";
    const manifestSigAlgorithm = "sha256";
    const capabilities = ["inet", "manifest-support"];

    const director = new ActivityDemandDirector(
      new ActivityDemandDirectorConfig({
        manifest,
        manifestSig,
        manifestCert,
        manifestSigAlgorithm,
        capabilities,
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
});
