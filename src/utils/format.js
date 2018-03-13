import { isPlainObject } from "./is";

export function pad(num, n) {
    var a = '0000000000000000' + num;
    return a.substr(a.length - (n || 2));
}

export function currency(prefix, str) {
    if (str === undefined) {
        str = prefix;
        prefix = null;
    }
    return (prefix === undefined || prefix === null ? '' : prefix) + ((Math.round(parseFloat(str) * 100) / 100) || 0);
}

export function template(str, data) {
    var tmpl = 'var __p=[];var $data=obj||{};with($data){__p.push(\'' +
        str.replace(/\\/g, '\\\\')
            .replace(/'/g, '\\\'')
            .replace(/<%=([\s\S]+?)%>/g, function (match, code) {
                return '\',' + code.replace(/\\'/, '\'') + ',\'';
            })
            .replace(/<%([\s\S]+?)%>/g, function (match, code) {
                return '\');' + code.replace(/\\'/, '\'')
                    .replace(/[\r\n\t]/g, ' ') + '__p.push(\'';
            })
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n')
            .replace(/\t/g, '\\t') +
        '\');}return __p.join("");',

        func = new Function('obj', tmpl);

    return data ? func(data) : func;
}

export function params(args) {
    return Object.keys(args)
        .reduce(function (result, key) {
            var val = args[key];
            if (val !== undefined && val !== null) {
                result.push(key + "=" + encodeURIComponent(Array.isArray(val) || isPlainObject(val)
                    ? JSON.stringify(val)
                    : val));
            }
            return result;
        }, [])
        .join('&');
}

export function queryString(name) {
    var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
    var r = location.search.substr(1).match(reg);

    return r ? unescape(r[2]) : null;
}

export function encodeHTML(text) {
    return ("" + text).replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&#34;")
        .split("'")
        .join("&#39;");
}

export function format(format) {
    var args = Array.prototype.slice.call(arguments);
    return format.replace(/\{(\d+)\}/g, function (match, index) {
        return args[parseInt(index, 10) + 1];
    });
}

export function joinPath() {
    var args = [].slice.apply(arguments);
    var result = args.join('/').replace(/[\\]+/g, '/')
        .replace(/([^:\/]|^)[\/]{2,}/g, '$1/')
        .replace(/([^\.]|^)\.\//g, '$1');
    var flag = true;
    var replacePath = function (match, name) {
        if (name == '..') return match;
        if (!flag) flag = true;
        return '';
    };

    while (flag) {
        flag = false;
        result = result.replace(/([^\/]+)\/\.\.(\/|$)/g, replacePath);
    }
    return result.replace(/\/$/, '');
}

export function rmb(str) {
    return currency('￥', str);
}