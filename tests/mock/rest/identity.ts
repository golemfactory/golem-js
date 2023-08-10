import { TEST_IDENTITY } from "../fixtures/identity";
export default {
  getIdentity: async (): Promise<string> => {
    return TEST_IDENTITY;
  },
};
