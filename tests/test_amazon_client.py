"""Tests pour l'API Amazon SP-API."""
import json
from unittest.mock import patch, MagicMock

import pytest

from amazon_client import AmazonClient
from config import AmazonConfig
from models import Product


@pytest.fixture
def amazon_client():
    """Client Amazon avec des credentials factices."""
    config = AmazonConfig(
        seller_id="TEST_SELLER_ID",
        aws_access_key_id="TEST_AWS_KEY",
        aws_secret_access_key="TEST_AWS_SECRET",
        lwa_client_id="TEST_LWA_CLIENT_ID",
        lwa_client_secret="TEST_LWA_CLIENT_SECRET",
        lwa_refresh_token="TEST_LWA_REFRESH_TOKEN",
    )
    return AmazonClient(config)


@pytest.fixture
def sample_product():
    """Produit de test typique."""
    return Product(
        sku="PVC-5",
        name="Panneau PVC effet marbre",
        description="Panneau de sol en PVC",
        price=50.0,
        currency="EUR",
        image_url="https://www.atelierdelafourmi.fr/web/image/product.product/5/image_1920",
        stock_quantity=10,
        gtin="1234567890123",
        category="Panneaux PVC",
        source_url="https://www.atelierdelafourmi.fr/shop/panneau-pvc-5",
    )


# --------------------------------------------------------------------------- #
# build_listings_feed
# --------------------------------------------------------------------------- #
class TestBuildListingsFeed:
    def test_returns_string(self, amazon_client, sample_product):
        """Le feed doit etre une chaine JSON valide."""
        feed = amazon_client.build_listings_feed([sample_product])
        assert isinstance(feed, str)
        # Doit etre du JSON valide
        parsed = json.loads(feed)
        assert isinstance(parsed, dict)
        assert "header" in parsed
        assert "messages" in parsed

    def test_contains_required_fields(self, amazon_client, sample_product):
        """Chaque entree doit contenir les champs requis par Amazon."""
        feed = amazon_client.build_listings_feed([sample_product])
        parsed = json.loads(feed)
        entry = parsed["messages"][0]
        assert entry["sku"] == sample_product.sku
        assert entry["productType"] is not None

    def test_includes_price(self, amazon_client, sample_product):
        """Le prix doit etre inclus dans le feed."""
        feed = amazon_client.build_listings_feed([sample_product])
        assert "50.0" in feed or "50.00" in feed

    def test_includes_image_url(self, amazon_client, sample_product):
        """L'URL d'image doit etre incluse."""
        feed = amazon_client.build_listings_feed([sample_product])
        assert sample_product.image_url in feed

    def test_includes_sku(self, amazon_client, sample_product):
        """Le SKU doit etre inclus."""
        feed = amazon_client.build_listings_feed([sample_product])
        parsed = json.loads(feed)
        assert parsed["messages"][0]["sku"] == sample_product.sku

    def test_handles_multiple_products(self, amazon_client, sample_product):
        """Le feed doit gerer plusieurs produits."""
        products = [sample_product, Product(
            sku="TABLE-3",
            name="Table basse",
            description="Une table",
            price=100.0,
            currency="EUR",
            image_url="https://example.com/image.jpg",
            stock_quantity=5,
            gtin="9876543210987",
            category="Meubles",
            source_url="https://www.atelierdelafourmi.fr/shop/table-basse-3",
        )]
        feed = amazon_client.build_listings_feed(products)
        parsed = json.loads(feed)
        assert len(parsed["messages"]) == 2


# --------------------------------------------------------------------------- #
# LWA token (mock)
# --------------------------------------------------------------------------- #
class TestLWAtoken:
    @patch("amazon_client.requests")
    def test_get_lwa_access_token_success(self, mock_requests, amazon_client):
        """_get_lwa_access_token doit retourner un token d'acces."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "test_token_123"}
        mock_requests.post.return_value = mock_response

        token = amazon_client._get_lwa_access_token()
        assert token == "test_token_123"

    @patch("amazon_client.requests")
    def test_get_lwa_access_token_failure(self, mock_requests, amazon_client):
        """_get_lwa_access_token doit lever une exception en cas d'erreur."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = Exception("Unauthorized")
        mock_requests.post.return_value = mock_response

        with pytest.raises(Exception):
            amazon_client._get_lwa_access_token()


# --------------------------------------------------------------------------- #
# submit_products (dry_run)
# --------------------------------------------------------------------------- #
class TestSubmitProductsDryRun:
    def test_dry_run_returns_feed(self, amazon_client, sample_product):
        """En dry_run, doit retourner le statut DRY_RUN sans appeler l'API."""
        result = amazon_client.submit_products([sample_product], dry_run=True)
        assert result["status"] == "DRY_RUN"
        assert result["product_count"] == 1
        assert result["feed_id"] is None
