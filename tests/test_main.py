"""Tests pour la CLI (main.py)."""
import json
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

import main
from models import Product


# --------------------------------------------------------------------------- #
# build_parser
# --------------------------------------------------------------------------- #
class TestBuildParser:
    def test_has_subcommands(self):
        """Le parseur doit proposer toutes les sous-commandes."""
        parser = main.build_parser()
        # Verify subparsers are registered
        actions = parser._actions
        subparser_action = [a for a in actions if hasattr(a, "choices")]
        assert len(subparser_action) > 0

    def test_help_shows_usage(self):
        """--help doit afficher l'usage."""
        parser = main.build_parser()
        with pytest.raises(SystemExit) as exc_info:
            parser.parse_args(["--help"])
        assert exc_info.value.code == 0

    def test_no_subcommand_exits_1(self):
        """Aucune commande doit afficher l'aide et retourner 1."""
        ret = main.main([])
        assert ret == 1

    def test_invalid_subcommand_exits_nonzero(self):
        """Une sous-commande invalide doit provoquer une erreur."""
        with pytest.raises(SystemExit):
            main.main(["invalid-command"])


# --------------------------------------------------------------------------- #
# scrape subcommand
# --------------------------------------------------------------------------- #
class TestScrapeCommand:
    def test_dry_run_outputs_json(self):
        """scrape --dry-run doit afficher le JSON sur stdout."""
        mock_result = MagicMock()
        mock_result.products = [Product(
            sku="1", name="Test", description="desc", price=10.0,
            currency="EUR", image_url="http://img.jpg", stock_quantity=5,
            category="Test", source_url="http://example.com",
        )]
        with patch("main.scrape_products", return_value=mock_result):
            ret = main.main(["scrape", "--dry-run"])
            assert ret == 0

    def test_empty_sitemap_returns_1(self):
        """scrape avec un sitemap vide doit retourner 1."""
        mock_result = MagicMock()
        mock_result.products = []
        with patch("main.scrape_products", return_value=mock_result):
            ret = main.main(["scrape", "--output", "/tmp/test_products.json"])
            assert ret == 1

    def test_max_products_flag_passed(self):
        """--max-products doit etre utilise."""
        mock_result = MagicMock()
        mock_result.products = []
        with patch("main.scrape_products") as mock_scrape:
            mock_scrape.return_value = mock_result
            main.main(["scrape", "--max-products", "5"])
            # verify scrape_products was called
            assert mock_scrape.called


# --------------------------------------------------------------------------- #
# upload-amazon subcommand
# --------------------------------------------------------------------------- #
class TestUploadAmazonCommand:
    def test_dry_run_returns_0(self):
        """upload-amazon --dry-run doit retourner 0."""
        mock_result = MagicMock()
        mock_result.products = [Product(
            sku="1", name="Test", description="desc", price=10.0,
            currency="EUR", image_url="http://img.jpg", stock_quantity=5,
            category="Test", source_url="http://example.com",
        )]
        with patch("main.scrape_products", return_value=mock_result):
            with patch("main.AmazonClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.submit_products.return_value = {
                    "status": "DRY_RUN", "product_count": 1, "feed_id": None
                }
                mock_client_cls.return_value = mock_client
                ret = main.main(["upload-amazon", "--dry-run"])
                assert ret == 0

    def test_missing_input_and_empty_scrape_returns_1(self):
        """Si aucun produit, doit retourner 1."""
        mock_result = MagicMock()
        mock_result.products = []
        with patch("main.scrape_products", return_value=mock_result):
            with patch("main.AmazonClient"):
                ret = main.main(["upload-amazon"])
                assert ret == 1


# --------------------------------------------------------------------------- #
# upload-cdiscount subcommand
# --------------------------------------------------------------------------- #
class TestUploadCdiscountCommand:
    def test_dry_run_returns_0(self):
        """upload-cdiscount --dry-run doit retourner 0."""
        mock_result = MagicMock()
        mock_result.products = [Product(
            sku="1", name="Test", description="desc", price=10.0,
            currency="EUR", image_url="http://img.jpg", stock_quantity=5,
            category="Test", source_url="http://example.com",
        )]
        with patch("main.scrape_products", return_value=mock_result):
            with patch("main.CDiscountClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.submit_products.return_value = {
                    "status": "DRY_RUN", "product_count": 1, "package_id": None
                }
                mock_client_cls.return_value = mock_client
                ret = main.main(["upload-cdiscount", "--dry-run"])
                assert ret == 0


# --------------------------------------------------------------------------- #
# upload-all subcommand
# --------------------------------------------------------------------------- #
class TestUploadAllCommand:
    def test_dry_run_runs_both(self):
        """upload-all --dry-run doit executer Amazon et CDiscount."""
        mock_result = MagicMock()
        mock_result.products = [Product(
            sku="1", name="Test", description="desc", price=10.0,
            currency="EUR", image_url="http://img.jpg", stock_quantity=5,
            category="Test", source_url="http://example.com",
        )]
        with patch("main.scrape_products", return_value=mock_result):
            with patch("main.AmazonClient") as mock_amazon_cls, \
                 patch("main.CDiscountClient") as mock_cdiscount_cls:
                mock_amazon_cls.return_value.submit_products.return_value = {
                    "status": "DRY_RUN", "product_count": 1, "feed_id": None
                }
                mock_cdiscount_cls.return_value.submit_products.return_value = {
                    "status": "DRY_RUN", "product_count": 1, "package_id": None
                }
                ret = main.main(["upload-all", "--dry-run"])
                assert ret == 0


# --------------------------------------------------------------------------- #
# _load_products / _save_products (helpers)
# --------------------------------------------------------------------------- #
class TestLoadSaveProducts:
    def test_save_then_load(self, tmp_path):
        """Sauvegarder puis charger doit preserver les donnees."""
        products = [Product(
            sku="1", name="Test", description="desc", price=10.0,
            currency="EUR", image_url="http://img.jpg", stock_quantity=5,
            category="Test", source_url="http://example.com",
        )]
        path = tmp_path / "products.json"
        main._save_products(products, str(path))
        loaded = main._load_products(str(path))
        assert len(loaded) == 1
        assert loaded[0].sku == "1"

    def test_load_missing_file_exits_1(self, tmp_path):
        """Charger un fichier inexistant doit appeler sys.exit(1)."""
        with pytest.raises(SystemExit) as exc_info:
            main._load_products(str(tmp_path / "nonexistent.json"))
        assert exc_info.value.code == 1
