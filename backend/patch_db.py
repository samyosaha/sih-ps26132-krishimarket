with open('app/database.py', 'rb') as f:
    content = f.read()

# Try CRLF ending
old_crlf = b'    ],\r\n}\r\n'
if old_crlf in content:
    new = b'    ],\r\n    # Phase 8 -- Fulfillment Recommender\r\n    "offers": [\r\n        ("delivery_district", "VARCHAR"),\r\n    ],\r\n}\r\n'
    content = content.replace(old_crlf, new, 1)
    with open('app/database.py', 'wb') as f:
        f.write(content)
    print('SUCCESS (CRLF)')
else:
    old_lf = b'    ],\n}\n'
    if old_lf in content:
        new = b'    ],\n    # Phase 8 -- Fulfillment Recommender\n    "offers": [\n        ("delivery_district", "VARCHAR"),\n    ],\n}\n'
        content = content.replace(old_lf, new, 1)
        with open('app/database.py', 'wb') as f:
            f.write(content)
        print('SUCCESS (LF)')
    else:
        print('NOT FOUND')
        print(repr(content[-200:]))
