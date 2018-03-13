export function camelCase(str) {
    return str.replace(/-+(.)?/g, function(match, chr) {
        return chr ? chr.toUpperCase() : '';
    });
}

/**
 * 判断是否有非法字符
 *
 * @export
 * @param {any} str 待检测的字符串
 * @returns
 */
export function isLegal(str, illegalStr) {
    if (!str || Object.prototype.toString.call(str) != '[object String]') {
        return false;
    }
    const ILLEGAL_STRING = illegalStr || `#_%&'/",;:=!^`;
    for (let s of ILLEGAL_STRING) {
        if (str.includes(s)) {
            return false;
        }
    }
    return true;
}

/**
 * 判断字符串内是否包含emoji
 *
 * @param {any} str
 * @returns
 */
export function hasEmoji(str) {
    for (let i = 0; i < str.length; i++) {
        let hs = str.charCodeAt(i);
        let ls = '';
        if (0xd800 <= hs && hs <= 0xdbff) {
            if (str.length > 1) {
                ls = str.charCodeAt(i + 1);
                var uc = (hs - 0xd800) * 0x400 + (ls - 0xdc00) + 0x10000;
                if (0x1d000 <= uc && uc <= 0x1f77f) {
                    return true;
                }
            }
        } else if (str.length > 1) {
            ls = str.charCodeAt(i + 1);
            if (ls == 0x20e3) {
                return true;
            }
        } else {
            if (0x2100 <= hs && hs <= 0x27ff) {
                return true;
            } else if (0x2b05 <= hs && hs <= 0x2b07) {
                return true;
            } else if (0x2934 <= hs && hs <= 0x2935) {
                return true;
            } else if (0x3297 <= hs && hs <= 0x3299) {
                return true;
            } else if (
                hs == 0xa9 ||
                hs == 0xae ||
                hs == 0x303d ||
                hs == 0x3030 ||
                hs == 0x2b55 ||
                hs == 0x2b1c ||
                hs == 0x2b1b ||
                hs == 0x2b50
            ) {
                return true;
            }
        }
    }
    return false;
}
