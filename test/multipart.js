const test = require('tape');
const async = require('async');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const StreamMultipart = require('..');
const testData = require('./fixture/test-data');

test('constructor', (t) => {
    t.throws(() => {
        // eslint-disable-next-line no-new
        new StreamMultipart({});
    }, /Missing content type/, 'missing content type');

    t.throws(() => {
        // eslint-disable-next-line no-new
        new StreamMultipart({ headers: { 'content-type': '' } });
    }, /Unsupported content type/, 'unsupported content type');

    t.throws(() => {
        // eslint-disable-next-line no-new
        new StreamMultipart({ headers: { 'content-type': 'multipart/form-data' } });
    }, /Boundary not found/, 'boundary not found');

    t.end();
});

// let testId = 0;
testData.forEach((data) => {
    // if (++testId !== 19) return;
    // test.only(data.what, (t) => {
    test(data.what, (t) => {
        let finishes = 0;
        let warningsCounter = 0;
        const results = [];
        const streamMultipart = new StreamMultipart(Object.assign(
            {
                headers: {
                    'content-type': `multipart/form-data; boundary=${data.boundary}`,
                },
            },
            data.options || {}
        ));

        streamMultipart
            .on('data', ({ file, field, metadata }) => {
                if (file !== undefined) {
                    let size = 0;
                    const info = {
                        file: null,
                        metadata,
                    };
                    results.push(info);
                    file
                        .on('data', (chunk) => {
                            size += chunk.length;
                        })
                        .once('end', () => {
                            info.size = size;
                        })
                        .once('error', (err) => {
                            info.error = err.message;
                        });
                }
                if (field !== undefined) {
                    results.push({
                        field: field.toString(),
                        metadata,
                    });
                }
            })
            .on('finish', () => {
                t.pass('finish emitted');
                if (finishes++ > 0) {
                    t.fail('finish emitted multiple times');
                }
            })
            .on('end', () => {
                t.pass('end emitted');
                t.deepEqual(results.length, data.expected.length, 'result count match');
                results.forEach((result, i) => {
                    t.deepEqual(result, data.expected[i], 'result match');
                });
                if (data.shouldWarn) {
                    t.equal(warningsCounter, data.shouldWarn.length, 'warnings count match');
                }
                t.end();
            })
            .on('error', (err) => {
                if (!data.shouldError || data.shouldError !== err.message) {
                    t.fail(`unexpected error: ${err}`);
                }
            })
            .on('warning', (err) => {
                warningsCounter++;
                t.ok(data.shouldWarn.includes(err.message), 'warning message match');
            });

        if (Buffer.isBuffer(data.source)) {
            streamMultipart.write(data.source);
        } else if (typeof data.source === 'string') {
            streamMultipart.write(new Buffer(data.source, 'utf8'));
        } else {
            data.source.forEach((s) => {
                if (Buffer.isBuffer(s)) {
                    streamMultipart.write(s);
                } else {
                    streamMultipart.write(new Buffer(s, 'utf8'));
                }
            });
        }
        streamMultipart.end();
    });
});

test('back-pressure', (t) => {
    t.plan(8);
    const highWaterMark = 512;
    const fileSize = 1024;
    const chunkSize = 64;
    if (fileSize % chunkSize) {
        t.fail('chunkSize should be a divider of fileSize');
        return t.end();
    }
    const data = {
        header: [
            '',
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="1k_a.dat"',
            'Content-Type: application/octet-stream',
            '\r\n',
        ].join('\r\n'),
        body: 'A'.repeat(chunkSize), // 64 bytes
        footer: '\r\n--boundary--\r\n',
    };
    const streamMultipart = new StreamMultipart({
        headers: {
            'content-type': 'multipart/form-data; boundary=boundary',
        },
        highWaterMark,
    });
    let writtenSize = 0;

    streamMultipart.once('data', ({ file }) => {
        let readSize = 0;
        setTimeout(() => {
            // wait until the buffer is completely filled
            t.ok(writtenSize >= highWaterMark,
                `written data size (${writtenSize}) is gte fileHwm (${highWaterMark})`); // 1
            t.ok(writtenSize <= highWaterMark + chunkSize,
                `written data size (${writtenSize}) is lte fileHwm+chunkSize (${highWaterMark + chunkSize})`); // 2
            // read one chunk
            readSize = file.read().length;
            t.ok(readSize >= highWaterMark, `read data size (${readSize}) is gte fileHwm (${highWaterMark})`); // 3
            // switch to flowing mode
            file
                .on('data', (chunk) => {
                    readSize += chunk.length;
                })
                .once('end', () => {
                    t.equal(readSize, 1024, 'file size match'); // 4
                    t.pass('file end emitted'); // 5
                });
        }, 50);
    });

    streamMultipart.write(new Buffer(data.header, 'utf8'));

    async.timesSeries(fileSize / chunkSize, (n, c) => {
        const chunk = new Buffer(data.body, 'utf8');
        writtenSize += chunk.length;
        streamMultipart.write(chunk, c);
    }, () => {
        t.equal(writtenSize, fileSize, 'written size match'); // 6
        streamMultipart
            .once('finish', () => {
                t.pass('stream finish emitted'); // 7
            })
            .once('end', () => {
                t.pass('stream end emitted'); // 8
            });
        streamMultipart.end(new Buffer(data.footer, 'utf8'));
    });
});

test('sync file stream reading (error handling)', (t) => {
    t.plan(6);
    const data = {
        header: [
            '',
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="1k_a.dat"',
            'Content-Type: application/octet-stream',
            '\r\n',
        ].join('\r\n'),
        body: 'A'.repeat(1024),
        // footer: '\r\n--boundary--\r\n',
    };
    const streamMultipart = new StreamMultipart({
        headers: {
            'content-type': 'multipart/form-data; boundary=boundary',
        },
        asyncError: false,
    });

    streamMultipart
        .on('data', ({ file }) => {
            let readSize = 0;
            file.once('error', (err) => {
                t.ok(err.message.includes('Part terminated early due to unexpected end of multipart data'),
                    'last chunk unexpected end error'); // 1
            });
            file.on('data', (chunk) => {
                readSize += chunk.length;
            });
            file.once('end', () => {
                t.equal(readSize, 1024, 'file size match'); // 2
                t.pass('file end emitted'); // 3
            });
        })
        .once('error', (err) => {
            t.equal(err.message, 'Unexpected end of multipart data', 'stream error: unexpected end'); // 4
        })
        .once('finish', () => {
            t.pass('stream finish emitted'); // 5
        })
        .once('end', () => {
            t.pass('stream end emitted'); // 6
        });

    streamMultipart.write(new Buffer(data.header, 'utf8'));
    streamMultipart.end(new Buffer(data.body, 'utf8'));
});

test('async file stream reading (error handling)', (t) => {
    t.plan(6);
    const data = {
        header: [
            '',
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="1k_a.dat"',
            'Content-Type: application/octet-stream',
            '\r\n',
        ].join('\r\n'),
        body: 'A'.repeat(1024),
        // footer: '\r\n--boundary--\r\n',
    };
    const streamMultipart = new StreamMultipart({
        headers: {
            'content-type': 'multipart/form-data; boundary=boundary',
        },
    });

    streamMultipart
        .on('data', ({ file }) => {
            let readSize = 0;
            setTimeout(() => {
                file.once('error', (err) => {
                    t.ok(err.message.includes('Part terminated early due to unexpected end of multipart data'),
                        'last chunk unexpected end error'); // 1
                });
                file.on('data', (chunk) => {
                    readSize += chunk.length;
                });
                file.once('end', () => {
                    t.equal(readSize, 1024, 'file size match'); // 2
                    t.pass('file end emitted'); // 3
                });
            }, 100);
        })
        .once('error', (err) => {
            t.equal(err.message, 'Unexpected end of multipart data', 'stream error: unexpected end'); // 4
        })
        .once('finish', () => {
            t.pass('stream finish emitted'); // 5
        })
        .once('end', () => {
            t.pass('stream end emitted'); // 6
        });

    streamMultipart.write(new Buffer(data.header, 'utf8'));
    streamMultipart.end(new Buffer(data.body, 'utf8'));
});

test('form data pipe', (t) => {
    t.plan(5);
    const form = new FormData();
    const streamMultipart = new StreamMultipart({ headers: form.getHeaders() });
    const fileStream = fs.createReadStream(path.join(__dirname, 'samples', '8px-htc-desire.jpg'));
    let readSize = 0;

    form.append('file', fileStream);
    form.pipe(streamMultipart);

    form
        .once('end', () => {
            t.pass('form end emitted'); // 1
        });

    streamMultipart
        .once('finish', () => {
            t.pass('stream finish emitted'); // 2
        })
        .on('data', (data) => {
            data.file.on('data', (chunk) => {
                readSize += chunk.length;
            });
            data.file.once('end', () => {
                t.pass('file end emitted'); // 3
            });
        })
        .once('end', () => {
            t.pass('stream end emitted'); // 4
            t.equal(readSize, fileStream.bytesRead, 'read size match file size'); // 5
        });
});
