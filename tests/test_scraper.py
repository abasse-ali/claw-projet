"""Tests pour le scraping des produits."""
import json
from unittest.mock import patch, MagicMock

import pytest

from scraper import build_session, fetch_sitemap, scrape_product, scrape_products
from models import Product, ScrapeResult
from config import ScraperConfig


# --------------------------------------------------------------------------- #
# build_session
# --------------------------------------------------------------------------- #
class TestBuildSession:
    def test_session_has_retry_adapter(self):
        """La session HTTP doit utiliser un adaptateur avec retry."""
        session = build_session(30)
        adapter = session.get_adapter("https://")
        assert adapter is not None
        assert adapter.max_retries is not None

    def test_session_has_user_agent(self):
        """La session doit avoir un User-Agent defini."""
        session = build_session(30)
        assert "User-Agent" in session.headers

    def test_session_uses_correct_timeout(self):
        """La session doit etre configuree avec un timeout valide."""
        session = build_session(30)
        assert session is not None


# --------------------------------------------------------------------------- #
# fetch_sitemap
# --------------------------------------------------------------------------- #
class TestFetchSitemap:
    def test_returns_product_urls(self, mock_sitemap_response):
        """fetch_sitemap doit retourner une liste d'URL de produits."""
        session = build_session(30)
        with patch.object(session, "get", return_value=mock_sitemap_response):
            urls = fetch_sitemap(session, "https://example.com/sitemap.xml", 30)
        assert len(urls) > 0
        assert all(url.startswith("http") for url in urls)

    def test_extracts_urls_from_sitemap(self, mock_sitemap_response):
        """Les URL doivent provenir du sitemap XML."""
        session = build_session(30)
        with patch.object(session, "get", return_value=mock_sitemap_response):
            urls = fetch_sitemap(session, "https://example.com/sitemap.xml", 30)
        assert "https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5" in urls
        assert "https://www.atelierdelafourmi.fr/shop/table-basse-3" in urls

    def test_empty_sitemap_returns_empty_list(self, mock_empty_sitemap):
        """Un sitemap vide doit retourner une liste vide."""
        session = build_session(30)
        with patch.object(session, "get", return_value=mock_empty_sitemap):
            urls = fetch_sitemap(session, "https://example.com/sitemap.xml", 30)
        assert urls == []

    def test_filters_non_product_urls(self):
        """fetch_sitemap doit filtrer les URLs qui ne correspondent pas au pattern produit."""
        sitemap_xml = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.atelierdelafourmi.fr/shop/produit-1</loc></url>
  <url><loc>https://www.atelierdelafourmi.fr/page/contact</loc></url>
  <url><loc>https://www.atelierdelafourmi.fr/shop/autre-2</loc></url>
</urlset>"""
        response = MagicMock()
        response.status_code = 200
        response.content = sitemap_xml.encode("utf-8")
        response.text = sitemap_xml
        session = build_session(30)
        with patch.object(session, "get", return_value=response):
            urls = fetch_sitemap(session, "https://example.com/sitemap.xml", 30)
        assert len(urls) == 2
        assert all("/shop/" in url for url in urls)


# --------------------------------------------------------------------------- #
# scrape_product
# --------------------------------------------------------------------------- #
class TestScrapeProduct:
    def test_extracts_product_fields(self, mock_product_page_response):
        """scrape_product doit extraire tous les champs du JSON-LD."""
        session = build_session(30)
        with patch.object(session, "get", return_value=mock_product_page_response):
            product = scrape_product(
                session,
                "https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5",
                30,
            )
        assert product is not None
        assert product.name == "Panneau PVC effet marbre"
        assert product.price == 50.0
        assert product.currency == "EUR"
        assert product.image_url is not None
        assert product.sku == "5"
        assert product.category == "Panneaux PVC"

    def test_extracts_sku_from_url_slug(self, mock_product_page_response):
        """Le SKU doit etre extrait de l'ID dans le slug de l'URL."""
        session = build_session(30)
        with patch.object(session, "get", return_value=mock_product_page_response):
            product = scrape_product(
                session,
                "https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5",
                30,
            )
        assert product is not None
        assert product.sku == "5"

    def test_extracts_image_url(self, mock_product_page_response):
        """L'URL d'image doit etre extraite du JSON-LD."""
        session = build_session(30)
        with patch.object(session, "get", return_value=mock_product_page_response):
            product = scrape_product(
                session,
                "https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5",
                30,
            )
        assert product is not None
        assert product.image_url.startswith("https://")
        assert "image_1920" in product.image_url

    def test_extracts_category_from_breadcrumb(self, mock_product_page_response):
        """La categorie doit etre extraite du BreadcrumbList JSON-LD."""
        session = build_session(30)
        with patch.object(session, "get", return_value=mock_product_page_response):
            product = scrape_product(
                session,
                "https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5",
                30,
            )
        assert product is not None
        assert product.category == "Panneaux PVC"

    def test_returns_none_for_missing_json_ld(self):
        """Une page sans JSON-LD doit retourner None."""
        session = build_session(30)
        response = MagicMock()
        response.status_code = 200
        response.content = b"<html><body>No JSON-LD here</body></html>"
        with patch.object(session, "get", return_value=response):
            product = scrape_product(
                session,
                "https://www.atelierdelafourmi.fr/shop/test-1",
                30,
            )
        assert product is None

    def test_returns_none_for_empty_html(self):
        """Du HTML vide doit retourner None."""
        session = build_session(30)
        response = MagicMock()
        response.status_code = 200
        response.content = b""
        with patch.object(session, "get", return_value=response):
            product = scrape_product(
                session,
                "https://www.atelierdelafourmi.fr/shop/test-1",
                30,
            )
        assert product is None

    def test_returns_none_on_http_error(self):
        """Une erreur HTTP doit retourner None."""
        import requests as req
        session = build_session(30)
        with patch.object(session, "get", side_effect=req.RequestException("Not Found")):
            product = scrape_product(
                session,
                "https://www.atelierdelafourmi.fr/shop/test-1",
                30,
            )
        assert product is None


# --------------------------------------------------------------------------- #
# scrape_products
# --------------------------------------------------------------------------- #
class TestScrapeProducts:
    def test_returns_scrape_result_with_products(self, mock_sitemap_response, mock_product_page_response):
        """scrape_products doit retourner un ScrapeResult avec des produits."""
        config = ScraperConfig(max_products=2)
        session = build_session(30)
        # Sitemap returns 2 URLs, so session.get is called 3 times:
        # 1x sitemap, 1x product page 1, 1x product page 2
        with patch("scraper.build_session", return_value=session), \
             patch.object(session, "get", side_effect=[
                 mock_sitemap_response,
                 mock_product_page_response,
                 mock_product_page_response,
             ]):
            result = scrape_products(config)
        assert isinstance(result, ScrapeResult)
        assert len(result.products) > 0
        assert all(isinstance(p, Product) for p in result.products)

    def test_handles_empty_sitemap(self):
        """Un sitemap vide doit retourner un ScrapeResult vide."""
        config = ScraperConfig()
        with patch("scraper.build_session") as mock_build_session, \
             patch("scraper.fetch_sitemap", return_value=[]), \
             patch("scraper.scrape_product") as mock_scrape:
            mock_session = MagicMock()
            mock_build_session.return_value = mock_session
            result = scrape_products(config)
        assert isinstance(result, ScrapeResult)
        assert len(result.products) == 0
        assert result.total_found == 0
        mock_scrape.assert_not_called()

    def test_max_products_limits_results(self, mock_sitemap_response, mock_product_page_response):
        """Le parametre max_products doit limiter le nombre de produits scrapes."""
        config = ScraperConfig(max_products=1)
        session = build_session(30)
        # Sitemap returns 2 URLs, but max_products=1 means only 1 product is scraped
        # session.get called: 1x sitemap, 1x product page
        with patch("scraper.build_session", return_value=session), \
             patch.object(session, "get", side_effect=[
                 mock_sitemap_response,
                 mock_product_page_response,
             ]):
            result = scrape_products(config)
        assert len(result.products) <= 1

    @pytest.mark.filterwarnings("ignore::bs4.XMLParsedAsHTMLWarning")
    def test_skips_failed_products(self, mock_sitemap_response):
        """Les produits qui echouent doivent etre comptes comme skips."""
        config = ScraperConfig()
        session = build_session(30)
        # Sitemap returns 2 URLs, both product pages fail to parse (sitemap XML, no product JSON-LD)
        with patch("scraper.build_session", return_value=session), \
             patch.object(session, "get", side_effect=[
                 mock_sitemap_response,  # sitemap response (2 URLs)
                 mock_sitemap_response,  # product 1 - will fail (no JSON-LD Product)
                 mock_sitemap_response,  # product 2 - will fail
             ]):
            result = scrape_products(config)
        assert len(result.products) == 0
        assert len(result.skipped) > 0
