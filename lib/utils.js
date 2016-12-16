/* eslint-disable no-continue */

const iconv = require('iconv-lite');

const RE_ENCODED = /%([a-fA-F0-9]{2})/g;

function decodeText(text, encoding, charset) {
    let result;
    if (text && iconv.encodingExists(charset)) {
        try {
            result = iconv.decode(new Buffer(text, encoding), charset);
        } catch (e) {} // eslint-disable-line
    }
    return (typeof result === 'string' ? result : text);
}

const encodedReplacer = (match, byte) => String.fromCharCode(parseInt(byte, 16));

function parseParams(str) {
    const res = [];
    let state = 'key';
    let charset = '';
    let inquote = false;
    let escaping = false;
    let p = 0;
    let tmp = '';

    for (let i = 0, len = str.length; i < len; ++i) {
        if (str[i] === '\\' && inquote) {
            escaping = true;
            continue;
        } else if (str[i] === '"') {
            if (!escaping) {
                if (inquote) {
                    inquote = false;
                    state = 'key';
                } else {
                    inquote = true;
                }
                continue;
            } else {
                escaping = false;
            }
        } else {
            if (escaping && inquote) {
                tmp += '\\';
            }
            escaping = false;
            if ((state === 'charset' || state === 'lang') && str[i] === "'") {
                if (state === 'charset') {
                    state = 'lang';
                    charset = tmp.substring(1);
                } else {
                    state = 'value';
                }
                tmp = '';
                continue;
            } else if (state === 'key'
                && (str[i] === '*' || str[i] === '=')
                && res.length) {
                if (str[i] === '*') {
                    state = 'charset';
                } else {
                    state = 'value';
                }
                res[p] = [tmp, undefined];
                tmp = '';
                continue;
            } else if (!inquote && str[i] === ';') {
                state = 'key';
                if (charset) {
                    if (tmp.length) {
                        tmp = decodeText(tmp.replace(RE_ENCODED, encodedReplacer), 'binary', charset);
                    }
                    charset = '';
                }
                if (res[p] === undefined) {
                    res[p] = tmp;
                } else {
                    res[p][1] = tmp;
                }
                tmp = '';
                ++p;
                continue;
            } else if (!inquote && (str[i] === ' ' || str[i] === '\t')) {
                continue;
            }
        }
        tmp += str[i];
    }
    if (charset && tmp.length) {
        tmp = decodeText(tmp.replace(RE_ENCODED, encodedReplacer), 'binary', charset);
    }

    if (res[p] === undefined) {
        if (tmp) {
            res[p] = tmp;
        }
    } else {
        res[p][1] = tmp;
    }
    return res;
}

module.exports = {
    decodeText,
    parseParams,
};
