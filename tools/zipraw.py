"""Count backslash vs slash entry names by scanning the raw zip bytes (Python hides the difference when reading)."""
import sys
BS = chr(92).encode()
for p in sys.argv[1:]:
    d = open(p, 'rb').read()
    print(p.split('/')[-1], '| names with backslash:', d.count(b'Suite' + BS) + d.count(b'test' + BS), '| with slash:', d.count(b'Suite/') + d.count(b'test/'))
