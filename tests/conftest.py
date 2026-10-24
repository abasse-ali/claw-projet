"""
Fixtures partagées pour les tests.
"""
import json
from unittest.mock import MagicMock, patch

import pytest


# --------------------------------------------------------------------------- #
# Fixtures pour le sitemap
# --------------------------------------------------------------------------- #
@pytest.fixture
def mock_sitemap_xml():
    """Retourne le contenu XML d'un sitemap typique."""
    return """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5</loc></url>
  <url><loc>https://www.atelierdelafourmi.fr/shop/table-basse-3</loc></url>
</urlset>"""


@pytest.fixture
def mock_empty_sitemap_xml():
    """Retourne un sitemap XML vide."""
    return """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>"""


@pytest.fixture
def mock_sitemap_response(mock_sitemap_xml):
    """Mock de reponse HTTP pour le sitemap."""
    response = MagicMock()
    response.status_code = 200
    response.content = mock_sitemap_xml.encode("utf-8")
    response.text = mock_sitemap_xml
    return response


@pytest.fixture
def mock_empty_sitemap(mock_empty_sitemap_xml):
    """Mock de reponse HTTP pour un sitemap vide."""
    response = MagicMock()
    response.status_code = 200
    response.content = mock_empty_sitemap_xml.encode("utf-8")
    response.text = mock_empty_sitemap_xml
    return response


# --------------------------------------------------------------------------- #
# Fixtures pour les pages produit
# --------------------------------------------------------------------------- #
@pytest.fixture
def mock_product_html():
    """Retourne le HTML d'une page produit Odoo type avec JSON-LD en liste."""
    return """<!DOCTYPE html>
<html>
<head>
  <title>Panneau PVC effet marbre - Atelier de la Fourmi</title>
  <script type="application/ld+json">
  [
    {
      "@context": "https://schema.org",
      "@type": "OnlineStore",
      "name": "L'Atelier de la Fourmi",
      "url": "https://www.atelierdelafourmi.fr"
    },
    {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Panneau PVC effet marbre",
      "image": "https://www.atelierdelafourmi.fr/web/image/product.product/5/image_1920",
      "description": "Panneau de sol en PVC effet marbre",
      "sku": "5",
      "offers": {
        "@type": "Offer",
        "priceCurrency": "EUR",
        "price": "50.00",
        "availability": "https://schema.org/InStock",
        "url": "https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5"
      }
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [{
        "@type": "ListItem",
        "position": 1,
        "name": "Panneaux PVC"
      }]
    }
  ]
  </script>
</head>
<body>
  <h1>Panneau PVC effet marbre</h1>
  <div class="o_product_description">
    <p>Panneau de sol en PVC haute qualite.</p>
    <ul>
      <li>Epaisseur: 5mm</li>
      <li>Dimensions: 60x60cm</li>
    </ul>
  </div>
</body>
</html>"""


@pytest.fixture
def mock_product_page_response(mock_product_html):
    """Mock de reponse HTTP pour une page produit."""
    response = MagicMock()
    response.status_code = 200
    response.content = mock_product_html.encode("utf-8")
    response.text = mock_product_html
    return response


@pytest.fixture
def mock_scrape_responses(mock_sitemap_response, mock_product_page_response):
    """Mock les reponses pour un scraping complet (sitemap + page produit)."""
    with patch("scraper.build_session") as mock_build_session, \
         patch("scraper.scrape_product") as mock_scrape_product:

        mock_session = MagicMock()
        mock_session.get.side_effect = [mock_sitemap_response, mock_product_page_response]
        mock_build_session.return_value = mock_session

        from models import Product
        mock_scrape_product.return_value = Product(
            sku="5",
            name="Panneau PVC effet marbre",
            description="Panneau de sol en PVC",
            price=50.0,
            currency="EUR",
            image_url="https://www.atelierdelafourmi.fr/web/image/product.product/5/image_1920",
            stock_quantity=1,
            gtin=None,
            category="Panneaux PVC",
            source_url="https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5",
        )

        yield


@pytest.fixture
def mock_scrape_product():
    """Mock scrape_product pour retourner un produit."""
    with patch("scraper.scrape_product") as mock:
        from models import Product
        mock.return_value = Product(
            sku="5",
            name="Panneau PVC effet marbre",
            description="Panneau de sol en PVC",
            price=50.0,
            currency="EUR",
            image_url="https://www.atelierdelafourmi.fr/web/image/product.product/5/image_1920",
            stock_quantity=1,
            gtin=None,
            category="Panneaux PVC",
            source_url="https://www.atelierdelafourmi.fr/shop/panneau-pvc-effet-marbre-5",
        )
        yield mock
