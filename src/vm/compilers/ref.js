
export function setRef(viewModel, el) {
    var refName = el.getAttribute('ref');
    if (refName && !el.snComponent) {
        var ref = el.snComponentInstance || el;
        var refs = viewModel.refs[refName];

        if (!refs) {
            viewModel.refs[refName] = el.snIsRepeat ? [ref] : ref;
        } else if (refs.nodeType) {
            viewModel.refs[refName] = [refs, ref];
        } else {
            refs.push(ref);
        }
    }
}