# ink.py <png>: share of pixels that are not near-white, as a percent
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('L')
px = im.getdata(); n = len(px)
print(round(100.0 * sum(1 for p in px if p < 200) / n, 2))
