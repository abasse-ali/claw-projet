"""
Module de scraping pour extraire les produits du site web atelierdelafourmi.fr.

Le site est base sur Odoo : il expose un sitemap.xml contenant toutes les URLs
de produits, et chaque page produit contient des donneess structurees au format
JSON-LD (schema.org).
"""

import json
import logging
import re
import time
from typing import List, Optional
from urllib.parse import urlparse, urljoin

import requests
from bs4 import BeautifulSoup

from config import ScraperConfig
from models import Product, ScrapeResult

logger = logging.getLogger(__name__)

# Pattern pour extraire le slug et l'ID du produit depuis l'URL.
# Exemple : /shop/parquet-chene-naturel-d-occitanie-3 -> slug="parquet-chene-naturel-d-occitanie", id=3
PRODUCT_URL_PATTERN = re.compile(r"^/shop/[a-z0-9\-]+-(\d+)(/page/\d+)?/?$")


def build_session(timeout: int = 30) -> requests.Session:
    """Cree une session requests avec retry et timeout."""
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    session = requests.Session()
    retry_strategy = Retry(
        total=3,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET", "POST", "PUT"],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update({
        "User-Agent": "AtelierDeLaFourmi-Bot/1.0 (e-commerce automation; contact@atelierdelafourmi.fr)",
    })
    return session


def fetch_sitemap(session: requests.Session, sitemap_url: str, timeout: int) -> List[str]:
    """
    Recupere le sitemap.xml et retourne la liste des URLs de produits.

    Args:
        session: Session requests configuree.
        sitemap_url: URL du sitemap.xml.
        timeout: Timeout en secondes.

    Returns:
        Liste d'URLs de produits triées.
    """
    logger.info("Telechargement du sitemap : %s", sitemap_url)
    response = session.get(sitemap_url, timeout=timeout)
    response.raise_for_status()

    soup = BeautifulSoup(response.content, "xml")
    urls: List[str] = []
    for loc in soup.find_all("loc"):
        url = loc.get_text(strip=True)
        if PRODUCT_URL_PATTERN.match(urlparse(url).path):
            urls.append(url)

    urls.sort()
    logger.info("Sitemap : %d URLs de produits trouvees", len(urls))
    return urls


def _parse_price(text: str) -> Optional[float]:
    """Extrait un prix numerique depuis une chaine comme '50,00 €'."""
    if not text:
        return None
    text = text.replace("€", "").replace(",", ".").strip()
    match = re.search(r"[\d.]+", text)
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def _extract_product_id(url: str) -> Optional[str]:
    """Extrait l'ID du produit depuis l'URL (le dernier nombre dans le slug)."""
    match = re.search(r"-(\d+)(?:/page/\d+)?/?$", url)
    if match:
        return match.group(1)
    return None


def _find_description(soup: BeautifulSoup) -> str:
    """
    Extrait la description du produit depuis le HTML de la page.

    Odoo place la description dans une balise <article> ou un div avec
    la classe 'o_product_description' ou 'description'.
    """
    # Essayer les selecteurs classiques d'Odoo
    desc_selectors = [
        "div.o_product_description",
        "div.description",
        "article.product-description",
        "div#product_description",
        "div.o_main_description",
    ]
    for selector in desc_selectors:
        el = soup.select_one(selector)
        if el:
            text = el.get_text(separator=" ", strip=True)
            if text:
                return text

    # Fallback : chercher le texte apres le titre du produit
    title = soup.find("h1")
    if title:
        next_siblings = title.find_parent().find_next_siblings()
        for sibling in next_siblings:
            text = sibling.get_text(separator=" ", strip=True)
            if len(text) > 20:
                return text

    # Dernier recours : extraire tout le texte de la page principale
    main = soup.find("main") or soup.find("div", class_="o_main")
    if main:
        paragraphs = main.find_all(["p", "li"])
        texts = [p.get_text(separator=" ", strip=True) for p in paragraphs if p.get_text(strip=True)]
        if texts:
            return " ".join(texts)

    return ""


def _extract_bullet_points(soup: BeautifulSoup) -> List[str]:
    """Extrait les points cles (Caractéristiques) de la page produit."""
    bullets: List[str] = []

    # Chercher les listes a puces dans la description
    desc = soup.find("div", class_=re.compile(r"product_description|description", re.I))
    if desc:
        for li in desc.find_all("li"):
            text = li.get_text(strip=True)
            if text and len(text) > 3:
                bullets.append(text)

    if not bullets:
        # Fallback : chercher les balises <li> apres le titre
        title = soup.find("h1")
        if title:
            parent = title.find_parent()
            for li in parent.find_all_next("li", limit=15):
                text = li.get_text(strip=True)
                if text and len(text) > 3:
                    bullets.append(text)

    return bullets


def scrape_product(
    session: requests.Session, url: str, timeout: int
) -> Optional[Product]:
    """
    Scrute une page produit et extrait les donnees structurées.

    Args:
        session: Session requests configuree.
        url: URL de la page produit.
        timeout: Timeout en secondes.

    Returns:
        Objet Product ou None si l'extraction echoue.
    """
    try:
        response = session.get(url, timeout=timeout)
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Erreur HTTP pour %s : %s", url, exc)
        return None

    soup = BeautifulSoup(response.content, "html.parser")

    # Extraire les donneess JSON-LD
    jsonld_scripts = soup.find_all("script", type="application/ld+json")
    product_data: Optional[dict] = None
    store_name: str = ""

    for script in jsonld_scripts:
        try:
            data = json.loads(script.string, strict=False)
        except (json.JSONDecodeError, TypeError):
            continue

        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("@type") == "Product":
                    product_data = item
                elif isinstance(item, dict) and item.get("@type") == "OnlineStore":
                    store_name = item.get("name", "")
        elif isinstance(data, dict) and data.get("@type") == "Product":
            product_data = data

    if not product_data:
        logger.warning("Pas de donnees JSON-LD produit pour %s", url)
        return None

    # Extraire l'ID du produit depuis l'URL
    sku = _extract_product_id(url) or product_data.get("sku", "")

    # Extraire le prix
    price = 0.0
    offers = product_data.get("offers", {})
    if isinstance(offers, dict):
        price = offers.get("price", 0.0)
        if isinstance(price, str):
            price = float(price) if _parse_price(price) is not None else 0.0
        elif isinstance(price, (int, float)):
            price = float(price)

    # Extraire la devise
    currency = "EUR"
    if isinstance(offers, dict):
        currency = offers.get("priceCurrency", "EUR")

    # Extraire l'image
    image_url = product_data.get("image", "")
    if not image_url and offers.get("url"):
        image_url = ""

    # Extraire la description du HTML
    description = _find_description(soup)
    bullet_points = _extract_bullet_points(soup)

    # Extraire la categorie depuis le breadcrumb JSON-LD
    category = ""
    for script in jsonld_scripts:
        try:
            data = json.loads(script.string, strict=False)
        except (json.JSONDecodeError, TypeError):
            continue
        if isinstance(data, dict) and data.get("@type") == "BreadcrumbList":
            items = data.get("itemListElement", [])
            if items:
                category = items[0].get("name", "")

    # Extraire la disponibilite
    stock_quantity = 0
    availability = offers.get("availability", "") if isinstance(offers, dict) else ""
    if "InStock" in str(availability):
        stock_quantity = 1  # En stock, quantite inconnue

    name = product_data.get("name", "")

    product = Product(
        sku=sku,
        name=name,
        description=description,
        price=price,
        currency=currency,
        category=category,
        image_url=image_url,
        brand=store_name,
        gtin=None,
        stock_quantity=stock_quantity,
        attributes={"bullet_points": bullet_points},
        source_url=url,
    )

    logger.debug("Produit extrait : %s (SKU=%s, prix=%.2f %s)", name, sku, price, currency)
    return product


def scrape_products(config: Optional[ScraperConfig] = None) -> ScrapeResult:
    """
    Scrape tous les produits du site web source.

    Args:
        config: Configuration du scraping. Si None, utilise la config par defaut.

    Returns:
        ScrapeResult contenant les produits extraits et les statistiques.
    """
    if config is None:
        config = ScraperConfig()

    session = build_session(config.timeout)
    result = ScrapeResult()

    try:
        product_urls = fetch_sitemap(session, config.sitemap_url, config.timeout)
    except requests.RequestException as exc:
        logger.error("Erreur lors du telechargement du sitemap : %s", exc)
        return result

    result.total_found = len(product_urls)
    max_products = config.max_products if config.max_products > 0 else len(product_urls)

    for i, url in enumerate(product_urls):
        if i >= max_products:
            break

        product = scrape_product(session, url, config.timeout)
        if product:
            result.products.append(product)
        else:
            result.skipped.append(url)

        # Pause pour ne pas surcharger le serveur
        time.sleep(0.2)

    logger.info(
        "Scraping termine : %d produits extraits, %d echecs, %d total trouve",
        result.success_count,
        result.skipped_count,
        result.total_found,
    )
    return result


def main() -> int:
    """Point d'entree pour l'utilisation en ligne de commande."""
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="Scrape les produits du site atelierdelafourmi.fr depuis le sitemap."
    )
    parser.add_argument(
        "--sitemap",
        default="https://www.atelierdelafourmi.fr/sitemap.xml",
        help="URL du sitemap.xml (defaut: sitemap du site)",
    )
    parser.add_argument(
        "--max",
        type=int,
        default=0,
        help="Nombre maximal de produits a scraper (0 = tous). Defaut: 0",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=30,
        help="Timeout reseau en secondes (defaut: 30)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="products.json",
        help="Fichier de sortie JSON (defaut: products.json)",
    )

    args = parser.parse_args()
    config = ScraperConfig(
        sitemap_url=args.sitemap,
        timeout=args.timeout,
        max_products=args.max,
    )

    result = scrape_products(config)

    # Sauvegarder les produits en JSON
    products_data = [p.to_dict() for p in result.products]
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(products_data, f, ensure_ascii=False, indent=2)

    logger.info("Resultat : %d produits sauvegardes dans %s", len(products_data), args.output)
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
