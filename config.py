"""
Configuration centralisée chargee depuis les variables d'environnement.
"""

import os
from dataclasses import dataclass, field
from typing import List

from dotenv import load_dotenv

load_dotenv()


def _get_env(key: str, default: str = "") -> str:
    """Lit une variable d'environnement avec une valeur par defaut."""
    return os.getenv(key, default)


def _get_env_int(key: str, default: int = 0) -> int:
    """Lit une variable d'environnement entiere."""
    value = os.getenv(key)
    if value is None or value.strip() == "":
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _get_env_list(key: str, default: str = "") -> List[str]:
    """Lit une variable d'environnement en liste (separateur virgule)."""
    value = os.getenv(key, default)
    if not value:
        return []
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass
class ScraperConfig:
    """Configuration pour le scraping du site web source."""

    sitemap_url: str = field(
        default_factory=lambda: _get_env("SOURCE_SITEMAP_URL", "https://www.atelierdelafourmi.fr/sitemap.xml")
    )
    timeout: int = field(default_factory=lambda: _get_env_int("REQUEST_TIMEOUT", 30))
    max_products: int = field(default_factory=lambda: _get_env_int("MAX_PRODUCTS", 0))


@dataclass
class AmazonConfig:
    """Configuration pour l'API Amazon SP-API."""

    seller_id: str = field(default_factory=lambda: _get_env("AMAZON_SELLER_ID"))
    aws_region: str = field(default_factory=lambda: _get_env("AMAZON_AWS_REGION", "eu-west-1"))
    aws_access_key_id: str = field(default_factory=lambda: _get_env("AMAZON_AWS_ACCESS_KEY_ID"))
    aws_secret_access_key: str = field(default_factory=lambda: _get_env("AMAZON_AWS_SECRET_ACCESS_KEY"))
    lwa_client_id: str = field(default_factory=lambda: _get_env("AMAZON_LWA_CLIENT_ID"))
    lwa_client_secret: str = field(default_factory=lambda: _get_env("AMAZON_LWA_CLIENT_SECRET"))
    lwa_refresh_token: str = field(default_factory=lambda: _get_env("AMAZON_LWA_REFRESH_TOKEN"))
    sp_api_endpoint: str = field(
        default_factory=lambda: _get_env("AMAZON_SP_API_ENDPOINT", "https://sellingpartnerapi-eu.amazon.com")
    )
    marketplace_ids: List[str] = field(default_factory=lambda: _get_env_list("AMAZON_MARKETPLACE_IDS", "A13V1VB97FVB"))
    tax_code: str = field(default_factory=lambda: _get_env("AMAZON_TAX_CODE", "A_GEN_NOTAX"))
    timeout: int = field(default_factory=lambda: _get_env_int("REQUEST_TIMEOUT", 30))

    @property
    def is_configured(self) -> bool:
        """Verifie que toutes les credentials Amazon sont presents."""
        return all([
            self.seller_id,
            self.aws_access_key_id,
            self.aws_secret_access_key,
            self.lwa_client_id,
            self.lwa_client_secret,
            self.lwa_refresh_token,
        ])


@dataclass
class CDiscountConfig:
    """Configuration pour l'API CDiscount / Octopia."""

    client_id: str = field(default_factory=lambda: _get_env("CDISCOUNT_CLIENT_ID"))
    client_secret: str = field(default_factory=lambda: _get_env("CDISCOUNT_CLIENT_SECRET"))
    api_endpoint: str = field(
        default_factory=lambda: _get_env("CDISCOUNT_API_ENDPOINT", "https://api.octopia-io.net")
    )
    sales_channel: str = field(default_factory=lambda: _get_env("CDISCOUNT_SALES_CHANNEL"))
    timeout: int = field(default_factory=lambda: _get_env_int("REQUEST_TIMEOUT", 30))

    @property
    def is_configured(self) -> bool:
        """Verifie que les credentials CDiscount sont presents."""
        return bool(self.client_id and self.client_secret)


@dataclass
class Config:
    """Configuration globale du script."""

    scraper: ScraperConfig = field(default_factory=ScraperConfig)
    amazon: AmazonConfig = field(default_factory=AmazonConfig)
    cdiscount: CDiscountConfig = field(default_factory=CDiscountConfig)
