/* eslint @typescript-eslint/ban-ts-comment: 0 */
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { LoggerMock } from "../mock";
import { Package } from "../../yajsapi/package";

const logger = new LoggerMock();

describe("Package", () => {
  describe("create()", () => {
    it("should create package", async () => {
      const p = await Package.create({ image_hash: "image_hash", logger });
      expect(p).to.be.instanceof(Package);
    });
    it("should return decorators with task_package and package_format", async () => {
      const p = await Package.create({
        image_hash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
        logger,
        repo_url: "http://girepo.dev.golem.network:8000",
      });
      const decorations = await p.getDemandDecoration();
      expect(decorations.properties).to.have.deep.members([
        {
          key: "golem.srv.comp.task_package",
          value:
            "hash:sha3:9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae:http://girepo.dev.golem.network:8000/local-image-c76719083b.gvmi\n",
        },
        { key: "golem.srv.comp.vm.package_format", value: "gvmkit-squash" },
      ]);
    });
  });
});
