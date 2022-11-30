import { Package } from "../../yajsapi/package";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment";

export const packageMock: Package = {
  async getDemandDecoration(): Promise<MarketDecoration> {
    return Promise.resolve({
      constraints: ["(&(golem.inf.mem.gib>=0.5)\n\t(golem.inf.storage.gib>=2)\n\t(golem.runtime.name=vm))"],
      properties: [
        {
          key: "golem.srv.comp.task_package",
          value:
            "hash:sha3:9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae:http://girepo.dev.golem.network:8000/local-image-c76719083b.gvmi\n",
        },
        {
          key: "golem.srv.comp.vm.package_format",
          value: "gvmkit-squash",
        },
      ],
    });
  },
};
