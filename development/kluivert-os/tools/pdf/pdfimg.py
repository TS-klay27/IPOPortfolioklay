"""Extract the single page image of a certificate PDF to BMP, or rebuild the PDF with a JPEG image.
Only the image XObject is replaced; every other object is copied byte-for-byte.
Usage:
  python pdfimg.py extract <in.pdf> <out.bmp>          -> prints JSON meta
  python pdfimg.py rebuild <in.pdf> <img.jpg> <w> <h> <out.pdf>
  python pdfimg.py check   <pdf>                        -> validates xref/offsets, prints JSON
"""
import re, sys, zlib, json, struct

OBJ_RE = re.compile(rb'(\d+)\s+(\d+)\s+obj(.*?)endobj', re.S)

def objects(b):
    return [(int(m.group(1)), int(m.group(2)), m.group(3)) for m in OBJ_RE.finditer(b)]

def stream_of(body):
    d, rest = body.split(b'stream', 1)
    if rest.startswith(b'\r\n'): rest = rest[2:]
    elif rest.startswith(b'\n') or rest.startswith(b'\r'): rest = rest[1:]
    L = int(re.search(rb'/Length\s+(\d+)', d).group(1))
    return d, rest[:L]

def find_image(objs):
    hits = [o for o in objs if b'/Subtype/Image' in o[2].split(b'stream')[0].replace(b' ', b'')]
    if len(hits) != 1: raise SystemExit(f'expected exactly 1 image, found {len(hits)}')
    return hits[0]

def extract(pdf, bmp):
    b = open(pdf, 'rb').read()
    num, gen, body = find_image(objects(b))
    d, data = stream_of(body)
    g = lambda k: int(re.search(rb'/' + k + rb'\s+(\d+)', d).group(1))
    W, H, bpc = g(b'Width'), g(b'Height'), g(b'BitsPerComponent')
    assert b'/FlateDecode' in d and b'DecodeParms' not in d and bpc == 8, 'unexpected image encoding'
    raw = zlib.decompress(data)
    assert len(raw) == W * H * 3, f'pixel data size {len(raw)} != {W*H*3}'
    row = W * 3; pad = (4 - row % 4) % 4
    with open(bmp, 'wb') as f:
        size = 54 + (row + pad) * H
        f.write(b'BM' + struct.pack('<IHHI', size, 0, 0, 54))
        f.write(struct.pack('<IiiHHIIiiII', 40, W, H, 1, 24, 0, (row + pad) * H, 2835, 2835, 0, 0))
        for y in range(H - 1, -1, -1):
            r = bytearray(raw[y * row:(y + 1) * row]); r[0::3], r[2::3] = r[2::3], r[0::3]  # RGB -> BGR
            f.write(r); f.write(b'\0' * pad)
    mb = re.search(rb'/MediaBox\s*\[([^\]]+)\]', b).group(1).split()
    print(json.dumps({'obj': num, 'W': W, 'H': H, 'mediabox': [float(x) for x in mb], 'size': len(b)}))

def rebuild(pdf, jpg, w, h, out):
    b = open(pdf, 'rb').read()
    objs = objects(b)
    num, gen, body = find_image(objs)
    d, _ = stream_of(body)
    jp = open(jpg, 'rb').read()
    assert jp[:2] == b'\xff\xd8', 'not a JPEG'
    # Keep every key of the original image dictionary except size/encoding ones.
    nd = d.decode('latin1')
    nd = re.sub(r'/Width\s+\d+', f'/Width {w}', nd)
    nd = re.sub(r'/Height\s+\d+', f'/Height {h}', nd)
    nd = re.sub(r'/Length\s+\d+', f'/Length {len(jp)}', nd)
    nd = nd.replace('/Filter/FlateDecode', '/Filter/DCTDecode').replace('/Filter /FlateDecode', '/Filter /DCTDecode')
    assert '/DCTDecode' in nd
    new_body = nd.encode('latin1') + b'stream\n' + jp + b'\nendstream\n'
    header = b[:b.index(b'1 0 obj')] if b'1 0 obj' in b else b'%PDF-1.7\n%\xb5\xb6\n\n'
    trailer = re.search(rb'trailer\s*(<<.*?>>)\s*startxref', b, re.S).group(1)
    outb = bytearray(header); offs = {}
    for n, g_, bd in objs:
        offs[n] = len(outb)
        outb += f'{n} {g_} obj'.encode() + (new_body if n == num else bd) + b'endobj\n'
    size = max(offs) + 1
    xref = len(outb)
    outb += f'xref\n0 {size}\n0000000000 65535 f \n'.encode()
    for i in range(1, size):
        outb += (f'{offs[i]:010d} 00000 n \n' if i in offs else '0000000000 65535 f \n').encode()
    outb += b'trailer\n' + trailer + f'\nstartxref\n{xref}\n%%EOF\n'.encode()
    open(out, 'wb').write(outb)
    print(json.dumps({'out': out, 'size': len(outb)}))

def check(pdf):
    b = open(pdf, 'rb').read()
    res = {'header': b[:8].decode('latin1'), 'eof': b.rstrip().endswith(b'%%EOF')}
    sx = int(re.findall(rb'startxref\s+(\d+)', b)[-1]); res['startxref_ok'] = b[sx:sx + 4] == b'xref'
    rows = re.findall(rb'(\d{10}) (\d{5}) ([nf])', b[sx:])
    bad = [i for i, (o, g, t) in enumerate(rows) if t == b'n' and not re.match(rb'\s*%d\s+0\s+obj' % i, b[int(o):int(o) + 20])]
    res['xref_entries'] = len(rows); res['xref_bad'] = bad
    objs = objects(b); res['objects'] = len(objs)
    res['pages'] = len(re.findall(rb'/Type\s*/Page[^s]', b))
    num, gen, body = find_image(objs); d, data = stream_of(body)
    res['image_filter'] = 'DCT' if b'DCTDecode' in d else 'Flate'
    res['image_length_ok'] = len(data) == int(re.search(rb'/Length\s+(\d+)', d).group(1)) and (data[:2] == b'\xff\xd8' if b'DCTDecode' in d else True)
    res['mediabox'] = re.search(rb'/MediaBox\s*\[([^\]]+)\]', b).group(1).decode()
    print(json.dumps(res))

if __name__ == '__main__':
    a = sys.argv
    {'extract': lambda: extract(a[2], a[3]), 'rebuild': lambda: rebuild(a[2], a[3], int(a[4]), int(a[5]), a[6]), 'check': lambda: check(a[2])}[a[1]]()
