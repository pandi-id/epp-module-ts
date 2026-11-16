import { EppValidationError } from '../src/core/Errors';
import { parseBoolean, parseInteger, parseXml } from '../src/xml/XmlReader';
import { el, serializeXml } from '../src/xml/XmlWriter';

describe('XmlWriter', () => {
  it('escapes text and attribute values', () => {
    const xml = serializeXml(el('a', { title: 'x "y" & <z>\n' }, 'Tom & Jerry <3 >'), { declaration: false });
    expect(xml).toBe('<a title="x &quot;y&quot; &amp; &lt;z&gt;&#10;">Tom &amp; Jerry &lt;3 &gt;</a>');
  });

  it('flattens children and skips empty values', () => {
    const xml = serializeXml(el('a', { skip: undefined, nil: null }, [el('b'), null, undefined, false, [el('c', null, 0), 'text']]), {
      declaration: false,
    });
    expect(xml).toBe('<a><b/><c>0</c>text</a>');
  });

  it('rejects invalid names and characters', () => {
    expect(() => el('bad name')).toThrow(EppValidationError);
    expect(() => el('a', { 'x y': '1' })).toThrow(EppValidationError);
    expect(() => serializeXml(el('a', null, 'bell\u0007'))).toThrow(/not allowed in XML/);
    expect(() => serializeXml(el('a', null, '\uD800'))).toThrow(EppValidationError);
  });

  it('writes non-ASCII text unchanged', () => {
    expect(serializeXml(el('n', null, 'Jöhn Döe ✓'), { declaration: false })).toBe('<n>Jöhn Döe ✓</n>');
  });
});

describe('XmlReader', () => {
  it('matches elements by namespace URI, not prefix', () => {
    const prefixed = parseXml('<a:root xmlns:a="urn:x"><a:child>1</a:child></a:root>');
    const defaulted = parseXml('<root xmlns="urn:x"><child>1</child></root>');
    for (const root of [prefixed, defaulted]) {
      expect(root.is('urn:x', 'root')).toBe(true);
      expect(root.childText('urn:x', 'child')).toBe('1');
      expect(root.child('urn:other', 'child')).toBeUndefined();
    }
  });

  it('reads attributes, text and CDATA', () => {
    const root = parseXml('<r xmlns="urn:x" a="1"><t>  spaced  </t><c><![CDATA[<raw> & text]]></c></r>');
    expect(root.attr('a')).toBe('1');
    expect(root.childText('urn:x', 't')).toBe('spaced');
    expect(root.childText('urn:x', 'c')).toBe('<raw> & text');
  });

  it('serializes inner XML with the namespace declarations it needs', () => {
    const root = parseXml('<v xmlns="urn:epp"><d:name xmlns:d="urn:d"><d:part>a&amp;b</d:part></d:name></v>');
    expect(root.innerXml()).toBe('<d:name xmlns:d="urn:d"><d:part>a&amp;b</d:part></d:name>');
  });

  it('rejects malformed documents, unbound prefixes and DOCTYPEs', () => {
    expect(() => parseXml('<a><b></a>')).toThrow();
    expect(() => parseXml('<x:a/>')).toThrow();
    expect(() => parseXml('<!DOCTYPE a [<!ENTITY e "boom">]><a>&e;</a>')).toThrow(/DOCTYPE/);
    expect(() => parseXml('')).toThrow();
  });

  it('parses xs:boolean and integers', () => {
    expect([parseBoolean('1'), parseBoolean('true'), parseBoolean('0'), parseBoolean('false'), parseBoolean('yes')]).toEqual([
      true,
      true,
      false,
      false,
      undefined,
    ]);
    expect([parseInteger('42'), parseInteger(' 7 '), parseInteger('4.2'), parseInteger(undefined)]).toEqual([42, 7, undefined, undefined]);
  });
});
