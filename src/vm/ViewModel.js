import { isArray, isPlainObject } from '../utils/is'
import nextTick from '../utils/nextTick'
import { $, eachElement } from '../utils/dom'
import Model from './Model'
import { TemplateCompiler } from './compilers/template'

import { DATACHANGED_EVENT } from './consts'

export default class ViewModel extends Model {

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
    constructor(template, attributes, children) {
        if (arguments.length === 1 && template && template.attributes && (template.el || template.delegate)) {
            children = template.children;
            attributes = template.attributes;

            super(attributes);

            this.components = template.components;
            this.delegate = template.delegate;

            template = template.el;
        } else if (
            (typeof attributes === 'undefined' || isArray(attributes)) &&
            (template === undefined || template === null || isPlainObject(template))
        ) {
            children = attributes;
            attributes = template;
            super(attributes);
            template = this.el;
        } else {
            super(attributes);
        }

        this.compiler = new TemplateCompiler(this);
        this.children = children ? [].concat(children) : [];

        this.eventId = 'sn-' + this.cid + 'model';

        this.repeats = {};
        this.refs = {};

        template && this.template(template);

        this.initialize.call(this, attributes);
    }

    template(el) {
        var $el = $(el);
        !this.$el && (this.$el = $());

        $el.each(function () {
            this.snViewModel = self;
        });

        this.compiler.compile(this, $el);

        $el.each(function () {
            self.$el.push(this.snReplacement ? this.snReplacement : this);
        });

        return this;
    }

    dataOfElement(el, keys, value) {
        var attrs = keys.split('.');
        var model;

        if (el.snData && attrs[0] in el.snData) {
            model = el.snData[attrs.shift()];
        } else {
            model = this;
        }

        if (arguments.length == 3) {
            model.set(attrs, value);
            return this;
        }

        return model.get(attrs);
    }

    getRefs(names) {
        return Promise.all(names.map(name => this.getRef(name)))
    }

    getRef(name) {
        return this.refs[name] || new Promise((resolve) => {
            this.onceTrue('viewDidUpdate', () => {
                if (this.refs[name]) {
                    resolve.call(this, this.refs[name]);
                    return true;
                }
            });
        })
    }

    nextTick(cb) {
        return this._nextTick || this._rendering ? this.one('viewDidUpdate', cb) : cb.call(this);
    }

    render() {
        if (!this._nextTick) {
            this._nextTick = this._rendering ? 1 : nextTick(this._render);
        }
    }

    _render() {
        this._rendering = true;
        this.viewWillUpdate && this.viewWillUpdate();

        console.time('render-' + this.cid);

        var compiler = this.compiler;

        do {
            this.trigger(new Event(DATACHANGED_EVENT, {
                target: this
            }));

            this._nextTick = null;
            this.refs = {};

            this.$el && eachElement(this.$el, (el) => {
                if ((el.snViewModel && el.snViewModel != this) || this._nextTick) return false;

                return compiler.updateNode(self, el);
            });

        } while (this._nextTick);

        console.timeEnd('render-' + this.cid);

        this._rendering = false;

        this.trigger('viewDidUpdate');
        this.viewDidUpdate && this.viewDidUpdate();
    }

    destroy() {
        this.trigger('destroy');
    }
}

ViewModel.prototype.next = ViewModel.prototype.nextTick;


function checkOwnNode(viewModel, node) {
    if (typeof node == 'string') {
        node = viewModel.$el.find(node);

        if (!node.length)
            throw new Error('is not own node');
    } else {
        viewModel.$el.each(function () {
            if (!$.contains(this, node))
                throw new Error('is not own node');
        });
    }
    return node;
}

function compileNewTemplate(viewModel, template) {
    var $element = $(template);
    $element.each(function () {
        if (this.snViewModel) throw new Error("can not insert or append binded node!");
    });

    viewModel.compiler.compile(viewModel, $element);
    viewModel.render();

    return $element;
}

Object.assign(ViewModel.prototype, {
    isOwnNode(node) {
        if (typeof node == 'string') {
            return !this.$el.find(node).length;
        } else {
            var flag = true;
            this.$el.each(function () {
                if (!$.contains(this, node)) return false;
            });
            return flag;
        }
    },

    before(template, referenceNode) {
        referenceNode = checkOwnNode(this, referenceNode);

        return compileNewTemplate(this, template)
            .insertBefore(referenceNode);
    },

    after(newNode, referenceNode) {
        referenceNode = checkOwnNode(this, referenceNode);

        return compileNewTemplate(this, newNode)
            .insertAfter(referenceNode);
    },

    append(newNode, parentNode) {
        parentNode = checkOwnNode(this, parentNode);

        return compileNewTemplate(this, newNode)
            .appendTo(parentNode);
    },

    prepend(newNode, parentNode) {
        parentNode = checkOwnNode(this, parentNode);

        return compileNewTemplate(this, newNode)
            .prependTo(parentNode);
    }
});