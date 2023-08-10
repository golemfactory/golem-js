import { TEST_IDENTITY } from "../fixtures";
export const IdentityMock = {
  getIdentity: async (): Promise<string> => {
    return TEST_IDENTITY;
  },
};
