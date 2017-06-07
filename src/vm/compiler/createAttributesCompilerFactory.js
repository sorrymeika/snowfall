class AttributesCompiler {
    constructor(compilers, viewModel, el) {
        this.compilers = compilers;
        this.viewModel = viewModel;
        this.el = el;
    }

    reduce(attr, val) {
        var compilers = this.compilers;

        for (var i = 0; i < compilers.length; i++) {
            if (compilers[i](this.viewModel, this.el, attr, val)) {
                break;
            }
        }
    }
}

export default function createAttributesCompilerFactory(compilers) {

    return function createAttributesCompiler(viewModel, el, isComponent) {
        return new AttributesCompiler(compilers, viewModel, el, isComponent);
    }
}