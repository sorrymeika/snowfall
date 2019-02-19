import { compile } from "./compile";
import { createElement } from "./createElement";
import { render } from "./render";

const ROOT_ELEMENT = Symbol('$rootElement$');
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
            constructor(data) {
                this.state = new State(data);
                this.element = this.state[ROOT_ELEMENT] = createElement(rootVNode);
            }

            appendTo(element) {
            }

            prependTo(element) {
            }

            before(element) {
            }

            after(element) {
            }

            insertAfter(element) {
            }

            insertBefore(element) {
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