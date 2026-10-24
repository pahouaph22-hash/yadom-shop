"""Ya Dom Hom Lao logo generator — all text converted to vector paths (no font needed to view)."""
import math, os
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(HERE, 'fonts')
OUT = os.path.join(HERE, 'out')
os.makedirs(OUT, exist_ok=True)

JADE, JADE_D, JADE_L, GOLD, GOLD_L, CREAM = '#0F4C3A', '#0A3529', '#2F7D5B', '#D9A62E', '#F2CF6B', '#FBF6EA'

_cache = {}
def font(name, wght, wdth=100):
    key = (name, wght, wdth)
    if key in _cache: return _cache[key]
    path = os.path.join(F, name + '.ttf')
    tt = TTFont(path)
    axes = {a.axisTag for a in tt['fvar'].axes}
    loc = {'wght': wght}
    if 'wdth' in axes: loc['wdth'] = wdth
    inst = instantiateVariableFont(tt, loc)
    tmp = os.path.join(F, f'_{name}_{wght}_{wdth}.ttf'); inst.save(tmp)
    tt2 = TTFont(tmp)
    blob = hb.Blob.from_file_path(tmp)
    hbf = hb.Font(hb.Face(blob))
    _cache[key] = (tt2, hbf, tt2['head'].unitsPerEm)
    return _cache[key]

def shape(text, f, size, tracking=0):
    """returns list of (glyphname, x_offset_px, y_offset_px, advance_px) and total width"""
    tt, hbf, upem = f
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(hbf, buf, {'kern': True, 'liga': True})
    s = size / upem
    order = tt.getGlyphOrder()
    out, x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        g = order[info.codepoint]
        adv = pos.x_advance * s + (tracking if pos.x_advance else 0)
        out.append((g, x + pos.x_offset * s, pos.y_offset * s, adv))
        x += adv
    return out, x - (tracking if out else 0)

def glyph_path(f, g, size, tx, ty, rot=0, cx=0, cy=0):
    """SVG path for glyph g, scaled to size, origin at (tx,ty), optional rotation (deg) about (tx,ty)."""
    tt, _, upem = f
    gs = tt.getGlyphSet()
    pen = SVGPathPen(gs)
    s = size / upem
    a = math.radians(rot)
    ca, sa = math.cos(a), math.sin(a)
    # font y-up -> svg y-down, then rotate, then translate
    m = (s * ca, s * sa, s * sa * 1, -s * ca, tx, ty)
    m = (s * ca, s * sa, s * sa, -s * ca, tx, ty)
    # rotation matrix applied to (x*s, -y*s): [ca -sa; sa ca]
    xx, xy = s * ca, s * sa       # x' = xx*X + yx*Y + dx ; X,Y font units
    yx, yy = s * sa, -s * ca      # careful: SVG transform matrix (a b c d e f)
    tp = TransformPen(pen, (s * ca, s * sa, s * sa, -s * ca, tx, ty))
    gs[g].draw(tp)
    return pen.getCommands()

def text_path(text, fname, wght, size, x, y, anchor='middle', tracking=0, wdth=100):
    f = font(fname, wght, wdth)
    glyphs, w = shape(text, f, size, tracking)
    x0 = x - (w / 2 if anchor == 'middle' else w if anchor == 'end' else 0)
    d = []
    for g, gx, gy, _ in glyphs:
        d.append(glyph_path(f, g, size, x0 + gx, y - gy))
    return ' '.join(d), w

def arc_text(text, fname, wght, size, cx, cy, r, center_deg, tracking=0, bottom=False):
    """Text along a circle. center_deg: 0 = top (12 o'clock), clockwise. bottom=True reads left->right along the bottom."""
    f = font(fname, wght)
    glyphs, w = shape(text, f, size, tracking)
    d = []
    for g, gx, gy, adv in glyphs:
        mid = gx + adv / 2 - w / 2                 # distance from text centre along arc
        if not bottom:
            ang = center_deg + math.degrees(mid / r)
            th = math.radians(ang)
            px, py = cx + r * math.sin(th), cy - r * math.cos(th)
            rot = ang
        else:
            ang = center_deg - math.degrees(mid / r)
            th = math.radians(ang)
            px, py = cx + r * math.sin(th), cy - r * math.cos(th)
            rot = ang - 180
        # place glyph so its horizontal centre sits at (px,py) on the baseline
        a = math.radians(rot)
        ox, oy = -adv / 2 * math.cos(a), -adv / 2 * math.sin(a)
        if adv:
            d.append(glyph_path(f, g, size, px + ox, py + oy, rot))
    return ' '.join(d)

# ---------------------------------------------------------------- artwork pieces
def petal(rot, scale=1.0):
    # asymmetric frangipani petal (pinwheel), drawn pointing up from the centre
    return (f'<path transform="rotate({rot}) scale({scale})" '
            'd="M0,0 C18,-12 52,-58 46,-102 C40,-140 2,-150 -22,-128 C-44,-106 -38,-62 -16,-30 C-10,-20 -6,-10 0,0 Z"/>')

def frangipani(x, y, s=1.0, stroke=JADE, center='url(#fc)', petal_fill='url(#pf)', sw=3.2):
    petals = ''.join(petal(i * 72 + 8) for i in range(5))
    return f'''<g transform="translate({x},{y}) scale({s})">
  <g fill="{petal_fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round">{petals}</g>
  <circle r="20" fill="{center}"/>
  <g stroke="{GOLD}" stroke-width="2.4" stroke-linecap="round" opacity=".55">
    {''.join(f'<line x1="0" y1="0" x2="0" y2="-46" transform="rotate({i*72+20})"/>' for i in range(5))}
  </g>
</g>'''

def leaf(x, y, rot, s=1.0):
    return f'''<g transform="translate({x},{y}) rotate({rot}) scale({s})">
  <path d="M0,0 C30,-30 40,-95 0,-150 C-40,-95 -30,-30 0,0 Z" fill="url(#lf)" stroke="{JADE_D}" stroke-width="2"/>
  <path d="M0,-6 C2,-50 2,-100 0,-140" stroke="#CFE8D9" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>
  <g stroke="#CFE8D9" stroke-width="2" fill="none" opacity=".55" stroke-linecap="round">
    <path d="M1,-40 C10,-50 16,-58 20,-68"/><path d="M1,-70 C10,-80 15,-88 18,-98"/>
    <path d="M-1,-55 C-10,-64 -15,-72 -18,-82"/><path d="M-1,-88 C-9,-97 -13,-104 -15,-112"/>
  </g>
</g>'''

def knot(x, y, s=1.0, fill=GOLD):
    # Lao knot-inspired motif (from the product label): centre diamond + 4 small diamonds
    d = lambda cx, cy, r: f'M{cx},{cy-r} L{cx+r},{cy} L{cx},{cy+r} L{cx-r},{cy} Z'
    return (f'<g transform="translate({x},{y}) scale({s})" fill="{fill}">'
            f'<path d="{d(0,0,9)}"/><path d="{d(0,-15,4.5)}"/><path d="{d(15,0,4.5)}"/>'
            f'<path d="{d(0,15,4.5)}"/><path d="{d(-15,0,4.5)}"/></g>')

DEFS = f'''<defs>
  <radialGradient id="pf" cx="0" cy="0" r="150" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#F7C948"/><stop offset=".28" stop-color="#FCE7A6"/><stop offset=".5" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF"/>
  </radialGradient>
  <radialGradient id="fc" cx="0" cy="0" r="22" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#F5B82E"/><stop offset="1" stop-color="#F7D36A"/>
  </radialGradient>
  <linearGradient id="lf" x1="0" y1="0" x2="0" y2="-150" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="{JADE}"/><stop offset="1" stop-color="#3E9A6C"/>
  </linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#14614A"/><stop offset="1" stop-color="{JADE_D}"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="{GOLD_L}"/><stop offset=".5" stop-color="{GOLD}"/><stop offset="1" stop-color="#B9821A"/>
  </linearGradient>
  <radialGradient id="cream" cx=".5" cy=".42" r=".6">
    <stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="{CREAM}"/>
  </radialGradient>
</defs>'''

def ikat_ring(cx, cy, r, n=48, size=5, color=GOLD, opacity=1):
    out = []
    for i in range(n):
        a = math.radians(i * 360 / n)
        x, y = cx + r * math.sin(a), cy - r * math.cos(a)
        out.append(f'<path transform="translate({x:.1f},{y:.1f}) rotate({i*360/n:.1f})" d="M0,-{size} L{size},0 L0,{size} L-{size},0 Z"/>')
    return f'<g fill="{color}" opacity="{opacity}">{"".join(out)}</g>'

# ---------------------------------------------------------------- 1. round badge
def badge():
    C = 500
    top = arc_text('YA DOM HOM LAO', 'Montserrat', 700, 44, C, C, 412, 0, tracking=7)
    bot = arc_text('LAO HERBAL INHALANT', 'Montserrat', 600, 34, C, C, 438, 180, tracking=5, bottom=True)
    name, w = text_path('ຢາດົມຫອມລາວ', 'NotoSerifLao', 800, 112, C, 640)
    scale = min(1, 600 / w)
    tag, tw = text_path('ຫອມທຳມະຊາດ  ຈາກໃຈລາວ', 'NotoSansLao', 600, 38, C, 712)
    inh, _ = text_path('INHALANT', 'Montserrat', 700, 24, C, 772, tracking=9)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" width="1000" height="1000">
{DEFS}
<title>ຢາດົມຫອມລາວ · Ya Dom Hom Lao</title>
<circle cx="500" cy="500" r="494" fill="url(#ring)"/>
<circle cx="500" cy="500" r="480" fill="none" stroke="url(#gold)" stroke-width="5"/>
<circle cx="500" cy="500" r="372" fill="none" stroke="url(#gold)" stroke-width="7"/>
<circle cx="500" cy="500" r="364" fill="url(#cream)"/>
{ikat_ring(500, 500, 346, n=72, size=4, color=JADE, opacity=.22)}
<path d="{top}" fill="#FFFFFF"/>
<path d="{bot}" fill="{GOLD_L}"/>
{knot(500-438, 500, 1.15)}{knot(500+438, 500, 1.15)}
<!-- leaves + flower -->
{leaf(500, 385, -122, 1.45)}{leaf(500, 385, 122, 1.45)}{leaf(500, 385, -62, 1.4)}{leaf(500, 385, 62, 1.4)}
{frangipani(500, 380, 1.18)}
<!-- wordmark -->
<g transform="translate(500,640) scale({scale}) translate(-500,-640)"><path d="{name}" fill="{JADE}"/></g>
<g fill="url(#gold)">
  <rect x="330" y="664" width="128" height="3" rx="1.5"/><rect x="542" y="664" width="128" height="3" rx="1.5"/>
</g>
{knot(500, 666, .62)}
<path d="{tag}" fill="{JADE_L}"/>
{knot(462, 770, .55)}{knot(500, 770, .8)}{knot(538, 770, .55)}
</svg>'''

# ---------------------------------------------------------------- 2. icon (favicon / app / profile)
def icon():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
{DEFS}
<title>ຢາດົມຫອມລາວ</title>
<circle cx="256" cy="256" r="252" fill="url(#ring)"/>
<circle cx="256" cy="256" r="232" fill="none" stroke="url(#gold)" stroke-width="7"/>
{ikat_ring(256, 256, 212, n=40, size=4.5, color=GOLD, opacity=.55)}
{leaf(256, 252, -122, 1.22)}{leaf(256, 252, 122, 1.22)}{leaf(256, 252, -62, 1.18)}{leaf(256, 252, 62, 1.18)}
{frangipani(256, 252, 1.05, stroke=JADE_D)}
</svg>'''

# ---------------------------------------------------------------- 3. horizontal lockup (website header, documents)
def horizontal(dark=False):
    fg, sub = (('#FFFFFF', GOLD_L) if dark else (JADE, GOLD))
    name, w = text_path('ຢາດົມຫອມລາວ', 'NotoSerifLao', 800, 92, 250, 128, anchor='start')
    en, w2 = text_path('YA DOM HOM LAO  ·  HERBAL INHALANT', 'Montserrat', 600, 22, 254, 182, anchor='start', tracking=4)
    W = int(250 + max(w, w2) + 30)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} 230" width="{W}" height="230">
{DEFS}
<title>ຢາດົມຫອມລາວ · Ya Dom Hom Lao</title>
<g transform="translate(10,10) scale(.41)">{icon_inner()}</g>
<path d="{name}" fill="{fg}"/>
<rect x="254" y="150" width="{int(max(w, w2)) - 10}" height="2.5" fill="url(#gold)" rx="1"/>
<path d="{en}" fill="{sub}"/>
</svg>'''

def icon_inner():
    s = icon()
    return s[s.index('</title>') + 8:s.rindex('</svg>')]

if __name__ == '__main__':
    files = {'yadom-logo.svg': badge(), 'yadom-icon.svg': icon(),
             'yadom-logo-horizontal.svg': horizontal(), 'yadom-logo-horizontal-white.svg': horizontal(dark=True)}
    for n, s in files.items():
        open(os.path.join(OUT, n), 'w').write(s)
        print(n, len(s) // 1024, 'KB')
