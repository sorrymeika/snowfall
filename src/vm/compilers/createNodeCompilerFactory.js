

export default function createNodeCompilerFactory(compilers) {

    class NodeCompiler {
        constructor(templateCompiler, el) {
            this.el = el;
            this.compilers = compilers.map((Compiler) => new Compiler(templateCompiler, el))
        }

        reduce(el, nodeType) {
            for (var i = 0; i < compilers.length; i++) {
                if (compilers[i].compile(el, nodeType)) {
                    return;
                }
            }
        }
    }

    return function createNodeCompiler(templateCompiler, el, isComponent) {
        return new NodeCompiler(templateCompiler, el, isComponent);
    }
}