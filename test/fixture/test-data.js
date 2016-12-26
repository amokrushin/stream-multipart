module.exports = [
    // 1
    {
        source: [
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="1k_a.dat"',
            'Content-Type: application/octet-stream',
            '',
            'A'.repeat(1024),
            '--boundary--',
        ].join('\r\n'),
        boundary: 'boundary',
        expected: [
            {
                file: null,
                metadata: {
                    charset: 'binary',
                    encoding: 'binary',
                    fieldname: 'file',
                    filename: '1k_a.dat',
                    contentType: 'application/octet-stream',
                },
                size: 1024,
            },
        ],
        what: '1. Only file',
    },
    // 2
    {
        source: [
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="file_name_0"',
            '',
            'super alpha file',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="file_name_1"',
            '',
            'super beta file',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_0"; filename="1k_a.dat"',
            'Content-Type: application/octet-stream',
            '',
            'A'.repeat(1024),
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_1"; filename="1k_b.dat"',
            'Content-Type: application/octet-stream',
            '',
            'B'.repeat(1024),
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k--',
        ].join('\r\n'),
        boundary: '---------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
        expected: [
            {
                field: 'super alpha file',
                metadata: {
                    charset: 'binary',
                    contentType: 'text/plain',
                    encoding: 'binary',
                    fieldname: 'file_name_0',
                    truncated: false,
                },
            },
            {
                field: 'super beta file',
                metadata: {
                    charset: 'binary',
                    contentType: 'text/plain',
                    encoding: 'binary',
                    fieldname: 'file_name_1',
                    truncated: false,
                },
            },
            {
                file: null,
                metadata: {
                    charset: 'binary',
                    encoding: 'binary',
                    fieldname: 'upload_file_0',
                    filename: '1k_a.dat',
                    contentType: 'application/octet-stream',
                },
                size: 1024,
            },
            {
                file: null,
                metadata: {
                    charset: 'binary',
                    encoding: 'binary',
                    fieldname: 'upload_file_1',
                    filename: '1k_b.dat',
                    contentType: 'application/octet-stream',
                },
                size: 1024,
            },
        ],
        what: '2. Fields and files',
    },
    // 3
    {
        source: [
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY',
            'Content-Disposition: form-data; name="cont"',
            '',
            'some random content',
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY',
            'Content-Disposition: form-data; name="pass"',
            '',
            'some random pass',
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY',
            'Content-Disposition: form-data; name="bit"',
            '',
            '2',
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY--',
        ].join('\r\n'),
        boundary: '----WebKitFormBoundaryTB2MiQ36fnSJlrhY',
        expected: [
            {
                field: 'some random content',
                metadata: {
                    fieldname: 'cont',
                    charset: 'binary',
                    contentType: 'text/plain',
                    encoding: 'binary',
                    truncated: false,
                },
            },
            {
                field: 'some random pass',
                metadata: {
                    fieldname: 'pass',
                    charset: 'binary',
                    contentType: 'text/plain',
                    encoding: 'binary',
                    truncated: false,
                },
            },
            {
                field: '2',
                metadata: {
                    fieldname: 'bit',
                    charset: 'binary',
                    contentType: 'text/plain',
                    encoding: 'binary',
                    truncated: false,
                },
            },
        ],
        what: '3. Fields only',
    },
    // 4
    {
        source: '',
        boundary: '----WebKitFormBoundaryTB2MiQ36fnSJlrhY',
        expected: [],
        shouldError: 'Unexpected end of multipart data',
        what: '4. No fields and no files',
    },
    // 5
    {
        source: [
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="file_name_0"',
            '',
            'super alpha file',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_0"; filename="1k_a.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k--',
        ].join('\r\n'),
        boundary: '---------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
        options: {
            limits: {
                fileSize: 13,
                fieldSize: 5,
            },
        },
        expected: [
            {
                field: 'super',
                metadata: {
                    fieldname: 'file_name_0',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'text/plain',
                    truncated: true,
                },
            },
            {
                file: null,
                metadata: {
                    fieldname: 'upload_file_0',
                    filename: '1k_a.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 0,
                error: 'File size limit has been reached',
            },
        ],
        what: '5. fields and files (limits)',
    },
    // 6
    {
        source: [
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="file_name_0"',
            '',
            'super alpha file',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_0"; filename="1k_a.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k--',
        ].join('\r\n'),
        boundary: '---------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
        options: {
            limits: {
                files: 0,
            },
        },
        expected: [
            {
                field: 'super alpha file',
                metadata: {
                    fieldname: 'file_name_0',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'text/plain',
                    truncated: false,
                },
            },
        ],
        shouldWarn: [
            'Files limit has been reached',
        ],
        what: '6. Fields and files (limits: 0 files)',
    },
    // 7
    {
        source: [
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_0"; filename="/tmp/1k_a.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_1"; filename="C:\\files\\1k_b.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_2"; filename="relative/1k_c.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k--',
        ].join('\r\n'),
        boundary: '---------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
        expected: [
            {
                file: null,
                metadata: {
                    fieldname: 'upload_file_0',
                    filename: '1k_a.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 26,
            },
            {
                file: null,
                metadata: {
                    fieldname: 'upload_file_1',
                    filename: '1k_b.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 26,
            },
            {
                file: null,
                metadata: {
                    fieldname: 'upload_file_2',
                    filename: '1k_c.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 26,
            },
        ],
        what: '7. Files with filenames containing paths',
    },
    // 8
    {
        source: [
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_0"; filename="/absolute/1k_a.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_1"; filename="C:\\absolute\\1k_b.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
            'Content-Disposition: form-data; name="upload_file_2"; filename="relative/1k_c.dat"',
            'Content-Type: application/octet-stream',
            '',
            'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            '-----------------------------paZqsnEHRufoShdX6fh0lUhXBP4k--',
        ].join('\r\n'),
        boundary: '---------------------------paZqsnEHRufoShdX6fh0lUhXBP4k',
        options: {
            preservePath: true,
        },
        expected: [
            {
                file: null,
                metadata: {
                    fieldname: 'upload_file_0',
                    filename: '/absolute/1k_a.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 26,
            },
            {
                file: null,
                metadata: {
                    fieldname: 'upload_file_1',
                    filename: 'C:\\absolute\\1k_b.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 26,
            },
            {
                file: null,
                metadata: {
                    fieldname: 'upload_file_2',
                    filename: 'relative/1k_c.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 26,
            },
        ],
        what: '8. Paths to be preserved through the preservePath option',
    },
    // 9
    {
        source: [
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY',
            'Content-Disposition: form-data; name="cont"',
            'Content-Type: ',
            '',
            'some random content',
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY',
            'Content-Disposition: ',
            '',
            'some random pass',
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY--',
        ].join('\r\n'),
        boundary: '----WebKitFormBoundaryTB2MiQ36fnSJlrhY',
        expected: [
            {
                field: 'some random content',
                metadata: {
                    fieldname: 'cont',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'text/plain',
                    truncated: false,
                },
            },
        ],
        what: '9. Empty content-type and empty content-disposition',
    },
    // 10
    {
        source: [
            '--asdasdasdasd\r\n',
            'Content-Type: text/plain\r\n',
            'Content-Disposition: form-data; name="foo"\r\n',
            '\r\n',
            'asd\r\n',
            '--asdasdasdasd--',
        ].join(':)'),
        boundary: 'asdasdasdasd',
        expected: [],
        shouldError: 'Unexpected end of multipart data',
        what: '10. Stopped mid-header',
    },
    // 11
    {
        source: [
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY',
            'Content-Disposition: form-data; name="cont"',
            'Content-Type: application/json',
            '',
            '{}',
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY--',
        ].join('\r\n'),
        boundary: '----WebKitFormBoundaryTB2MiQ36fnSJlrhY',
        expected: [
            {
                field: '{}',
                metadata: {
                    fieldname: 'cont',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/json',
                    truncated: false,
                },
            },
        ],
        what: '11. Content-type for fields',
    },
    // 12
    {
        source: '------WebKitFormBoundaryTB2MiQ36fnSJlrhY--\r\n',
        boundary: '----WebKitFormBoundaryTB2MiQ36fnSJlrhY',
        expected: [],
        what: '12. Empty form',
    },
    // 13
    {
        source: [
            '--boundary-8bVxRyJ1L2HS',
            'Content-Disposition: form-data; name="file"; filename="file-1.raw',
            'Content-Type: application/octet-stream',
            '',
            '0123456789',
            '--boundary-8bVxRyJ1L2HS',
            'Content-Disposition: form-data; name="file"; filename="file-2.raw',
            'Content-Type: application/octet-stream',
            '',
            '01234567890123456789',
            // '--boundary-8bVxRyJ1L2HS--',
        ].join('\r\n'),
        boundary: 'boundary-8bVxRyJ1L2HS',
        expected: [
            {
                file: null,
                metadata: {
                    fieldname: 'file',
                    filename: 'file-1.raw',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 10,
            },
            {
                file: null,
                metadata: {
                    fieldname: 'file',
                    filename: 'file-2.raw',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 0,
                error: 'Part terminated early due to unexpected end of multipart data',
            },
        ],
        shouldError: 'Unexpected end of multipart data',
        what: '13. Incomplete multipart',
    },
    // 14
    {
        source: [
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY',
            'name="cont"',
            'Content-Type: application/json',
            '',
            '{}',
            '------WebKitFormBoundaryTB2MiQ36fnSJlrhY--',
        ].join('\r\n'),
        boundary: '----WebKitFormBoundaryTB2MiQ36fnSJlrhY',
        expected: [],
        what: '14. No content disposition',
    },
    // 15
    {
        source: [
            '--frontier',
            'Content-Disposition: form-data; name="file"; filename="base64.dat',
            'Content-Type: application/octet-stream',
            'Content-Transfer-Encoding: base64',
            '',
            [
                'PGh0bWw+CiAgPGhlYWQ+CiAgPC9oZWFkPgogIDxib2R5PgogICAgPHA+VGhpcyBpcyB0aGUg',
                'Ym9keSBvZiB0aGUgbWVzc2FnZS48L3A+CiAgPC9ib2R5Pgo8L2h0bWw+Cg==',
            ].join(''),
            '--frontier--',
        ].join('\r\n'),
        boundary: 'frontier',
        expected: [
            {
                file: null,
                metadata: {
                    fieldname: 'file',
                    filename: 'base64.dat',
                    encoding: 'base64',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 132,
            },
        ],
        what: '15. Content transfer encoding base64 (decoder = null)',
        options: {
            decoder: null,
        },
    },
    // 16
    {
        source: [
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="80b-1.dat"',
            'Content-Type: application/octet-stream',
            '',
            'A'.repeat(80),
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="80b-2.dat"',
            'Content-Type: application/octet-stream',
            '',
            'A'.repeat(80),
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="80b-3.dat"',
            'Content-Type: application/octet-stream',
            '',
            'A'.repeat(80),
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="80b-4.dat"',
            'Content-Type: application/octet-stream',
            '',
            'A'.repeat(80),
            '--boundary',
            'Content-Disposition: form-data; name="field-1"',
            '',
            'field 1 value',
            '--boundary',
            'Content-Disposition: form-data; name="field-2"',
            '',
            'field 2 value',
            '--boundary',
            'Content-Disposition: form-data; name="field-3"',
            '',
            'field-3 value',
            '--boundary',
            'Content-Disposition: form-data; name="field-4"',
            '',
            'field-4 value',
            '--boundary--',
        ].join('\r\n'),
        boundary: 'boundary',
        options: {
            limits: {
                files: 2,
                fields: 2,
            },
        },
        expected: [
            {
                file: null,
                metadata: {
                    fieldname: 'file',
                    filename: '80b-1.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 80,
            },
            {
                file: null,
                metadata: {
                    fieldname: 'file',
                    filename: '80b-2.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 80,
            },
            {
                field: 'field 1 value',
                metadata: {
                    fieldname: 'field-1',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'text/plain',
                    truncated: false,
                },
            },
            {
                field: 'field 2 value',
                metadata: {
                    fieldname: 'field-2',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'text/plain',
                    truncated: false,
                },
            },
        ],
        shouldWarn: [
            'Files limit has been reached',
            'Fields limit has been reached',
        ],
        what: '16. Files and fields count limit',
    },
    // 17
    {
        source: [
            // field
            '--boundary',
            'Content-Disposition: form-data; name="field-1"',
            '',
            'field 1 value',
            // file
            '--boundary',
            'Content-Disposition: form-data; name="file"; filename="80b-1.dat"',
            'Content-Type: application/octet-stream',
            '',
            'A'.repeat(80),
            // field
            '--boundary',
            'Content-Disposition: form-data; name="field-2"',
            '',
            'field 2 value',
            '--boundary--',
        ].join('\r\n'),
        boundary: 'boundary',
        options: {
            limits: {
                parts: 2,
            },
        },
        expected: [
            {
                field: 'field 1 value',
                metadata: {
                    fieldname: 'field-1',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'text/plain',
                    truncated: false,
                },
            },
            {
                file: null,
                metadata: {
                    fieldname: 'file',
                    filename: '80b-1.dat',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'application/octet-stream',
                },
                size: 80,
            },
        ],
        shouldWarn: [
            'Parts limit has been reached',
        ],
        what: '17. Parts limit',
    },
    // 18
    {
        source: [
            '--boundary',
            'Content-Disposition: form-data; name="field-1"',
            '',
            '',
            '--boundary--',
        ].join('\r\n'),
        boundary: 'boundary',
        expected: [
            {
                field: '',
                metadata: {
                    fieldname: 'field-1',
                    encoding: 'binary',
                    charset: 'binary',
                    contentType: 'text/plain',
                    truncated: false,
                },
            },
        ],
        what: '18. Only empty field',
    },
    // 19
    {
        source: [
            '--boundary\r\n',
            'Content-Disposition: form-data; name="field-1"\r\n',
            'Content-Type: text/plain; charset=koi8-r\r\n',
            '\r\n',
            'field 1 value',
            '\r\n',
            '--boundary--',
        ],
        boundary: 'boundary',
        expected: [
            {
                field: 'field 1 value',
                metadata: {
                    fieldname: 'field-1',
                    encoding: 'binary',
                    charset: 'koi8-r',
                    contentType: 'text/plain',
                    truncated: false,
                },
            },
        ],
        what: '19. Field charset',
    },
    // 19
    // {
    //     source: [
    //         '--boundary\r\n',
    //         'Content-Disposition: form-data; name="field-1"\r\n',
    //         'Content-Type: text/plain; charset=koi8-r\r\n',
    //         '\r\n',
    //         Buffer.from('c1c2d7c7c4c5a3d6dac9cacbcccdcfced0d2d3d4d5c6c8c3dedbdddfd9d8dcc0d1', 'hex'),
    //         '\r\n',
    //         '--boundary--',
    //     ],
    //     boundary: 'boundary',
    //     expected: [
    //         ['field', 'field-1', 'абвгдеёжзийклмонпрстуфхцчшщъыьэюя', false, 'binary', 'text/plain', null],
    //     ],
    //     what: '19. KOI8-R charset',
    // },
    // 20
    // {
    //     source: [
    //         '--boundary',
    //         'Content-Disposition: form-data; name="field-1"',
    //         'Content-Type: text/plain; charset=invalid',
    //         '',
    //         'field 1 value',
    //         '--boundary--',
    //     ].join('\r\n'),
    //     boundary: 'boundary',
    //     expected: [
    //         ['field', 'field-1', '', false, 'binary', 'text/plain', 'Unsupported charset'],
    //     ],
    //     what: '20. Unsupported charset',
    // },
    // 21
    // {
    //     source: [
    //         '--boundary\r\n',
    //         'Content-Disposition: form-data; name="field-1"\r\n',
    //         'Content-Type: text/plain; charset=koi8-r\r\n',
    //         'Content-Transfer-Encoding: base64\r\n',
    //         '\r\n',
    //         'wcLXx8TFo9baycrLzM3PztDS09TVxsjD3tvd39nY3MDR',
    //         '\r\n',
    //         '--boundary--',
    //     ],
    //     boundary: 'boundary',
    //     expected: [
    //         ['field', 'field-1', 'абвгдеёжзийклмонпрстуфхцчшщъыьэюя', false, 'base64', 'text/plain', null],
    //     ],
    //     what: '21. KOI8-R charset in base64 encoding',
    // },
    // 22
    // {
    //     source: [
    //         '--boundary\r\n',
    //         'Content-Disposition: form-data; name="field-1"\r\n',
    //         'Content-Type: text/plain; charset=koi8-r\r\n',
    //         'Content-Transfer-Encoding: invalid\r\n',
    //         '\r\n',
    //         'wcLXx8TFo9baycrLzM3PztDS09TVxsjD3tvd39nY3MDR',
    //         '\r\n',
    //         '--boundary--',
    //     ],
    //     boundary: 'boundary',
    //     expected: [
    //         ['field', 'field-1', '', false, 'invalid', 'text/plain',
    //             'Unsupported encoding'],
    //     ],
    //     what: '22. Invalid encoding',
    // },
    // 23
    // {
    //     source: [
    //         '--boundary',
    //         'Content-Disposition: form-data; name="file"; filename="1px.png"',
    //         'Content-Type: image/png',
    //         'Content-Transfer-Encoding: base64',
    //         '',
    //         'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVQYV2P4DwABAQEAWk1v8QAAAABJRU5ErkJggg==',
    //         '--boundary--',
    //     ].join('\r\n'),
    //     boundary: 'boundary',
    //     expected: [
    //         ['file', 'file', 67, 0, '1px.png', 'binary', 'image/png', null],
    //     ],
    //     what: '23. File in base64 encoding',
    // },
];

