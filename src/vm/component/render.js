import { $, fade } from '../../utils/dom';
import { isNo, isYes, isNumber } from '../../utils/is';
import { createComponent } from './component';
import { Reaction } from '../Reaction';
import { get } from '../../utils';
import { isModel, isCollection } from '../predicates';
import List from '../List';

export function render(element: IElement, state, data) {
    const {
        vnode
    } = element;

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
                    render(el, state, data);
                } else {
                    visible = invoke(el, data, el.vnode.visibleProps.fid);
                    if (visible) {
                        render(el, state, data);
                    }
                }
            }
            return;
        }
    }

    const repeatProps = vnode.repeatProps;
    if (repeatProps) {
        const {
            dataSourcePath,
            alias,
            indexAlias,
            filter,
            orderByType,
            orderBy
        } = repeatProps;

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

        const elements = element.elements;
        const hasElement = {};
        const list = [];

        collection.each(function (item) {
            const itemData = Object.create(data);
            itemData[alias] = Object.create(item.state.data);
            itemData[alias].__state = item;

            for (let j = 0; j < elements.length; j++) {
                if (elements[j].data == item) {
                    hasElement[j] = true;
                    break;
                }
            }
            if (filter == null || invoke(element, itemData, filter)) {
                list.push({
                    itemData: item.state.data,
                    data: itemData
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
                    let ret = 0;
                    let isDesc;
                    let sort;
                    let a,
                        b;

                    for (var i = 0; i < orderByOptions.length; i += 2) {
                        sort = orderByOptions[i];
                        isDesc = orderByOptions[i + 1] == false;

                        a = am[sort];
                        b = bm[sort];

                        // 中文排序需使用 localeCompare
                        ret = isNumber(a) && isNumber(b)
                            ? a - b
                            : ((a === undefined || a === null) ? '' : (a + '')).localeCompare(b);
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

        return;
    }

    if (vnode.type === 'component') {
        if (!element.component) {
            element.component = createComponent(vnode.tagName);
        }
    } else if (vnode.type === 'textNode') {
        element.node = document.createTextNode(vnode.nodeValue || '');
    } else if (!element.node) {
        const node = document.createElement(vnode.tagName);
        const attributes = vnode.attributes;

        if (attributes) {
            for (let i = 0; i < attributes.length; i += 2) {
                setAttribute(node, attributes[i], attributes[i + 1]);
            }
        }

        element.node = node;
    }

    const props = vnode.props;
    if (props) {
        if (vnode.type === 'component') {
            if (!element.reaction) {
                const autorun = () => {
                    const nextProps = {};
                    for (let i = 0; i < props.length; i += 2) {
                        nextProps[props[i]] = invoke(element, data, props[i + 1]);
                    }
                    element.component.set(nextProps);
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

    const children = element.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            render(children[i], state, data);
        }
    }
}

function removeElement(element) {
    if (element.node.parentNode) {
        element.node.parentNode.removeChild(element.node);
    }
}

function invoke(element, data, fid) {
    return element.root.fns[fid](data);
}

function autoSet(element, name, data, fid) {
    const autorun = () => setAttribute(element.node, name, invoke(element, data, fid));
    const reaction = new Reaction(autorun);
    reaction.__propAutoSet = autorun;
    return reaction;
}

function setAttribute(el, attrName, val) {
    switch (attrName) {
        case 'nodeValue':
            el.nodeValue = val;
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