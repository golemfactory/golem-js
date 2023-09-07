"use strict";
const typedoc = require("typedoc");
const HugoTheme = require("typedoc-plugin-markdown").MarkdownTheme;

class ModifiedHugoTheme extends HugoTheme {
  constructor(renderer) {
    super(renderer);
    this.listenTo(this.owner, { [typedoc.PageEvent.END]: this.onHugoPageEnd });
  }

  onHugoPageEnd(page) {
    const yamlVars = {
      title: `${typedoc.ReflectionKind[page.model.kind]} ${this.getPageTitle(page)} - golem-js API Reference`,
      description: `Explore the detailed API reference documentation for the ${
        typedoc.ReflectionKind[page.model.kind]
      } ${this.getPageTitle(page)} within the golem-js SDK for the Golem Network.`,
      type: "reference",
    };
    page.contents && (page.contents = this.prependYAML(page.contents, yamlVars));
  }

  getPageTitle(page) {
    return page.url === "modules.md" && this.indexTitle ? this.indexTitle : page.model.name;
  }

  getSlug(page) {
    return (page.url.match(/\/([^\/]*)\.[^.$]*$/) || [, page.url])[1];
  }

  prependYAML(contents, yamlVars) {
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

function load({ application }) {
  const theme = new ModifiedHugoTheme(application.renderer);

  application.converter.on(typedoc.Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const reflection of context.project.getReflectionsByKind(typedoc.ReflectionKind.Reference)) {
      context.project.removeReflection(reflection);
    }

    for (const reflection of context.project.getReflectionsByKind(typedoc.ReflectionKind.Module)) {
      if (!reflection.children || !reflection.children.length) {
        context.project.removeReflection(reflection);
      }
    }
  });
}

exports.load = load;
