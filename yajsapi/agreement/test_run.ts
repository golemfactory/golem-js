import { EventBus } from "../events/event_bus";
import { AgreementPoolService } from "./agreement_pool_service";
import { winstonLogger } from "../utils";
import { AgreementConfigContainer } from "./agreement_config_container";

process.env.YAGNA_APPKEY = "30c59fef7d8c4639b62d576bfb624e1a";
process.env.YAGNA_API_BASEPATH = "http://127.0.0.1:7465/market-api/v1";

(async function() {
    const eventBus = new EventBus();
    const configContainer = new AgreementConfigContainer(
        { },
        eventBus,
        winstonLogger
    );
    const agreementPoolService = new AgreementPoolService(configContainer);
    agreementPoolService.run();
    await new Promise(f => setTimeout(f, 30000));
    agreementPoolService.stop();
})();

