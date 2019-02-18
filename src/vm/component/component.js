import { compile } from "./compile";
import { IVNode } from "./createVNode";
import { createElement } from "./createElement";
import { render } from "./render";

const ROOT_ELEMENT = Symbol('$rootElement$');

type IElement = {
    vnode: IVNode,
    node: any,
    parent: IElement,
    children: IElement[],
    nextSibling: IElement,
    prevSibling: IElement,
}

const factories = {};

export function createComponent(tagName) {
    return new factories[tagName]();
}

export function component({
    name,
    template
}) {
    const rootVNode = compile(template);

    return (State) => {
        State.prototype.render = function () {
            const data = Object.create(this.state.data);
            data.__state = this;
            render(this[ROOT_ELEMENT], this, data);
        };

        const componentClass = class Component {
            constructor() {
                this.state = new State();
                this.state[ROOT_ELEMENT] = createElement(rootVNode);
            }

            set(data) {
                this.state.set(data);
            }

            render() {
                this.state.render();
            }
        };
        factories[name] = componentClass;
    };
}