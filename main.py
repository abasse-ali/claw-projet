#!/usr/bin/env python3
"""
Script d'orchestration CLI pour l'automatisation de mise en ligne
des produits sur Amazon et CDiscount depuis le site www.atelierdelafourmi.fr.

Usage:
    python main.py --help
    python main.py scrape --max-products 10
    python main.py upload-amazon
    python main.py upload-cdiscount
    python main.py upload-all --dry-run
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

from amazon_client import AmazonClient
from cdiscount_client import CDiscountClient
from config import AmazonConfig, CDiscountConfig, ScraperConfig
from models import Product
from scraper import scrape_products, build_session


def _print_json(data, *, indent: int = 2) -> None:
    """Affiche des donnees en JSON avec un formatage lisible."""
    print(json.dumps(data, indent=indent, ensure_ascii=False))


def _load_products(input_file: str) -> list[Product]:
    """Charge une liste de produits depuis un fichier JSON."""
    path = Path(input_file)
    if not path.exists():
        print(f"Erreur : le fichier {input_file} est introuvable.", file=sys.stderr)
        sys.exit(1)
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return [Product(**item) for item in data]


def _save_products(products: list[Product], output_file: str) -> None:
    """Sauvegarde une liste de produits dans un fichier JSON."""
    path = Path(output_file)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump([p.to_dict() for p in products], f, indent=2, ensure_ascii=False)
    print(f"Produits sauvegardes dans {output_file}", file=sys.stderr)


# --------------------------------------------------------------------------- #
# Sous-commande : scrape
# --------------------------------------------------------------------------- #
def cmd_scrape(args: argparse.Namespace) -> int:
    """Scrape les produits du site et les sauvegarde en JSON."""
    config = ScraperConfig()
    # Override max_products from CLI if provided
    if args.max_products and args.max_products > 0:
        config.max_products = args.max_products
        print(f"Limite : {args.max_products} produits", file=sys.stderr)
    else:
        config.max_products = 0

    print(f"Telechargement du sitemap : {config.sitemap_url}", file=sys.stderr)
    result = scrape_products(config)
    products = result.products

    if not products:
        print("Erreur : aucun produit valide n'a pu etre extrait.", file=sys.stderr)
        return 1

    if args.dry_run:
        print("[DRY RUN] Produits extraits (non sauvegardes) :", file=sys.stderr)
        _print_json([p.to_dict() for p in products])
        return 0

    _save_products(products, args.output)
    _print_json([p.to_dict() for p in products])
    return 0


# --------------------------------------------------------------------------- #
# Sous-commande : upload-amazon
# --------------------------------------------------------------------------- #
def cmd_upload_amazon(args: argparse.Namespace) -> int:
    """Soumet les produits sur Amazon via SP-API."""
    config = AmazonConfig()
    client = AmazonClient(config)

    if args.input:
        products = _load_products(args.input)
    else:
        # Re-scrape depuis le site
        scraper_config = ScraperConfig()
        print(f"Telechargement du sitemap : {scraper_config.sitemap_url}", file=sys.stderr)
        result = scrape_products(scraper_config)
        products = result.products

    if not products:
        print("Erreur : aucun produit a soumettre.", file=sys.stderr)
        return 1

    try:
        result = client.submit_products(products, wait=args.wait, dry_run=args.dry_run)
        _print_json(result)
        return 0
    except Exception as exc:
        print(f"Erreur Amazon : {exc}", file=sys.stderr)
        return 1


# --------------------------------------------------------------------------- #
# Sous-commande : upload-cdiscount
# --------------------------------------------------------------------------- #
def cmd_upload_cdiscount(args: argparse.Namespace) -> int:
    """Soumet les produits sur CDiscount via l'API Octopia."""
    config = CDiscountConfig()
    client = CDiscountClient(config)

    if args.input:
        products = _load_products(args.input)
    else:
        scraper_config = ScraperConfig()
        print(f"Telechargement du sitemap : {scraper_config.sitemap_url}", file=sys.stderr)
        result = scrape_products(scraper_config)
        products = result.products

    if not products:
        print("Erreur : aucun produit a soumettre.", file=sys.stderr)
        return 1

    try:
        result = client.submit_products(products, wait=args.wait, dry_run=args.dry_run)
        _print_json(result)
        return 0
    except Exception as exc:
        print(f"Erreur CDiscount : {exc}", file=sys.stderr)
        return 1


# --------------------------------------------------------------------------- #
# Sous-commande : upload-all
# --------------------------------------------------------------------------- #
def cmd_upload_all(args: argparse.Namespace) -> int:
    """Soumet les produits sur Amazon et CDiscount."""
    exit_code = 0

    # Amazon
    print("=== Soumission sur Amazon ===", file=sys.stderr)
    amazon_ns = argparse.Namespace(
        input=args.input,
        wait=args.wait,
        dry_run=args.dry_run,
    )
    exit_code = cmd_upload_amazon(amazon_ns) or exit_code

    # CDiscount
    print("=== Soumission sur CDiscount ===", file=sys.stderr)
    cdiscount_ns = argparse.Namespace(
        input=args.input,
        wait=args.wait,
        dry_run=args.dry_run,
    )
    exit_code = cmd_upload_cdiscount(cdiscount_ns) or exit_code

    return exit_code


# --------------------------------------------------------------------------- #
# Analyseur darguments
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    """Construit l'analyseur d'arguments pour la CLI."""
    parser = argparse.ArgumentParser(
        prog="main.py",
        description=(
            "Automatise la mise en ligne des produits sur Amazon et CDiscount "
            "depuis le site www.atelierdelafourmi.fr"
        ),
    )
    subparsers = parser.add_subparsers(dest="command", help="Commande a executer")

    # --- scrape ---
    scrape_parser = subparsers.add_parser(
        "scrape",
        help="Extraire les produits du site web vers un fichier JSON",
    )
    scrape_parser.add_argument(
        "--max-products",
        type=int,
        default=None,
        help="Nombre maximum de produits a extraire (par defaut: tous)",
    )
    scrape_parser.add_argument(
        "--output", "-o",
        default="products.json",
        help="Fichier JSON de sortie (defaut: products.json)",
    )
    scrape_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Extraire sans sauvegarder (affiche sur stdout)",
    )

    # --- upload-amazon ---
    amazon_parser = subparsers.add_parser(
        "upload-amazon",
        help="Soumettre les produits sur Amazon via SP-API",
    )
    amazon_parser.add_argument(
        "--input", "-i",
        default=None,
        help="Fichier JSON d'entree (defaut: products.json, sinon re-scrape)",
    )
    amazon_parser.add_argument(
        "--wait",
        action="store_true",
        help="Attendre que l'integration Amazon soit terminee",
    )
    amazon_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generer le flux sans l'envoyer (affiche sur stdout)",
    )

    # --- upload-cdiscount ---
    cdiscount_parser = subparsers.add_parser(
        "upload-cdiscount",
        help="Soumettre les produits sur CDiscount via l'API Octopia",
    )
    cdiscount_parser.add_argument(
        "--input", "-i",
        default=None,
        help="Fichier JSON d'entree (defaut: products.json, sinon re-scrape)",
    )
    cdiscount_parser.add_argument(
        "--wait",
        action="store_true",
        help="Attendre que l'integration CDiscount soit terminee",
    )
    cdiscount_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generer les paquets sans les envoyer (affiche sur stdout)",
    )

    # --- upload-all ---
    all_parser = subparsers.add_parser(
        "upload-all",
        help="Soumettre les produits sur Amazon et CDiscount",
    )
    all_parser.add_argument(
        "--input", "-i",
        default=None,
        help="Fichier JSON d'entree (defaut: products.json, sinon re-scrape)",
    )
    all_parser.add_argument(
        "--wait",
        action="store_true",
        help="Attendre que les integrations soient terminees",
    )
    all_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generer les flux sans les envoyer (affiche sur stdout)",
    )

    return parser


def main(argv: Optional[list[str]] = None) -> int:
    """Point d'entree de la CLI."""
    parser = build_parser()
    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help(sys.stderr)
        return 1

    commands = {
        "scrape": cmd_scrape,
        "upload-amazon": cmd_upload_amazon,
        "upload-cdiscount": cmd_upload_cdiscount,
        "upload-all": cmd_upload_all,
    }

    handler = commands[args.command]
    return int(handler(args))


if __name__ == "__main__":
    sys.exit(main())
