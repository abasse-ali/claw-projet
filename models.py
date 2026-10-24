"""
Modèles de données pour le script d'automatisation e-commerce.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Product:
    """Représente un produit extrait du site web source."""

    sku: str
    name: str
    description: str
    price: float
    currency: str = "EUR"
    category: str = ""
    image_url: Optional[str] = None
    brand: str = ""
    gtin: Optional[str] = None
    stock_quantity: int = 0
    attributes: dict = field(default_factory=dict)
    source_url: str = ""

    def to_dict(self) -> dict:
        """Sérialise le produit en dictionnaire."""
        return {
            "sku": self.sku,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "currency": self.currency,
            "category": self.category,
            "image_url": self.image_url,
            "brand": self.brand,
            "gtin": self.gtin,
            "stock_quantity": self.stock_quantity,
            "attributes": self.attributes,
            "source_url": self.source_url,
        }


@dataclass
class ScrapeResult:
    """Résultat du scraping contenant les produits et les statistiques."""

    products: list = field(default_factory=list)
    skipped: list = field(default_factory=list)
    total_found: int = 0

    @property
    def success_count(self) -> int:
        return len(self.products)

    @property
    def skipped_count(self) -> int:
        return len(self.skipped)
