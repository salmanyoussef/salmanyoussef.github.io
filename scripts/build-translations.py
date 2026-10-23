#!/usr/bin/env python3
"""Generate static localized pages from the English page without altering its markup.
Run from any directory: python3 scripts/build-translations.py
Keep translation keys in sync when changing English copy.
"""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://salmanyoussef.github.io/'
PATHS = {'en': '', 'fr': 'fr/', 'ar': 'ar/'}
LABELS = {'en': 'English', 'fr': 'Français', 'ar': 'العربية'}
DESCRIPTIONS = {
 'fr': 'Salman Ayman Youssef — ingénieur en systèmes d’IA et cybersécurité, chercheur, consultant indépendant et tuteur en informatique. Diplômé en informatique avec distinction et mineure en mathématiques.',
 'ar': 'سلمان أيمن يوسف — مهندس أنظمة الذكاء الاصطناعي والأمن السيبراني، وباحث واستشاري مستقل ومدرّس لعلوم الحاسوب. خريج علوم الحاسوب بامتياز مع تخصص فرعي في الرياضيات.'
}
ATTRIBUTES = {
 'fr': {
  'Read excerpts from my MITRE ATT&amp;CK article': 'Lire des extraits de mon article MITRE ATT&amp;CK',
  'Main navigation': 'Navigation principale', 'Portfolio sections': 'Rubriques du portfolio',
  'Portrait of Salman Ayman Youssef': 'Portrait de Salman Ayman Youssef',
  'Salman Ayman Youssef smiling in a suit and holding a bouquet': 'Salman Ayman Youssef souriant, en costume, tenant un bouquet',
 },
 'ar': {
  'Read excerpts from my MITRE ATT&amp;CK article': 'قراءة مقتطفات من مقالي عن MITRE ATT&amp;CK',
  'Main navigation': 'التنقل الرئيسي', 'Portfolio sections': 'أقسام الموقع',
  'Portrait of Salman Ayman Youssef': 'صورة سلمان أيمن يوسف',
  'Salman Ayman Youssef smiling in a suit and holding a bouquet': 'سلمان أيمن يوسف مبتسماً ببدلة ويحمل باقة زهور',
 }
}

source = (ROOT / 'index.html').read_text()
# Strip only previously generated navigation and metadata to make repeated builds idempotent.
source = re.sub(r'<!-- languages:start -->.*?<!-- languages:end -->\n?', '', source, flags=re.S)
source = re.sub(r'<!-- language-nav:start -->.*?<!-- language-nav:end -->', '', source, flags=re.S)
source = re.sub(r'<script src="/?assets/languages.js" defer></script>', '', source)
source = re.sub(r'<link href="/?assets/languages.css" rel="stylesheet"/>', '', source)

for lang in PATHS:
 page = source
 if lang != 'en':
  translations = json.loads((ROOT / f'translations/{lang}.json').read_text())
  # Match entire text nodes, leaving scripts, comments, tags and inline formatting intact.
  token = re.compile(r'<script\b.*?</script>|<!--.*?-->|<[^>]+>|[^<]+', re.S)
  def translate(match):
   raw = match.group()
   if raw.startswith('<') or not raw.strip(): return raw
   text = html.unescape(raw.strip())
   if text not in translations: return raw  # Product names, code and symbols stay unchanged.
   return raw[:len(raw)-len(raw.lstrip())] + html.escape(translations[text], quote=False) + raw[len(raw.rstrip()):]
  # Preserve the exact source wording of quotations explicitly marked as English.
  originals = []
  def preserve_original(match):
   originals.append(match.group())
   return f'<original-quote data-index="{len(originals)-1}"></original-quote>'
  page = re.sub(r'<blockquote\b[^>]*lang="en"[^>]*>.*?</blockquote>|<p\b[^>]*class="review-heading"[^>]*>.*?</p>|<div lang="en" dir="ltr">.*?</div>', preserve_original, page, flags=re.S)
  page = token.sub(translate, page)
  for i,original in enumerate(originals):
   page = page.replace(f'<original-quote data-index="{i}"></original-quote>',original)
  # Localize image descriptions and keep evidence-page navigation in this language.
  page = re.sub(r'\b(alt|aria-label)="([^"]*)"', lambda m: m[1]+'="'+html.escape(translations.get(html.unescape(m[2]),html.unescape(m[2])),quote=True)+'"', page)
  page = page.replace('href="/work/', f'href="/{lang}/work/')
  page = page.replace('<html lang="en">', f'<html lang="{lang}" dir="'+('rtl' if lang=='ar' else 'ltr')+'">')
  for old,new in ATTRIBUTES[lang].items(): page=page.replace('"'+old+'"', '"'+new+'"')
  # Translate any other image descriptions below.
  image_alts = {
   'fr': 'Aperçu du guide MITRE ATT&CK rédigé par Salman Ayman Youssef',
   'ar': 'معاينة دليل MITRE ATT&CK الذي كتبه سلمان أيمن يوسف'
  }
  page=re.sub(r'(<img\b[^>]*\balt=")[^"]*("[^>]*\bsrc="assets/work/mitre-article-preview.png")',lambda m:m[1]+html.escape(image_alts[lang],quote=True)+m[2],page)
  page=re.sub(r'<meta content="[^"]*" (name="description"|property="og:description")\s*/>',lambda m:'<meta content="'+html.escape(DESCRIPTIONS[lang],quote=True)+'" '+m[1]+'/>',page)
  title=html.escape(translations['Salman Ayman Youssef | AI Systems & Cybersecurity Engineer'],quote=True)
  page=re.sub(r'<meta content="[^"]*" property="og:title"\s*/>', '<meta content="'+title+'" property="og:title"/>',page)
  page=page.replace('href="assets/', 'href="../assets/').replace('src="assets/', 'src="../assets/')
  page=page.replace('<link href="'+BASE+'" rel="canonical"/>','<link href="'+BASE+PATHS[lang]+'" rel="canonical"/>')
  page=page.replace('<meta content="'+BASE+'" property="og:url"/>','<meta content="'+BASE+PATHS[lang]+'" property="og:url"/>')
  # Same person entity; localize the descriptive title, preserving profile links.
  page=page.replace('"jobTitle": "AI Systems & Cybersecurity Engineer"','"jobTitle": '+json.dumps(translations['AI & Cybersecurity Systems Engineer'],ensure_ascii=False))
 links='\n'.join(f'<link rel="alternate" hreflang="{l}" href="{BASE+p}"/>' for l,p in PATHS.items())
 links+=f'\n<link rel="alternate" hreflang="x-default" href="{BASE}"/>'
 links+=f'\n<meta property="og:locale" content="'+{'en':'en_CA','fr':'fr_CA','ar':'ar_AR'}[lang]+'"/>'
 for other in PATHS:
  if other!=lang: links+='\n<meta property="og:locale:alternate" content="'+{'en':'en_CA','fr':'fr_CA','ar':'ar_AR'}[other]+'"/>'
 page=page.replace('</head>', '<!-- languages:start -->\n'+links+'\n<!-- languages:end -->\n<link href="/assets/languages.css" rel="stylesheet"/><script src="/assets/languages.js" defer></script></head>')
 nav_label={'en':'Language','fr':'Langue','ar':'اللغة'}[lang]
 nav=f'<!-- language-nav:start --><div class="language-switcher" role="group" aria-label="{nav_label}" dir="ltr">'
 for l,p in PATHS.items():
  nav+=f'<a href="/{p}" lang="{l}" hreflang="{l}"'+(' aria-current="page"' if l==lang else '')+f'>{LABELS[l]}</a>'
 nav+='</div><!-- language-nav:end -->'
 page=page.replace('</div>\n<div aria-label=',nav+'</div>\n<div aria-label=',1)
 # Brand markup contains a blank line before its closing tag in the original.
 if 'language-nav:start' not in page:
  raise RuntimeError('Could not insert language switcher')
 dest=ROOT / PATHS[lang] / 'index.html'
 dest.parent.mkdir(exist_ok=True,parents=True)
 dest.write_text(page)
print('Built English, French, and Arabic portfolio pages.')
