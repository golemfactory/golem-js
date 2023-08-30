import { Application } from "typedoc";
import { HugoTheme } from "./frontmatter";

export function load(app: Application) {
  app.renderer.defineTheme("hugo", HugoTheme);
}
