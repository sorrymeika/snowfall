export function cookie(a, b, c, p) {
    if (b === undefined) {
        var res = document.cookie.match(new RegExp("(^| )" + a + "=([^;]*)(;|$)"));
        if (res != null)
            return unescape(res[2]);
        return null;
    } else {
        if (b === null) {
            b = cookie(name);
            if (b != null) c = -1;
            else return;
        }
        if (c) {
            var d = new Date();
            d.setTime(d.getTime() + c * 24 * 60 * 60 * 1000);
            c = ";expires=" + d.toGMTString();
        }
        document.cookie = a + "=" + escape(b) + (c || "") + ";path=" + (p || '/');
    }
}

export function store(key, value) {
    if (location.search && /(?:\?|&)STORE_ID=(\d+)/.test(location.search)) {
        key = RegExp.$1 + ")" + key;
    }

    if (typeof value === 'undefined')
        return JSON.parse(localStorage.getItem(key));
    if (value === null)
        localStorage.removeItem(key);
    else
        localStorage.setItem(key, JSON.stringify(value));
}