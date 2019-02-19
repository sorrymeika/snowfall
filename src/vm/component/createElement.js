import { IVNode } from "./createVNode";

export type IElement = {
    vnode: IVNode,
    node: any,
    parent: IElement,
    children: IElement[]
}

export function createElement(vnode: IVNode, root: IElement): IElement {
    const result = {
        vnode
    };
    result.root = root || result;

    const vchildren = vnode.children;
    if (vchildren) {
        const children = [];
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
            children.push(elem);
        }
        result.children = children;
    }
}