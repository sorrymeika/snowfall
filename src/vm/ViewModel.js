import * as objectUtils from '../utils/object';
import { $, eachElement } from '../utils/dom';

import { unbindEvents, bindEvents } from './compilers/events';
import { TemplateCompiler } from './compilers/template';

import { Event } from '../core/event';
import { Model } from './Model';

function compileNewTemplate(viewModel, template) {
    var $element = $(template);
    $element.each(function () {
        if (this.snViewModel) throw new Error("can not insert or append binded node!");
    });

    viewModel.compiler.compile(viewModel, $element);
    viewModel.renderNextTick();

    return $element;
}

function getRealElement(el) {
    return el.snIfSource && el.snIfSource.snIfStatus
        ? el.snIfSource
        : null;
}

function findOwnNode(viewModel, node) {
    if (typeof node == 'string') {
        node = viewModel.$(node);

        if (!node.length) {
            console.error('is not own node');
            return null;
        }
    } else {
        var isOwnNode = false;

        viewModel.$el.each(function () {
            var parentNode = getRealElement(this);
            if (parentNode && $.contains(parentNode, node)) {
                isOwnNode = true;
                return false;
            }
        });
        if (!isOwnNode) {
            console.error('is not own node');
            return null;
        }
    }
    return node;
}

export class ViewModel extends Model {

    /**
     * 双向绑定model
     * 
     * @example
     * 
     * // 初始化一个 ViewModel
     * new ViewModel({
     *     components: {},
     *     el: template,
     *     attributes: {
     *     }
     * })
     * 
     * @param {String|Element|Boolean|Object} [template] 字符类型或dom元素时为模版，当参数为Object时，若el和attributes属性都存在，则参数为配置项，否则为attributes
     * @param {Object} [attributes] 属性
     * @param {Array} [children] 子节点列表
     */
    constructor(props = {}, children) {
        super(props.attributes);

        this.components = props.components;
        this.delegate = props.delegate;
        this.refs = {};

        this.compiler = new TemplateCompiler(this);
        this.children = children ? [].concat(children) : [];
        this.eventId = 'sn' + this.cid + 'model';
        this.repeats = {};

        props.el && (this.el = props.el);
        this.el && this.template(this.el);

        this.initialize && this.initialize(this.$data);
    }

    template(el) {
        var self = this;
        var $el = $(el);
        !this.$el && (this.$el = $());

        $el.each(function () {
            this.snViewModel = self;
        });

        this.compiler.compile($el);

        $el.each(function () {
            self.$el.push(this.snReplacement ? this.snReplacement : this);
        });

        return this;
    }

    parents() {
        return this.$el ? this.$el.parents() : $();
    }

    $(selector) {
        if (!this.$el) return $();

        var $el = this.$el;
        this.$el.each(function (i, el) {
            var realEl = getRealElement(el);
            if (realEl) {
                $el = $el.add(realEl);
            }
        });
        return $el.find(selector).add($el.filter(selector));
    }

    before(template, referenceNode) {
        referenceNode = findOwnNode(this, referenceNode);
        if (!referenceNode) return null;

        return compileNewTemplate(this, template)
            .insertBefore(referenceNode);
    }

    after(newNode, referenceNode) {
        referenceNode = findOwnNode(this, referenceNode);
        if (!referenceNode) return null;

        return compileNewTemplate(this, newNode)
            .insertAfter(referenceNode);
    }

    append(newNode, parentNode) {
        parentNode = findOwnNode(this, parentNode);
        if (!parentNode) return null;

        return compileNewTemplate(this, newNode)
            .appendTo(parentNode);
    }

    prepend(newNode, parentNode) {
        parentNode = findOwnNode(this, parentNode);
        if (!parentNode) return null;

        return compileNewTemplate(this, newNode)
            .prependTo(parentNode);
    }

    prependTo(parent) {
        this.$el
            .prependTo(parent)
            .each(function (i, el) {
                if (el.snIfSource && !el.snIfSource.parentNode && el.snIfSource.snIfStatus) {
                    $(el.snIfSource).insertAfter(el);
                }
            });
    }

    appendTo(parent) {
        this.$el
            .appendTo(parent)
            .each(function (i, el) {
                if (el.snIfSource && !el.snIfSource.parentNode && el.snIfSource.snIfStatus) {
                    $(el.snIfSource).insertAfter(el);
                }
            });
    }

    removeAllNodes() {
        this.$el
            .each(function (i, el) {
                if (el.snIfSource) {
                    $(el.snIfSource).remove();
                }
            })
            .remove();
    }

    takeOff(childNode) {
        childNode = findOwnNode(this, childNode);
        if (!childNode) return null;

        childNode.snViewModel = this;
        this.$el.push(childNode);
        bindEvents(this, $(childNode));
        (this._takeOffEls || (this._takeOffEls = [])).push(childNode);
        return childNode;
    }

    bringBack(childNode) {
        var index = this.$el.indexOf(childNode);
        if (index != -1) {
            delete childNode.snViewModel;
            Array.prototype.splice.call(this.$el, index, 1);
            this._takeOffEls.splice(this._takeOffEls.indexOf(childNode), 1);
            unbindEvents(this, $(childNode));
        }
    }

    bringBackAll() {
        var els = this._takeOffEls;
        if (els) {
            for (var i = els.length - 1; i >= 0; i--) {
                var childNode = els[i];
                var index = this.$el.indexOf(childNode);
                if (index != -1) {
                    delete childNode.snViewModel;
                    Array.prototype.splice.call(this.$el, index, 1);
                    unbindEvents(this, $(childNode));
                }
            }
            this._takeOffEls = null;
        }
        return els;
    }

    dataOfElement(el, keys, value) {
        var attrs = keys.split('.');
        var model;
        var name = attrs[0];

        if (el.snData && name in el.snData) {
            model = el.snData[attrs.shift()];
        } else {
            model = this;
        }

        if (arguments.length == 3) {
            switch (name) {
                case 'srcElement':
                    objectUtils.value(el, attrs.slice(1, -1))[attrs.pop()] = value;
                    break;
                case 'document':
                    objectUtils.value(document, attrs.slice(1, -1))[attrs.pop()] = value;
                    break;
                case 'window':
                    objectUtils.value(window, attrs.slice(1, -1))[attrs.pop()] = value;
                    break;
                default:
                    model.set(attrs, value);
            }
            return this;
        }

        return model.get(attrs);
    }

    nextTick(cb) {
        this._nextTick || this._rendering ? this.one('viewDidUpdate', cb) : cb.call(this);
        return this;
    }

    render() {
        this._rendering = true;
        this.viewWillUpdate && this.viewWillUpdate();

        var compiler = this.compiler;

        // console.time('render-' + this.cid);
        var count = 0;

        do {
            this._nextTick = null;
            this.trigger(new Event('datachanged', {
                target: this,
                changeCount: count
            }));

            this.refs = {};
            this.$el && eachElement(this.$el, (el) => {
                if ((el.snViewModel && el.snViewModel != this) || this._nextTick) return false;

                return compiler.updateNode(el);
            });
            count++;
        } while (this._nextTick);

        // console.timeEnd('render-' + this.cid);

        this._rendering = false;

        this.trigger('viewDidUpdate');
        this.viewDidUpdate && this.viewDidUpdate();
    }

    destroy() {
        super.destroy();
        this.$el = null;
    }
}
