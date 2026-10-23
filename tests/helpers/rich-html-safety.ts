// Shared safety model for the rich-HTML sanitizers (the read-side
// `src/lib/sanitize-html.ts` and the write-side copy inside
// `functions/kychon-api.js`). A sanitized string is safe when a browser parse
// of it yields only allowlisted elements and attributes, and every URL
// attribute resolves to a safe scheme once the browser has decoded it.
import fc from 'fast-check';
import { Window } from 'happy-dom';

export const RICH_HTML_ALLOWED_TAGS = new Set([
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'del',
  'ins',
  'sub',
  'sup',
  'mark',
  'small',
  'span',
  'div',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'pre',
  'code',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title', 'target', 'rel']),
  img: new Set(['src', 'alt', 'title', 'width', 'height']),
  '*': new Set(['id', 'lang', 'dir']),
};

const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function urlIsSafe(value: string, allowDataImage: boolean): boolean {
  // The URL parser's reading: C0 controls and spaces trimmed from both ends,
  // ASCII tab and newline removed anywhere, then a scheme is an ASCII letter
  // followed by letters, digits, `+`, `-` or `.` up to the first `:`.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: C0 controls are what URL parsing strips.
  const url = value.replace(/^[\x00-\x20]+|[\x00-\x20]+$/g, '').replace(/[\t\n\r]/g, '');
  const scheme = /^[a-z][a-z0-9+.-]*:/i.exec(url)?.[0].toLowerCase();
  if (!scheme || SAFE_SCHEMES.has(scheme)) return true;
  return allowDataImage && /^data:image\/(png|jpe?g|gif|webp|svg\+xml)/i.test(url);
}

const parserWindow = new Window();

/** Every reason the sanitized HTML would be unsafe in a browser; empty when safe. */
export function richHtmlViolations(html: string): string[] {
  const doc = new parserWindow.DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html');
  const violations: string[] = [];
  for (const el of Array.from(doc.body.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase();
    if (!RICH_HTML_ALLOWED_TAGS.has(tag)) violations.push(`element <${tag}>`);
    const allowed = ALLOWED_ATTRS[tag];
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (!allowed?.has(name) && !ALLOWED_ATTRS['*'].has(name)) {
        violations.push(`attribute ${tag}[${name}]`);
        continue;
      }
      if ((name === 'href' || name === 'src') && !urlIsSafe(attr.value, name === 'src')) {
        violations.push(`url ${tag}[${name}=${JSON.stringify(attr.value)}]`);
      }
    }
  }
  return violations;
}

/** Inputs every sanitizer must neutralize: parser-differential and obfuscation tricks. */
export const HOSTILE_RICH_HTML: string[] = [
  '<svg/onload=alert(1)>',
  '<details/open/ontoggle=alert(1)>',
  '<img style="background:url(javascript:alert(1))">',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="&#106avascript:alert(1)">x</a>',
  '<a href="&#x6A;avascript&colon;alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="ja&Tab;vascript:alert(1)">x</a>',
  '<a href="javas\ncript:alert(1)">x</a>',
  '<a href="\u0001javascript:alert(1)">x</a>',
  '<a/href="javascript:alert(1)">x</a>',
  '<a href=javascript:alert(1)>x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a title=">" href="javascript:alert(1)">x</a>',
  '<img src=x onerror=alert(1)//>',
  '<img src=x onerror="alert(1)"/onload=y>',
  '<img title="a>b" onerror=alert(1) src=x>',
  '<p\tonclick=alert(1)>x</p>',
  '<p style=color:red class=x data-x=1>x</p>',
  '<form action="https://evil.example"><button formaction="javascript:alert(1)">go</button></form>',
  '<base href="https://evil.example/">',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
  '<svg><a xlink:href="javascript:alert(1)"><text>x</text></a></svg>',
  '<!--><img src=x onerror=alert(1)>-->',
  '<scr<script>x</script>ipt>alert(1)</script>',
  '<template><img src=x onerror=alert(1)></template>',
  '<textarea><img src=x onerror=alert(1)></textarea>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="javascript:alert(1)"></object><embed src="javascript:alert(1)">',
  '<video><source onerror=alert(1)></video>',
  '<input autofocus onfocus=alert(1)>',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<link rel=stylesheet href="https://evil.example/x.css">',
  '<div><p>unclosed <a href="https://example.com">link',
  '</div></p><img src=x onerror=alert(1)',
];

/** Well-formed editor output both sanitizers must keep byte for byte. */
export const BENIGN_RICH_HTML: string[] = [
  '<p>Hello <strong>world</strong> <a href="https://example.com">link</a></p>',
  '<h2>Agenda</h2><ul><li>One</li><li><em>Two</em></li></ul>',
  '<p><a href="/events/picnic" title="Picnic">Picnic</a> &amp; <a href="mailto:club@example.com">mail</a></p>',
  '<blockquote><p>Quote</p></blockquote><pre><code>a &lt; b</code></pre>',
  '<p><img src="/assets/logo.png" alt="Logo" width="120" height="40"></p>',
  '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>',
  '<p>Line<br>break</p><hr><p><s>old</s> <u>new</u> <mark>hot</mark></p>',
];

const FRAGMENTS = [
  '<',
  '>',
  '</',
  '/',
  '/>',
  '=',
  '"',
  "'",
  ' ',
  '\t',
  '\n',
  '\u0000',
  '<!--',
  '-->',
  '<!',
  '<?',
  '&',
  '&#106',
  '&#106;',
  '&#x6A;',
  '&colon;',
  '&Tab;',
  '&quot;',
  '&lt;',
  'a',
  'p',
  'img',
  'svg',
  'script',
  'style',
  'textarea',
  'noscript',
  'math',
  'details',
  'iframe',
  'href',
  'src',
  'title',
  'style',
  'onload',
  'onerror',
  'javascript:',
  'java\tscript:',
  'JaVaScRiPt:',
  'data:text/html,',
  'https://example.com',
  'alert(1)',
  'x',
];

/** Random soup of tag-ish fragments for property tests. */
export const richHtmlSoup = fc
  .array(fc.constantFrom(...FRAGMENTS), { minLength: 1, maxLength: 40 })
  .map((parts) => parts.join(''));

/** Random markup built from tag shapes, so attribute parsing is exercised. */
export const richHtmlTags = fc
  .array(
    fc.record({
      close: fc.boolean(),
      tag: fc.constantFrom('a', 'img', 'p', 'svg', 'details', 'script', 'style', 'div', 'textarea', 'noscript'),
      attrs: fc.array(
        fc.record({
          sep: fc.constantFrom(' ', '/', '\t', '\n', ' / '),
          name: fc.constantFrom('href', 'src', 'title', 'onload', 'style', 'id', 'HREF', 'xlink:href'),
          quote: fc.constantFrom('"', "'", ''),
          value: fc.constantFrom(
            'javascript:alert(1)',
            '&#106;avascript:alert(1)',
            '&#106avascript:alert(1)',
            'java&#x09;script:x',
            'javascript&colon;x',
            ' javascript:x',
            'https://example.com/?a=1&b=2',
            '/local',
            'a>b',
            'x"y',
            "x'y",
            '',
          ),
        }),
        { maxLength: 4 },
      ),
      text: fc.constantFrom('', 'hi', '<', '>', '&', '&amp;', '"'),
    }),
    { minLength: 1, maxLength: 8 },
  )
  .map((tags) =>
    tags
      .map(({ close, tag, attrs, text }) => {
        if (close) return `</${tag}>${text}`;
        const attrText = attrs.map(({ sep, name, quote, value }) => `${sep}${name}=${quote}${value}${quote}`).join('');
        return `<${tag}${attrText}>${text}`;
      })
      .join(''),
  );
