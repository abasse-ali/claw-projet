"""Tests pour l'API CDiscount / Octopia."""
import json
from unittest.mock import patch, MagicMock

import pytest

from cdiscount_client import CDiscountClient, CDiscountAPIError
from config import CDiscountConfig
from models import Product


@pytest.fixture
def cdiscount_client():
    """Client CDiscount avec des credentials factices."""
    config = CDiscountConfig(
        client_id="TEST_CLIENT_ID",
        client_secret="TEST_CLIENT_SECRET",
        sales_channel="TEST_SALES_CHANNEL",
    )
    return CDiscountClient(config)


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
# _build_product_payload / _build_offer_payload
# --------------------------------------------------------------------------- #
class TestBuildPayload:
    def test_build_product_payload_structure(self, cdiscount_client, sample_product):
        """Le payload produit doit avoir la structure Octopia."""
        payload = cdiscount_client._build_product_payload(sample_product)
        assert isinstance(payload, dict)
        assert "sellerProductReference" in payload
        assert payload["sellerProductReference"] == sample_product.sku

    def test_build_product_payload_includes_name(self, cdiscount_client, sample_product):
        """Le payload produit doit inclure le nom."""
        payload = cdiscount_client._build_product_payload(sample_product)
        payload_str = json.dumps(payload)
        assert sample_product.name in payload_str

    def test_build_offer_payload_structure(self, cdiscount_client, sample_product):
        """Le payload offre doit avoir la structure Octopia."""
        payload = cdiscount_client._build_offer_payload(sample_product)
        assert isinstance(payload, dict)
        assert "sellerExternalReference" in payload
        assert "product" in payload
        assert payload["product"]["reference"] == sample_product.sku

    def test_build_offer_payload_includes_price(self, cdiscount_client, sample_product):
        """Le payload offre doit inclure le prix."""
        payload = cdiscount_client._build_offer_payload(sample_product)
        payload_str = json.dumps(payload)
        assert "50" in payload_str

    def test_build_offer_payload_includes_stock(self, cdiscount_client, sample_product):
        """Le payload offre doit inclure le stock."""
        payload = cdiscount_client._build_offer_payload(sample_product)
        payload_str = json.dumps(payload)
        assert "10" in payload_str

    def test_handles_product_without_gtin(self, cdiscount_client):
        """Un produit sans GTIN doit etre gere sans crash."""
        product = Product(
            sku="NO-GTIN", name="Test", description="desc", price=25.0,
            currency="EUR", image_url="http://example.com", stock_quantity=3,
            category="Test", source_url="http://example.com",
        )
        payload = cdiscount_client._build_product_payload(product)
        assert payload["sellerProductReference"] == "NO-GTIN"

    def test_handles_product_without_image(self, cdiscount_client):
        """Un produit sans image doit etre gere."""
        product = Product(
            sku="NO-IMG", name="Test", description="desc", price=25.0,
            currency="EUR", image_url=None, stock_quantity=3,
            category="Test", source_url="http://example.com",
        )
        payload = cdiscount_client._build_product_payload(product)
        assert payload is not None


# --------------------------------------------------------------------------- #
# OAuth2 token (mock)
# --------------------------------------------------------------------------- #
class TestOAuthToken:
    @patch("cdiscount_client.requests")
    def test_get_access_token_success(self, mock_requests, cdiscount_client):
        """_get_access_token doit retourner un token d'acces."""
        # Mock the session property to return a mock session
        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"access_token": "cdiscount_token_123"}
        mock_session.post.return_value = mock_response
        cdiscount_client._session = mock_session

        token = cdiscount_client._get_access_token()
        assert token == "cdiscount_token_123"

    @patch("cdiscount_client.requests")
    def test_get_access_token_failure(self, mock_requests, cdiscount_client):
        """_get_access_token doit lever une exception en cas d'erreur."""
        # Mock the session property to return a mock session
        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 401
        # Simulate OAuth failure (both OAuth and API key endpoints fail)
        mock_response.json.side_effect = Exception("Unauthorized")
        mock_session.post.return_value = mock_response
        cdiscount_client._session = mock_session

        with pytest.raises(Exception):
            cdiscount_client._get_access_token()


# --------------------------------------------------------------------------- #
# submit_products (dry_run)
# --------------------------------------------------------------------------- #
class TestSubmitProductsDryRun:
    def test_dry_run_returns_packages(self, cdiscount_client, sample_product):
        """En dry_run, doit retourner le statut DRY_RUN avec les payloads."""
        result = cdiscount_client.submit_products([sample_product], dry_run=True)
        assert result["status"] == "DRY_RUN"
        assert result["product_count"] == 1
        assert result["package_id"] is None

    def test_dry_run_returns_no_products_returns_skipped(self, cdiscount_client):
        """Avec une liste vide, doit retourner SKIPPED_EMPTY."""
        result = cdiscount_client.submit_products([], dry_run=True)
        assert result["status"] == "SKIPPED_EMPTY"
        assert result["product_count"] == 0

    def test_unconfigured_raises_error(self):
        """Un client non configure doit lever CDiscountAPIError."""
        config = CDiscountConfig(
            client_id="",
            client_secret="",
        )
        client = CDiscountClient(config)
        with pytest.raises(CDiscountAPIError):
            client.submit_products([], dry_run=True)
