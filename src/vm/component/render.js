import { $, fade, TEXT_NODE } from '../../utils/dom';
import { isNo, isYes, isNumber, isString } from '../../utils/is';
import { createComponent } from './component';
import { Reaction } from '../Reaction';
import { get } from '../../utils';
import { isModel, isCollection } from '../predicates';
import List from '../List';
import { createElement, IElement } from './createElement';

export function render(element: IElement, state, data) {
    const { vnode } = element;

    if (vnode.visibleProps && vnode.visibleProps.type == 'if') {
        let visible = invoke(element, data, vnode.visibleProps.fid);
        if (isYes(visible)) {
            for (let i = 0; i < element.elses.length; i++) {
                removeElement(element.elses[i]);
            }
        } else {
            removeElement(element);
            for (let i = 0; i < element.elses.length; i++) {
                let el = element.elses[i];
                if (visible) {
                    removeElement(el);
                } else if (el.vnode.visibleProps.type == 'else') {
                    return render(el, state, data);
                } else {
                    visible = invoke(el, data, el.vnode.visibleProps.fid);
                    if (visible) {
                        return render(el, state, data);
                    }
                }
            }
            return;
        }
    }

    if (vnode.repeatProps && element.type !== 'repeat-item') {
        return renderRepeat(element, state, data);
    }

    const isComponent = vnode.type === 'component';

    if (isComponent) {
        if (!element.component) {
            element.component = createComponent(vnode.tagName);
        }
    } else if (vnode.type === 'textNode') {
        element.node = document.createTextNode(vnode.nodeValue || '');
    } else if (!element.node) {
        const node = document.createElement(vnode.tagName);
        const attributes = vnode.attributes;

        element.node = node;

        if (attributes) {
            for (let i = 0; i < attributes.length; i += 2) {
                setAttribute(element, attributes[i], attributes[i + 1]);
            }
        }
    }

    const children = element.children;
    if (children) {
        let prevSibling;
        for (let i = 0; i < children.length; i++) {
            const child = render(children[i], state, data);
            if (child) {
                if (!prevSibling) {
                    prependElement(element, child);
                } else {
                    insertElementAfter(prevSibling, child);
                }
                prevSibling = child;
            }
        }
    }

    const props = vnode.props;
    if (props) {
        if (isComponent) {
            if (!element.reaction) {
                const autorun = () => {
                    const nextProps = {
                        children
                    };
                    for (let i = 0; i < props.length; i += 2) {
                        nextProps[props[i]] = invoke(element, data, props[i + 1]);
                    }
                    element.component.set(nextProps);
                    element.component.render();
                };
                element.reaction = new Reaction(autorun);
                element.autorun = autorun;
            }
            element.reaction.track(element.autorun);
        } else {
            let autoruns = element.autoruns;
            if (!autoruns) {
                element.autoruns = autoruns = [];
                for (let i = 0; i < props.length; i += 2) {
                    autoruns.push(autoSet(element, props[i], props[i + 1]));
                }
            }
            for (let i = 0; i < autoruns.length; i++) {
                autoruns[i].track(autoruns[i].__propAutoSet);
            }
        }
    }

    return element;
}

function renderRepeat(element: IElement, state, data) {
    const {
        dataSourcePath,
        alias,
        indexAlias,
        filter,
        orderByType,
        orderBy
    } = element.repeatProps;

    const dataSourceName = dataSourcePath[0];

    let collection;

    if (dataSourceName === 'this') {
        collection = get(state, dataSourcePath.slice(1));
    } else {
        const source = data[dataSourceName];
        let sourceState = source.__state;
        let paths;

        if (!sourceState) {
            sourceState = state;
        } else {
            paths = dataSourcePath.slice(1);
        }
        collection = isModel(sourceState)
            ? sourceState._(paths)
            : get(sourceState.state.data, paths);
    }

    if (!isCollection(collection)) {
        const array = collection;
        collection = element.collection || (element.collection = new List());
        collection.set(array);
    }

    const elements = element.elements || [];
    const visibleElements = {};
    const list = [];

    collection.each(function (item) {
        const elementData = Object.create(data);
        elementData[alias] = Object.create(item.state.data);
        elementData[alias].__state = item;

        if (filter == null || invoke(element, elementData, filter)) {
            let itemElement;
            for (let j = 0; j < elements.length; j++) {
                if (elements[j].state == item) {
                    visibleElements[j] = true;
                    itemElement = elements[j];
                    break;
                }
            }

            if (!itemElement) {
                const newItemElement = createElement(element.vnode, element.root);
                newItemElement.type = 'repeat-item';
                itemElement = {
                    element: newItemElement,
                    state: item
                };
                visibleElements[elements.length] = true;
                elements.push(itemElement);
            }

            list.push({
                element: itemElement.element,
                itemData: item.state.data,
                data: elementData
            });
        }
    });

    if (orderBy) {
        let sortMethod;
        if (orderByType === 'property') {
            sortMethod = get(state, orderBy);
        } else {
            // orderBy=['a',true,someFunctionId,false]
            const orderByOptions = orderBy.map(function (item) {
                if (isNumber(item)) {
                    return invoke(element, data, item);
                }
                return item;
            });

            sortMethod = function (am, bm) {
                let ret = 0,
                    isDesc,
                    sort,
                    a,
                    b;

                for (let i = 0; i < orderByOptions.length; i += 2) {
                    sort = orderByOptions[i];
                    isDesc = orderByOptions[i + 1] == false;

                    a = am[sort];
                    b = bm[sort];

                    // 中文排序需使用 localeCompare
                    ret = isNumber(a) && isNumber(b)
                        ? a - b
                        : ((a == null) ? '' : (a + '')).localeCompare(b);
                    isDesc && (ret *= -1);

                    if (ret != 0) return ret;
                }

                return ret;
            };
        }

        sortMethod && list.sort(function (a, b) {
            return sortMethod(a.itemData, b.itemData);
        });
    }

    let cursorElement;

    list.forEach(function (item, index) {
        const elem = item.element;

        indexAlias && (elem.data[indexAlias] = index);
        render(elem, state, elem.data);
        insertElementAfter(cursorElement, elem);

        cursorElement = elem;
    });

    const refs = [];
    // 移除过滤掉的element
    for (let i = 0; i < elements.length; i++) {
        const elem = elements[i];
        if (!visibleElements[i]) {
            removeElement(elem);
        } else {
            refs.push(elem.node);
        }
    }

    return element;
}

function isComponent(element) {
    return element.vnode && element.vnode.type === 'component';
}

function prependElement(parentElement, element) {
    if (isComponent(element)) {
        element.component.prependTo(parentElement);
    } else {
        const parentNode = parentElement.node;
        if (parentNode.firstChild) {
            parentNode.insertBefore(element.node, parentNode.firstChild);
        } else {
            parentNode.appendChild(element.node);
        }
    }
}

function insertElementAfter(destElement, element) {
    if (isComponent(destElement)) {
        destElement.component.after(element);
    } else if (isComponent(element)) {
        element.component.insertAfter(element);
    } else {
        let destNode,
            newNode;

        destNode = destElement.vnode
            ? destElement.node
            : destElement;

        newNode = element.vnode
            ? element.node
            : element;

        if (destNode.nextSibling != newNode) {
            destNode.nextSibling
                ? destNode.parentNode.insertBefore(newNode, destNode.nextSibling)
                : destNode.parentNode.appendChild(newNode);
        }
    }
}

function removeElement(element) {
    const node = element.node;
    if (node && node.parentNode) {
        node.parentNode.removeChild(node);
    }
}

function invoke(element, data, fid) {
    return element.root.fns[fid](data);
}

function autoSet(element, name, data, fid) {
    const autorun = () => setAttribute(element, name, invoke(element, data, fid));
    const reaction = new Reaction(autorun);
    reaction.__propAutoSet = autorun;
    return reaction;
}

function setAttribute(element, attrName, val) {
    const el = element.node;

    switch (attrName) {
        case 'nodeValue':
            setTextNode(element, val);
            break;
        case 'value':
            var nodeName = el.nodeName;
            if (nodeName === 'INPUT' || nodeName === 'SELECT' || nodeName === 'TEXTAREA') {
                if (el.value != val || (el.value === '' && val === 0)) {
                    el.value = val;
                }
            } else
                el.setAttribute(attrName, val);
            break;
        case 'html':
        case 'sn-html':
            el.innerHTML = val;
            break;
        case 'sn-visible':
        case 'display':
            el.style.display = isNo(val) ? 'none' : val == 'block' || val == 'inline' || val == 'inline-block' ? val : '';
            break;
        case 'sn-display':
            fade(el, val);
            break;
        case 'classname':
        case 'class':
            el.className = val;
            break;
        case 'sn-css':
            el.style.cssText += val;
            break;
        case 'sn-style':
        case 'style':
            el.style.cssText = val;
            break;
        case 'checked':
        case 'selected':
        case 'disabled':
            (el[attrName] = !!val) ? el.setAttribute(attrName, attrName) : el.removeAttribute(attrName);
            break;
        case 'sn-image':
        case 'src':
            if (val) {
                el.src = val;
            } else {
                el.removeAttribute('src');
            }
            break;
        case 'sn-src':
            if (val) {
                if (el.src || el.nodeName !== 'IMG') {
                    el.src = val;
                } else {
                    $(el)
                        .one('load error', function (e) {
                            if (e.type === 'error') {
                                el.removeAttribute('src');
                                el.style.opacity = "";
                            } else {
                                $(el).animate({
                                    opacity: 1
                                }, 200);
                            }
                        })
                        .css({
                            opacity: .3
                        })
                        .attr({
                            src: val
                        });
                }
            } else {
                el.removeAttribute('src');
            }
            break;
        default:
            val === null || val === false ? el.removeAttribute(attrName) : el.setAttribute(attrName, val);
            break;
    }
}

function setTextNode(element, val) {
    const tails = element.tails || [];

    if (Array.isArray(val) || (typeof val === 'object' && (val.nodeType || val.vnode) && (val = [val]))) {
        let cursor = element.node;
        const newTails = [];

        val.reduce((res, item) => {
            Array.isArray(item) ? res.push(...item) : res.push(item);
            return res;
        }, []).forEach(function (item) {
            let tail = isString(item)
                ? findStringTail(tails, item)
                : findTail(tails, item);

            insertElementAfter(cursor, item);
            cursor = tail;
            newTails.push(tail);
        });

        element.node.nodeValue = '';
        element.tails = newTails;
    } else {
        element.node.nodeValue = val;
        element.tails = null;
    }

    tails.forEach(function (tail) {
        if (tail) {
            removeElement(tail);
        }
    });
}

function findStringTail(tails, nodeValue) {
    for (let i = 0; i < tails.length; i++) {
        let node = tails[i];
        if (node && node.nodeType === TEXT_NODE) {
            node.nodeValue = nodeValue;
            node = undefined;
            return node;
        }
    }
    return document.createTextNode(nodeValue);
}

function findTail(tails, element) {
    for (let i = 0; i < tails.length; i++) {
        let node = tails[i];
        if (node == element) {
            node = undefined;
            return node;
        }
    }
    return element;
}