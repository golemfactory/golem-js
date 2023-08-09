import { identity } from "../fixtures/identity";
export default {
  getIdentity: async (): Promise<string> => {
    return identity;
  },
};
