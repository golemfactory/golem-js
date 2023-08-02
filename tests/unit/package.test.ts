import { LoggerMock } from "../mock";
import { Package } from "../../yajsapi/package";
const logger = new LoggerMock();

describe("Package", () => {
  describe("create()", () => {
    it("should create package", async () => {
      const p = await Package.create({ imageHash: "image_hash", logger });
      expect(p).toBeInstanceOf(Package);
    });
    it("should return decorators with task_package and package_format", async () => {
      // Due to missing mocking and DI approach this tests is not mocked
      // and makes real request to the registry
      // ? Shouldnt we avoid this

      const p = await Package.create({
        imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
      });

      const decorations = await p.getDemandDecoration();

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
    it("should create package with manifest decorations", async () => {
      const manifest = "XNBdCI6ICIyMTAwLTAxLTAxVDAwOjAxOjAwLjAwMDAwMFoiLAogICJtZXRhZGF0YSI6IHsKICAgICJuYW1lI=";
      const manifestSig = "GzbdJDaW6FTajVYCKKZZvwpwVNBK3o40r/okna87wV9CVWW0+WUFwe=";
      const manifestCert = "HCkExVUVDZ3dOUjI5c1pXMGdSbUZqZEc5eWVURW1NQ1FHQTFVRUF3d2RSMjlzWl=";
      const manifestSigAlgorithm = "sha256";
      const capabilities = ["inet", "manifest-support"];
      const p = await Package.create({
        manifest,
        manifestSig,
        manifestCert,
        manifestSigAlgorithm,
        capabilities,
      });
      const decorations = await p.getDemandDecoration();
      expect(decorations.properties).toEqual(
        expect.arrayContaining([
          { key: "golem.srv.comp.payload", value: manifest },
          { key: "golem.srv.comp.payload.sig", value: manifestSig },
          { key: "golem.srv.comp.payload.cert", value: manifestCert },
          { key: "golem.srv.comp.payload.sig.algorithm", value: manifestSigAlgorithm },
          { key: "golem.srv.comp.vm.package_format", value: "gvmkit-squash" },
        ]),
      );
      expect(decorations.constraints).toEqual([
        "(golem.inf.mem.gib>=0.5)",
        "(golem.inf.storage.gib>=2)",
        "(golem.runtime.name=vm)",
        "(golem.inf.cpu.cores>=1)",
        "(golem.inf.cpu.threads>=1)",
        "(golem.runtime.capabilities=inet)",
        "(golem.runtime.capabilities=manifest-support)",
      ]);
    });
  });
});
