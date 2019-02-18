export function createElement(vnode: IVNode, root) {
    const result = {
        vnode
    };
    result.root = root || result;

    const vchildren = vnode.children;
    if (vchildren) {
        const children = [];
        let prevSibling = null;
        for (let i = 0; i < vchildren.length; i++) {
            let vchild = vchildren[i];
            let elem = createElement(vchild, root);
            if (vchild.visibleProps) {
                let j = i + 1;
                elem.elses = [];
                while (j < vchildren.length) {
                    const visibleProps = vchildren[j].visibleProps;
                    if (visibleProps && (visibleProps.type == 'else-if' || visibleProps.type == 'else')) {
                        elem.elses.push(createElement(vchildren[j], root));
                        i++;
                    } else {
                        break;
                    }
                }
            }
            elem.parent = result;
            elem.prevSibling = prevSibling;
            if (prevSibling) {
                prevSibling.nextSibling = elem;
            }
            children.push(elem);
        }
        result.children = children;
    }
}