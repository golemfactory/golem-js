import * as fs from "fs";

import { ReflectionKind, PageEvent, RendererEvent, Renderer, ContainerReflection } from "typedoc";
import { MarkdownTheme } from "typedoc-plugin-markdown";
import { getKindPlural } from "typedoc-plugin-markdown/dist/groups";
import { getPageTitle, prependYAML } from "typedoc-plugin-markdown/dist/utils/front-matter";

export class HugoTheme extends MarkdownTheme {
  constructor(renderer: Renderer) {
    super(renderer);
    this.listenTo(this.owner, { [PageEvent.END]: this.onHugoPageEnd });
  }

  private onHugoPageEnd(page: PageEvent<ContainerReflection>) {
    const yamlVars = {
      title: this.getPageTitle(page),
      linkTitle: page.model.name,
      slug: this.getSlug(page),
    };

    page.contents && (page.contents = this.prependYAML(page.contents, yamlVars));
  }

  private getPageTitle(page: PageEvent<ContainerReflection>): string {
    return page.url === "modules.md" && this.indexTitle ? this.indexTitle : page.model.name;
  }

  private getSlug(page: PageEvent): string {
    return (page.url.match(/\/([^\/]*)\.[^.$]*$/) || [, page.url])[1];
  }

  private prependYAML(contents: string, yamlVars: object): string {
    return (
      "---\n" +
      Object.entries(yamlVars)
        .map(([key, value]) => `${key}: "${value}"`)
        .join("\n") +
      "\n---\n" +
      contents
    );
  }
}
