const { Readable, Duplex } = require('stream');
const Dicer = require('dicer');
// win32 version works fine for both linux and windows paths
const { basename } = require('path').win32;
const { parseParams } = require('./utils');

const { debug, debugId } = require('../lib/debug')('streammultipart', 'SM');
const { version } = require('../package.json');

debug('yellow', 'VERSION', `${version}`);

const RE_CONTENT_TYPE = /^multipart\/form-data/i;
const RE_BOUNDARY = /^boundary$/i;
const RE_FIELD = /^form-data$/i;
const RE_CHARSET = /^charset$/i;
const RE_FILENAME = /^filename$/i;
const RE_NAME = /^name$/i;

class FileStream extends Readable {
    constructor(options) {
        super(options);
        this._state = {
            errorEmitted: false,
        };
        this.once('error', (err) => {
            this.error = err;
            if (this.listenerCount('error') > 0) {
                this._state.errorEmitted = true;
            }
        });
        this.once('end', () => {
            if (this.error && !this._state.errorEmitted) {
                this.emit('error', this.error);
            }
        });
    }
}

class Multipart extends Duplex {
    constructor(options) {
        if (!options.headers || typeof options.headers['content-type'] !== 'string') {
            throw new Error('Missing content type');
        }
        if (!RE_CONTENT_TYPE.test(options.headers['content-type'])) {
            throw new Error(`Unsupported content type: ${options.headers['content-type']}`);
        }

        const { defCharset, preservePath, highWaterMark, headers, asyncError, fileMaxListeners } = options;
        const { fieldSize, fileSize, files, fields, parts, headerPairs } = options.limits || {};

        if (highWaterMark !== undefined) {
            super({ readableObjectMode: true, highWaterMark });
        } else {
            super({ readableObjectMode: true });
        }

        this.options = {
            defCharset: defCharset || 'utf8',
            preservePath: preservePath || false,
            fileOptions: typeof highWaterMark === 'number' ? { highWaterMark } : {},

            asyncError: typeof asyncError === 'boolean' ? asyncError : true,
            fileMaxListeners: fileMaxListeners || null,

            fieldSizeLimit: typeof fieldSize === 'number' ? fieldSize : 1024 * 1024,
            fileSizeLimit: typeof fileSize === 'number' ? fileSize : Infinity,
            filesLimit: typeof files === 'number' ? files : Infinity,
            fieldsLimit: typeof fields === 'number' ? fields : Infinity,
            partsLimit: typeof parts === 'number' ? parts : Infinity,
        };

        this._state = {
            counter: {
                parts: 0,
                files: 0,
                fields: 0,
                inProgress: 0,
            },

            trigger: {
                filesLimit: false,
                fieldsLimit: false,
                partsLimit: false,
            },

            finished: false,
            ended: false,
            writableCb: null,
            lastPart: null,
            needDrain: false,
            pause: false,
            warnings: [],
        };

        this.parser = new Dicer({
            boundary: this._parseBoundary(headers),
            maxHeaderPairs: headerPairs,
            partHwm: this.options.fileOptions.highWaterMark,
        });

        this.parser
            .on('part', (part) => {
                this._onPart(part);
            })
            .once('error', (err) => {
                debug('red', 'PARSER ERROR');
                if (this.options.asyncError && !this._state.ended) {
                    this.once('end', () => {
                        this.emit('error', err);
                    });
                } else {
                    this.emit('error', err);
                }
            })
            .once('finish', () => {
                debug('yellow', 'PARSER FINISH');
                // test case: 'Fields only'
                this._state.finished = true;
            });

        this._bindListeners();
    }

    _parseBoundary(headers) {
        const parsedContentType = parseParams(headers['content-type']);
        let boundary;

        for (let i = 0; i < parsedContentType.length; ++i) {
            if (Array.isArray(parsedContentType[i])
                && RE_BOUNDARY.test(parsedContentType[i][0])) {
                boundary = parsedContentType[i][1];
                break;
            }
        }

        if (typeof boundary !== 'string') {
            throw new Error('Multipart: Boundary not found');
        }

        return boundary;
    }

    _bindListeners() {
        this
            .on('file', (file, metadata) => {
                debug('gray', 'FILE PUSH', metadata.filename);
                this.push({ file, metadata });
            })
            .on('field', (field, metadata) => {
                debug('gray', 'FIELD', metadata);
                this.push({ field, metadata });
            })
            .on('filesLimit', () => {
                debug('red', 'FILES LIMIT');
                this._state.warnings.push(new Error('Files limit has been reached'));
            })
            .on('fieldsLimit', () => {
                debug('red', 'FIELDS LIMIT');
                this._state.warnings.push(new Error('Fields limit has been reached'));
            })
            .on('partsLimit', () => {
                debug('red', 'PARTS LIMIT');
                this._state.warnings.push(new Error('Parts limit has been reached'));
            })
            // test case: 'No fields and no files'
            .once('finish', () => {
                debug('yellow', 'FINISH');
                this.parser.end();
                this._state.finished = true;
                this._checkEnded();
            })
            .once('end', () => {
                debug('yellow', 'END');
                this._state.ended = true;
                // emit warnings before end
                for (let i = 0; i < this._state.warnings.length; i++) {
                    this.emit('warning', this._state.warnings[i]);
                }
            });
    }

    _read() {}

    _write(chunk, encoding, cb) {
        this._state.needDrain = !this.parser.write(chunk, () => {
            if (this._state.needDrain) {
                this._state.needDrain = false;
                this._readNext();
            }
        });
        if (!this._state.needDrain && !this._state.pause) {
            cb();
        } else {
            this._state.writableCb = cb;
        }
    }

    _onPart(part) {
        const partId = debugId('part');
        debug('cyan', 'PART START', partId);
        const prevPart = this._state.lastPart;
        this._state.lastPart = part;
        this._state.counter.parts++;
        if (this._state.counter.parts > this.options.partsLimit) {
            this._state.trigger.partsLimit = true;
            this.parser.removeAllListeners('part');
            this.emit('partsLimit');
            part.resume();
        } else {
            part.on('header', header => this._onHeader(part, prevPart, header));
        }

        // test case: 'Stopped mid-header'
        part.once('error', () => {});
        part.once('end', () => {
            this._checkEnded();
            debug('cyan', 'PART END', partId);
        });
    }

    _onHeader(part, prevPart, header) {
        let contentType;
        let fieldname;
        let parsed;
        let charset = 'binary';
        let encoding;
        let filename;

        if (header['content-type']) {
            parsed = parseParams(header['content-type'][0]);
            if (parsed[0]) {
                contentType = parsed[0].toLowerCase();
                for (let i = 0; i < parsed.length; ++i) {
                    if (RE_CHARSET.test(parsed[i][0])) {
                        charset = parsed[i][1].toLowerCase();
                        break;
                    }
                }
            }
        }

        if (contentType === undefined) {
            contentType = 'text/plain';
        }
        // if (charset === undefined) {
        //     charset = this.options.defCharset;
        // }

        if (header['content-disposition']) {
            parsed = parseParams(header['content-disposition'][0]);
            if (!RE_FIELD.test(parsed[0])) {
                return part.resume();
            }
            for (let i = 0; i < parsed.length; ++i) {
                if (RE_NAME.test(parsed[i][0])) {
                    fieldname = parsed[i][1];
                } else if (RE_FILENAME.test(parsed[i][0])) {
                    filename = parsed[i][1];
                    if (!this.options.preservePath) {
                        filename = basename(filename);
                    }
                }
            }
        } else {
            return part.resume();
        }

        if (header['content-transfer-encoding']) {
            encoding = header['content-transfer-encoding'][0].toLowerCase();
        } else {
            encoding = 'binary';
        }

        if (contentType === 'application/octet-stream' || filename !== undefined) {
            this._onFile(part, prevPart, {
                fieldname,
                filename,
                encoding,
                contentType,
                charset,
            });
        } else {
            this._onField(part, prevPart, {
                fieldname,
                encoding,
                contentType,
                charset,
            });
        }
    }

    _onFile(part, prevPart, { fieldname, filename, encoding, contentType, charset }) {
        debug('gray', 'FILE START', filename);

        let fileSize = 0;

        if (this._state.counter.files === this.options.filesLimit) {
            if (!this._state.trigger.filesLimit) {
                this._state.trigger.filesLimit = true;
                this.emit('filesLimit');
            }
            return part.resume();
        }

        this._state.counter.files++;
        this._state.counter.inProgress++;

        const file = new FileStream(Object.assign({
            read: () => {
                if (!this._state.pause) {
                    return;
                }
                this._state.pause = false;
                this._readNext();
            },
        }, this.options.fileOptions));

        if (this.options.fileMaxListeners) {
            file.setMaxListeners(this.options.fileMaxListeners);
        }

        file.once('end', () => {
            debug('gray', 'FILE END', filename);
            this._state.counter.inProgress--;
            this._readNext();
            this._checkEnded();
            process.nextTick(() => {
                file.removeAllListeners();
            });
        });

        this._waitForPartEnd(prevPart, () => {
            this.emit('file', file, {
                fieldname,
                filename,
                encoding,
                contentType,
                charset,
            });
        });

        part.on('data', (data) => {
            fileSize += data.length;
            if (fileSize > this.options.fileSizeLimit) {
                part.removeAllListeners('data');
                part.resume();

                this._waitForPartEnd(prevPart, () => {
                    file.emit('error', new Error('File size limit has been reached'));
                    file.removeAllListeners('data');
                });
            } else {
                this._state.pause = !file.push(data);
            }
        });

        part.once('end', () => {
            file.push(null);
        });
        part.once('error', (err) => {
            this._waitForPartEnd(prevPart, () => {
                file.emit('error', err);
                file.removeAllListeners('data');
            });
        });
    }

    _onField(field, prevPart, { fieldname, encoding, contentType, charset }) {
        let fieldSize = 0;

        if (this._state.counter.fields === this.options.fieldsLimit) {
            if (!this._state.trigger.fieldsLimit) {
                this._state.trigger.fieldsLimit = true;
                this.emit('fieldsLimit');
            }
            return field.resume();
        }

        this._state.counter.fields++;
        this._state.counter.inProgress++;
        let buffer = Buffer.alloc(0);
        let truncated = false;

        field.on('data', (data) => {
            fieldSize += data.length;
            if (fieldSize > this.options.fieldSizeLimit) {
                const extraLen = (this.options.fieldSizeLimit - (fieldSize - data.length));
                buffer = Buffer.concat([buffer, data.slice(0, extraLen)]);
                truncated = true;
                field.removeAllListeners('data');
            } else {
                buffer = Buffer.concat([buffer, data]);
            }
        });

        field.once('end', () => {
            this._waitForPartEnd(prevPart, () => {
                this.emit('field', buffer, { fieldname, truncated, encoding, charset, contentType });
            });
            this._state.counter.inProgress--;
            this._checkEnded();
        });
    }

    _waitForPartEnd(part, cb) {
        if (part && part.readable) {
            part.once('end', cb);
        } else {
            cb();
        }
    }

    _checkEnded() {
        const isEnded = this._state.counter.inProgress === 0 && this._state.finished;
        debug('magenta', 'CHECK ENDED', isEnded, this._state.counter);
        if (isEnded) {
            debug('magenta', 'PUSH NULL');
            this.push(null);
        }
    }

    _readNext() {
        this._state.pause = false;
        if (this._state.writableCb) {
            const cb = this._state.writableCb;
            this._state.writableCb = null;
            cb();
        }
    }
}

module.exports = Multipart;
