

export default function createCompilerFactory(compilers) {

    class Compiler {
        constructor(template) {
            this.compilers = compilers.map((Compiler) => new Compiler(template));
        }

        reduce($elements) {
            var compilers = this.compilers;
            for (var i = 0; i < compilers.length; i++) {
                if (compilers[i].compile($elements) === false) {
                    return;
                }
            }
        }
    }

    return function createCompiler(template) {
        return new Compiler(template);
    };
}