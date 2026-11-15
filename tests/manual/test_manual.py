# SPDX-License-Identifier: Apache-2.0
import functools
import hashlib
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import importlib.util
from urllib.parse import unquote, urlsplit

import pytest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'artifacts/manual/html'


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if 'id' in attrs:
            self.ids.add(attrs['id'])
        if tag == 'a' and 'href' in attrs:
            self.links.append(attrs['href'])
        if tag in ('script', 'img') and 'src' in attrs:
            self.links.append(attrs['src'])
        if tag == 'link' and 'href' in attrs:
            self.links.append(attrs['href'])


def test_generated_links_and_fragments():
    pages = {}
    for path in SITE.rglob('*.html'):
        parser = Links()
        parser.feed(path.read_text())
        pages[path.resolve()] = parser
    assert len(pages) >= 20
    for path, parser in pages.items():
        for link in parser.links:
            url = urlsplit(link)
            if url.scheme or url.netloc:
                continue
            if url.path.startswith('/collaboration-guidelines/'):
                target = (SITE / unquote(url.path.removeprefix('/collaboration-guidelines/'))).resolve()
            else:
                target = (path.parent / unquote(url.path)).resolve() if url.path else path
            if target.is_dir():
                target /= 'index.html'
            assert target.is_relative_to(SITE.resolve()), (path, link)
            assert target.exists(), (path, link)
            if url.fragment and target in pages:
                assert unquote(url.fragment) in pages[target].ids, (path, link)


def test_source_identity_and_actual_tasks():
    record = json.loads((SITE / 'build.json').read_text())
    for path, digest in record['sources'].items():
        assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
    tasks = (SITE / 'tasks.html').read_text()
    assert 'manual:verify' in tasks and 'tools/manual/container.sh verify' in tasks
    assert record['guidelines_baseline'] == 'v7.10.9'
    home = (SITE / 'index.html').read_text()
    assert f"/tree/{record['source_commit']}" in home
    assert 'Docs: development' in home


@pytest.fixture(scope='module')
def base_url():
    class Handler(SimpleHTTPRequestHandler):
        def translate_path(self, path):
            prefix = '/collaboration-guidelines/'
            if path.startswith(prefix):
                path = '/' + path[len(prefix):]
            return super().translate_path(path)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(SITE)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f'http://127.0.0.1:{server.server_port}/collaboration-guidelines/'
    server.shutdown()
    server.server_close()
    thread.join()


@pytest.fixture
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        yield browser
        browser.close()


def test_browser_search_and_deep_link(browser, base_url):
    page = browser.new_page()
    failures = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.goto(base_url)
    page.keyboard.press('/')
    page.get_by_role('combobox', name='Search', exact=True).fill('documentation ownership')
    result = page.locator('a[role="option"]').first
    result.wait_for(state='visible')
    result.click()
    page.wait_for_url('**/*.html*')
    page.reload()
    assert page.locator('main').inner_text()
    page.goto(base_url + 'docs/documentation-recipe.html#consistent-navigation')
    page.reload()
    assert page.locator('#consistent-navigation').is_visible()
    assert page.get_by_role('link', name='Documentation home', exact=True).first.get_attribute('href') == 'https://docs.livingprooflabs.com/'
    assert not failures
    page.close()


def test_browser_mobile_navigation_and_theme(browser, base_url):
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    page.goto(base_url)
    page.locator('label.md-header__button[for="__drawer"]').click()
    page.get_by_role('link', name='Contribute', exact=True).first.click()
    page.wait_for_url('**/CONTRIBUTING.html')
    page.locator('h1').filter(has_text='Contributing and releases').wait_for(state='visible')
    page.locator('label[title="Switch to dark mode"]').click()
    page.reload()
    assert page.locator('body').get_attribute('data-md-color-scheme') == 'slate'
    page.close()


def test_brand_provenance_and_every_page():
    lock = json.loads((ROOT / 'docs-brand.lock.json').read_text())
    record = json.loads((SITE / 'build.json').read_text())
    assert record['docs_brand'] == lock
    assert hashlib.sha256((SITE / 'assets/brand.css').read_bytes()).hexdigest() == lock['sha256']
    for path in SITE.rglob('*.html'):
        html = path.read_text()
        assert 'assets/brand.css' in html, path
        assert 'data-md-color-primary="indigo"' not in html, path
        assert 'data-md-color-primary="custom"' in html, path
        assert 'data-md-color-accent="custom"' in html, path


def test_brand_rejects_tampered_stylesheet():
    spec = importlib.util.spec_from_file_location('manual_brand', ROOT / 'tools/manual/brand.py')
    brand = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(brand)
    with pytest.raises(ValueError, match='Docs brand checksum mismatch'):
        brand.verify(b'tampered stylesheet', brand.lock())


@pytest.mark.parametrize('width', [1280, 390])
@pytest.mark.parametrize('scheme,accent,background', [
    ('light', '#0f766e', 'rgb(248, 250, 252)'),
    ('dark', '#2dd4bf', 'rgb(11, 17, 32)'),
])
def test_browser_brand_styles(browser, base_url, width, scheme, accent, background):
    page = browser.new_page(viewport={'width': width, 'height': 844}, color_scheme=scheme)
    # CI has no network: exercise the font fallback deterministically.
    page.route('https://fonts.googleapis.com/**', lambda route: route.abort())
    page.goto(base_url + 'docs/documentation-recipe.html')
    assert page.locator('body').get_attribute('data-md-color-primary') == 'custom'
    styles = page.locator('body').evaluate("""element => {
        const style = getComputedStyle(element);
        return {accent: style.getPropertyValue('--md-primary-fg-color').trim(),
                background: style.backgroundColor};
    }""")
    assert styles == {'accent': accent, 'background': background}
    assert 'Instrument Serif' in page.locator('h1').evaluate('e => getComputedStyle(e).fontFamily')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path=str(ROOT / f'artifacts/manual/brand-{scheme}-{width}.png'), full_page=True)
    page.close()
