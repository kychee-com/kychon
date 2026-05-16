function parserCtor() {
  if (typeof DOMParser !== 'undefined') return DOMParser;
  return globalThis.DOMParser;
}

function parseFixtureBody(html) {
  const Parser = parserCtor();
  if (!Parser) throw new Error('DOMParser is required for DOM fixtures');
  return new Parser().parseFromString(`<body>${html}</body>`, 'text/html').body;
}

function fixtureNodes(html) {
  return Array.from(parseFixtureBody(html).childNodes).map((node) => document.importNode(node, true));
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function htmlFixture(html) {
  const body = parseFixtureBody(html.trim());
  const roots = Array.from(body.children);
  if (roots.length !== 1) throw new Error(`Expected one fixture root, received ${roots.length}`);
  return document.importNode(roots[0], true);
}

export function bodyFixture(html) {
  document.body.replaceChildren(...fixtureNodes(html));
  return document.body;
}

export function clearBodyFixture() {
  document.body.replaceChildren();
}

export function headFixture(html) {
  document.head.replaceChildren(...fixtureNodes(html));
  return document.head;
}

export function appendBodyFixture(html) {
  const nodes = fixtureNodes(html);
  document.body.append(...nodes);
  return nodes;
}
