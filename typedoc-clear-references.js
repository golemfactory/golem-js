"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.load = void 0;
const typedoc = require("typedoc");
function load({ application }) {
  application.converter.on(typedoc.Converter.EVENT_RESOLVE_BEGIN, (context) => {
    for (const reflection of context.project.getReflectionsByKind(typedoc.ReflectionKind.Reference)) {
      context.project.removeReflection(reflection);
    }
    for (const reflection of context.project.getReflectionsByKind(typedoc.ReflectionKind.Module)) {
      if (reflection.children.length === 0) {
        context.project.removeReflection(reflection);
      }
    }
  });
}
exports.load = load;
