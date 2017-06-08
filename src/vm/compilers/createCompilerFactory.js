

export default function createCompilerFactory(compilers) {

    class Compiler {
        constructor(template) {
            this.compilers = compilers.map((Compiler) => new Compiler(template))
        }

        reduce($elements) {
            for (var i = 0; i < compilers.length; i++) {
                if (compilers[i].compile($elements)) {
                    return;
                }
            }
        }
    }

    return function createNodeCompiler(template) {
        return new Compiler(template);
    }
}