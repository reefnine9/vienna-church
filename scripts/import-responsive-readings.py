#!/usr/bin/env python3
"""Extract text from the Korean Hymn Society's 1-137 responsive-reading PPT ZIP.
Usage: python3 scripts/import-responsive-readings.py source.zip
Review generated JSON against the official slides before publishing.
"""
import json,re,sys,zipfile,io,os
from pathlib import Path
from xml.etree import ElementTree as ET
NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
def slide_text(data):
 root=ET.fromstring(data)
 paragraphs=[]
 for p in root.findall('.//a:p',NS):
  text=''.join((t.text or '') for t in p.findall('.//a:t',NS)).strip()
  if text:paragraphs.append(text)
 return paragraphs
def extract_pptx(data):
 result=[]
 with zipfile.ZipFile(io.BytesIO(data)) as z:
  slides=sorted((n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)),key=lambda s:int(re.search(r'slide(\d+)',s).group(1)))
  for slide in slides:result.extend(slide_text(z.read(slide)))
 return result
def main(path):
 readings={}
 with zipfile.ZipFile(path) as archive:
  pptx=[n for n in archive.namelist() if n.lower().endswith('.pptx')]
  if not pptx:raise SystemExit('No PPTX files found. Convert legacy .ppt files to .pptx first.')
  for name in pptx:
   match=re.search(r'(?:^|[^\d])(1[0-3]\d|[1-9]\d?|137)(?:번|호|[._\s-]|$)',Path(name).stem)
   if not match:continue
   number=int(match.group(1))
   if number<1 or number>137:continue
   paragraphs=extract_pptx(archive.read(name))
   # Remove duplicate cover/number lines only; retain all other original lines for review.
   if not paragraphs:continue
   readings[number]={'number':number,'title':Path(name).stem,'lines':paragraphs}
 out=Path('public/data/responsive-readings.json')
 out.parent.mkdir(parents=True,exist_ok=True)
 out.write_text(json.dumps({'edition':'21st-century-new-hymnal','source':'Korean Hymn Society official PPT','readings':{str(k):v for k,v in sorted(readings.items())}},ensure_ascii=False,indent=2),encoding='utf-8')
 missing=[n for n in range(1,138) if n not in readings]
 print('Extracted:',len(readings),'Missing:',missing,'Output:',out)
 if missing:raise SystemExit('Incomplete extraction: review PPT naming and missing entries before publishing.')
 print('IMPORTANT: Manually verify speaker alternation and all verses before deployment.')
if __name__=='__main__':
 if len(sys.argv)!=2:raise SystemExit('Usage: python3 scripts/import-responsive-readings.py source.zip')
 main(sys.argv[1])
