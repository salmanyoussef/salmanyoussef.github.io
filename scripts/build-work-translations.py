#!/usr/bin/env python3
"""Build localized work pages while preserving original evidence assets."""
from pathlib import Path
import html
import json
import re

ROOT = Path(__file__).resolve().parent.parent
BASE = 'https://salmanyoussef.github.io'
LABELS = {'en': 'English', 'fr': 'Français', 'ar': 'العربية', 'zh': '简体中文'}
LANG_TAGS = {'en': 'en', 'fr': 'fr', 'ar': 'ar', 'zh': 'zh-Hans'}

for source in sorted((ROOT / 'work').glob('*.html')):
    original = source.read_text()
    original = re.sub(r'<!-- work-languages:start -->.*?<!-- work-languages:end -->', '', original, flags=re.S)
    for lang in LABELS:
        prefix = '' if lang == 'en' else '/' + lang
        page = original
        if lang != 'en':
            translations = json.loads((ROOT / f'translations/work-{lang}.json').read_text())
            def translate_value(value):
                value = html.unescape(value)
                suffix = ' | Salman Youssef'
                if value.endswith(suffix):
                    return translations[value[:-len(suffix)]] + suffix
                return translations.get(value, value)
            def translate_text(match):
                raw = match.group()
                if raw.startswith('<') or not raw.strip():
                    return raw
                text = raw.strip()
                decoded = html.unescape(text)
                if decoded not in translations and not decoded.endswith(' | Salman Youssef'):
                    raise ValueError(f'Missing {lang} translation in {source.name}: {decoded}')
                return raw[:len(raw)-len(raw.lstrip())] + html.escape(translate_value(text), quote=False) + raw[len(raw.rstrip()):]
            page = re.sub(r'<!--.*?-->|<[^>]+>|[^<]+', translate_text, page, flags=re.S)
            page = re.sub(r'\b(alt|aria-label)="([^"]*)"', lambda m: m[1]+'="'+html.escape(translate_value(m[2]),quote=True)+'"', page)
            page = re.sub(r'<meta\b[^>]*>', lambda m: re.sub(r'content="([^"]*)"', lambda a: 'content="'+html.escape(translate_value(a[1]),quote=True)+'"', m[0]) if 'description' in m[0] or 'og:title' in m[0] else m[0], page)
            page = page.replace('<html lang="en">', f'<html lang="{LANG_TAGS[lang]}" dir="'+('rtl' if lang == 'ar' else 'ltr')+'">')
            page = page.replace('="../assets/', '="../../assets/')
            page = page.replace('href="../#', f'href="/{lang}/#')
        nav = '<!-- work-languages:start --><nav class="language-switcher" aria-label="'+{'en':'Language','fr':'Langue','ar':'اللغة','zh':'语言'}[lang]+'" dir="ltr">'
        for other, label in LABELS.items():
            link = ('' if other == 'en' else '/' + other) + '/work/' + source.name
            nav += f'<a href="{link}" lang="{LANG_TAGS[other]}" hreflang="{LANG_TAGS[other]}"'+(' aria-current="page"' if other == lang else '')+'>'+label+'</a>'
        nav += '</nav><!-- work-languages:end -->'
        page = page.replace('<main class="evidence-page">', '<main class="evidence-page">'+nav)
        metadata = '<!-- work-languages:start -->'
        for other in LABELS:
            metadata += '<link rel="alternate" hreflang="'+LANG_TAGS[other]+'" href="'+BASE+('' if other=='en' else '/'+other)+'/work/'+source.name+'"/>'
        metadata += '<link rel="canonical" href="'+BASE+prefix+'/work/'+source.name+'"/><link rel="stylesheet" href="/assets/languages.css?v=zh-20261029"/><!-- work-languages:end -->'
        page = page.replace('</head>',metadata+'</head>')
        dest = ROOT / lang / 'work' / source.name if lang != 'en' else source
        dest.parent.mkdir(parents=True,exist_ok=True)
        dest.write_text(page)
print('Built English, French, Arabic, and Simplified Chinese work pages.')
