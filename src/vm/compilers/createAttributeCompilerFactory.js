
export default function createAttributeCompilerFactory(compilers) {

    class AttributeCompiler {
        constructor(templateCompiler) {
            this.template = templateCompiler
            this.compilers = compilers.map((Compiler) => new Compiler(templateCompiler, this))
        }

        reduce(el, attr, val) {
            for (var i = 0; i < compilers.length; i++) {
                if (compilers[i].compile(el, attr, val)) {
                    return;
                }
            }
            this.compile(el, attr, val);
        }

        compile(el, attr, val, withBraces) {
            var fid = this.template.compileToFunction(val, withBraces)
            if (fid) {
                (el.snAttributes || (el.snAttributes = [])).push(attr, fid);
                el.removeAttribute(attr);
            }
        }
    }

    return function createAttributeCompiler(templateCompiler) {
        return new AttributeCompiler(compilers, templateCompiler);
    }
}