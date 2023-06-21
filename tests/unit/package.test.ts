import { expect } from "chai";
import { LoggerMock } from "../mock/index.js";
import { Package } from "../../yajsapi/package/index.js";
const logger = new LoggerMock();

describe("Package", () => {
  describe("create()", () => {
    it("should create package", async () => {
      const p = await Package.create({ imageHash: "image_hash", logger });
      expect(p).to.be.instanceof(Package);
    });
    it("should return decorators with task_package and package_format", async () => {
      // Due to missing mocking and DI approach this tests is not mocked
      // and makes real request to the registry
      // ? Shouldnt we avoid this

      const p = await Package.create({
        imageHash: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
      });

      const decorations = await p.getDemandDecoration();

      expect(decorations.properties).to.have.deep.members([
        {
          key: "golem.srv.comp.task_package",
          value:
            "hash:sha3:529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4:http://registry.golem.network/download/529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",
        },
        { key: "golem.srv.comp.vm.package_format", value: "gvmkit-squash" },
      ]);
    });
  });
});
