// ? This file is legacy, we should remove it or refactor it

// import axios from "axios";
// import { Logger, runtimeContextChecker } from "../utils";

// const FALLBACK_REPO_URL = "https://girepo.dev.golem.network";
// // const PUBLIC_DNS_URL = "https://dns.google/resolve?type=srv&name=";
// const DEFAULT_REPO_SRV = "_girepo._tcp.dev.golem.network";
// const SCHEMA = "https";
// const TIMEOUT = 10000;

// /**
//  * @internal
//  */
// export interface RepoResolverOptions {
//   logger?: Logger;
// }

// /**
//  * @internal
//  */
// export class RepoResolver {
//   private constructor(private logger?: Logger) {}

//   static create({ logger }: RepoResolverOptions): RepoResolver {
//     return new RepoResolver(logger);
//   }
//   private async isRecordValid(url) {
//     try {
//       await axios.head(url, { timeout: TIMEOUT });
//       return true;
//     } catch (e) {
//       if (e?.response?.status > 200 && e?.response?.status < 500) return true;
//       this.logger?.warn(`Url ${url} is not responding. ${e?.message}`);
//       return false;
//     }
//   }

//   async resolveRepoUrl() {
//     try {
//       const records = runtimeContextChecker.isBrowser
//         ? await this.resolveRepoUrlForBrowser()
//         : await this.resolveRepoUrlForNode();

//       while (records.length > 0) {
//         const url = records.splice((records.length * Math.random()) | 0, 1)[0];
//         if (await this.isRecordValid(url)) {
//           return url;
//         }
//       }
//     } catch (e) {
//       this.logger?.warn(`Error occurred while trying to get SRV record : ${e}`);
//     }
//     return null;
//   }

//   async getRepoUrl() {
//     const repoUrl = await this.resolveRepoUrl();
//     if (repoUrl) {
//       this.logger?.debug(`Using image repository: ${repoUrl}.`);
//       return repoUrl;
//     }
//     this.logger?.warn(`Problem resolving image repository: ${DEFAULT_REPO_SRV}, falling back to ${FALLBACK_REPO_URL}.`);
//     return FALLBACK_REPO_URL;
//   }

//   private async resolveRepoUrlForBrowser(): Promise<string[]> {
//     return [FALLBACK_REPO_URL];
//   }

// <<<<<<< HEAD
//   private async resolveRepoUrlForNode() {
//     //to be able to run against other server ( like stage registry )
//     if (process.env.REPO_URL) {
//       return [process.env.REPO_URL];
//     }

// =======
//   private async resolveRepoUrlForNode(): Promise<string[]> {
// >>>>>>> master
//     return new Promise((resolve, reject) => {
//       import("dns")
//         .then((nodeDns) => {
//           nodeDns.resolveSrv(DEFAULT_REPO_SRV, (err, addresses) => {
//             if (err) reject(err);
//             resolve(addresses?.map((a) => (a.name && a.port ? `${SCHEMA}://${a.name}:${a.port}` : "")));
//           });
//         })
//         .catch((err) => reject(err));
//     });
//   }
// }
