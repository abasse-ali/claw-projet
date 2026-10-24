"""
Client pour l'API CDiscount / Octopia (REST API).

Gere l'authentification OAuth2 et la soumission de produits et d'offres
via les endpoints /products-integration et /offers-integration.

Documentation : https://developer.octopia-io.net/
"""

import json
import logging
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional

import requests

from config import CDiscountConfig
from models import Product

logger = logging.getLogger(__name__)

# Endpoint standard pour l'authentification OAuth2
OAUTH_TOKEN_ENDPOINT = "/oauth/v2/token"
# Endpoint alternatif pour l'authentification par cle API
API_KEY_ENDPOINT = "/authentication/api-key"

# Intervalle de polling pour le statut d'integration
INTEGRATION_POLL_INTERVAL = 5
INTEGRATION_POLL_TIMEOUT = 300


class CDiscountAPIError(Exception):
    """Erreur liee a l'API CDiscount / Octopia."""


class CDiscountClient:
    """
    Client pour l'API CDiscount Octopia.

    Gere :
    - L'authentification OAuth2 (ou cle API).
    - La creation/enrichissement de fiches produits via /products-integration.
    - La creation/mise a jour d'offres via /offers-integration.
    - Le suivi du statut d'integration via /products-integration-reports et /offers-integration-reports.
    """

    def __init__(self, config: CDiscountConfig):
        self.config = config
        self._session: Optional[requests.Session] = None
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0

    # ------------------------------------------------------------------
    # HTTP session
    # ------------------------------------------------------------------

    @property
    def session(self) -> requests.Session:
        """Session HTTP lazy, cachee et reusee."""
        if self._session is None:
            sess = requests.Session()
            sess.headers.update({
                "User-Agent": "AtelierDeLaFourmi-Bot/1.0 (CDiscount Octopia API integration)",
                "Content-Type": "application/json",
            })
            # Retry strategy
            from requests.adapters import HTTPAdapter
            from urllib3.util.retry import Retry

            retry = Retry(
                total=3,
                backoff_factor=0.5,
                status_forcelist=[429, 500, 502, 503, 504],
                allowed_methods=["GET", "POST", "PUT"],
                raise_on_status=False,
            )
            adapter = HTTPAdapter(max_retries=retry)
            sess.mount("http://", adapter)
            sess.mount("https://", adapter)
            self._session = sess
        return self._session

    # ------------------------------------------------------------------
    # Authentification
    # ------------------------------------------------------------------

    def _request_token(self) -> str:
        """
        Obtient un token d'acces OAuth2 via le flux client_credentials,
        ou via l'endpoint /authentication/api-key en fallback.
        """
        logger.info("Authentification a l'API CDiscount Octopia...")

        # Essai 1 : OAuth2 client credentials
        try:
            response = self.session.post(
                f"{self.config.api_endpoint}/oauth/v2/token",
                data={"grant_type": "client_credentials"},
                auth=(self.config.client_id, self.config.client_secret),
                timeout=self.config.timeout,
            )
            if response.status_code == 200:
                token_data = response.json()
                token = token_data.get("access_token") or token_data.get("token")
                expires_in = token_data.get("expires_in", 3600)
                self._token_expires_at = time.time() + expires_in - 60
                logger.debug("Token OAuth2 obtentu, expire dans %ss", expires_in)
                self._access_token = token
                return token
        except (requests.RequestException, KeyError, json.JSONDecodeError) as exc:
            logger.debug("OAuth2 client_credentials a echoue : %s", exc)

        # Essai 2 : cle API
        response = self.session.post(
            f"{self.config.api_endpoint}/authentication/api-key",
            json={"clientId": self.config.client_id, "clientSecret": self.config.client_secret},
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        token_data = response.json()
        token = token_data.get("token") or token_data.get("access_token")
        if not token:
            raise CDiscountAPIError(
                f"Echec de l'authentification : reponse inattendue: {token_data}"
            )

        expires_in = token_data.get("expires_in", 3600)
        self._token_expires_at = time.time() + expires_in - 60
        self._access_token = token
        logger.debug("Token d'acces obtentu via cle API, expire dans %ss", expires_in)
        return token

    def _get_access_token(self) -> str:
        """Retourne le token d'acces, en le rafraichissant si expire."""
        if self._access_token and time.time() < self._token_expires_at:
            return self._access_token
        return self._request_token()

    def _auth_headers(self) -> Dict[str, str]:
        """Retourne les en-tieres d'authentification pour les requetes API."""
        token = self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

    def _post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        """Effectue une requete POST authentifiee vers l'API Octopia."""
        url = f"{self.config.api_endpoint}{path}"
        response = self.session.post(
            url,
            headers=self._auth_headers(),
            json=body,
            timeout=self.config.timeout,
        )
        self._handle_response_error(response, f"POST {path}")
        try:
            return response.json()
        except json.JSONDecodeError:
            return {"raw": response.text}

    def _get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Effectue une requete GET authentifiee vers l'API Octopia."""
        url = f"{self.config.api_endpoint}{path}"
        response = self.session.get(
            url,
            headers=self._auth_headers(),
            params=params,
            timeout=self.config.timeout,
        )
        self._handle_response_error(response, f"GET {path}")
        try:
            return response.json()
        except json.JSONDecodeError:
            return {"raw": response.text}

    @staticmethod
    def _handle_response_error(response: requests.Response, operation: str) -> None:
        """Gere les erreurs de reponse HTTP (retry sur 429 et 5xx)."""
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 5))
            logger.warning("Taux limite (429) pour %s, retry apres %ds", operation, retry_after)
            time.sleep(retry_after)
            raise CDiscountAPIError(f"Taux limite pour {operation}")

        if response.status_code >= 500:
            logger.warning("Erreur serveur ({}) pour %s", response.status_code, operation)
            raise CDiscountAPIError(f"Erreur serveur {response.status_code} pour {operation}")

        if response.status_code >= 400:
            try:
                error_data = response.json()
                message = error_data.get("message", response.text[:500])
            except (json.JSONDecodeError, ValueError):
                message = response.text[:500]
            raise CDiscountAPIError(f"Erreur {response.status_code} pour {operation}: {message}")

    # ------------------------------------------------------------------
    # Construction des payloads
    # ------------------------------------------------------------------

    def _build_product_payload(self, product: Product) -> Dict[str, Any]:
        """
        Construit le payload JSON pour la creation/enrichissement d'une
        fiche produit Octopia.
        """
        payload: Dict[str, Any] = {
            "sellerProductReference": product.sku,
            "title": product.name,
        }

        if product.description:
            payload["description"] = product.description

        if product.brand:
            payload["brand"] = product.brand

        # GTIN / EAN si disponible
        if product.gtin:
            payload["gtin"] = product.gtin

        # Images du produit
        if product.image_url:
            payload["sellerPictureUrls"] = [
                {"index": 1, "url": product.image_url}
            ]

        # Categorie (code requis par Octopia - a remplacer par le bon code)
        if product.category:
            payload["categoryCode"] = self._category_to_code(product.category)

        # Attributs (dimensions, materiau, couleur, etc.)
        attributes = self._build_attributes(product)
        if attributes:
            payload["attributes"] = attributes

        return payload

    def _category_to_code(self, category: str) -> str:
        """
        Mappe une categorie du site vers le code categorie Octopia.

        Les codes categories Octopia sont des chaines alphanumeriques
        specifiques a chaque categorie. Cette fonction fournit un mapping
        initial pour les categories d'Atelier de la Fourmi.
        """
        category_map = {
            "Panneaux PVC effet marbre": "15000",
            "Parquet PVC clipsable": "11000",
            "Barres de seuil & plintches": "14000",
            "Accessoires de finition": "16000",
            "Mobilier": "21000",
            "Salle de bain": "23000",
            "Décoration": "18000",
        }
        return category_map.get(category, "0")

    def _build_attributes(self, product: Product) -> List[Dict[str, Any]]:
        """
        Construit la liste des attributs produit pour Octopia.

        Les attributs incluent les caracteristiques scrapees (dimensions,
        materiau, couleur) et les bullet points.
        """
        attributes: List[Dict[str, Any]] = []

        # Extraire les caracteristiques des bullet points
        bullet_points = product.attributes.get("bullet_points", [])
        for point in bullet_points:
            # Tenter d'extraire des paires cle/valeur (ex: "Hauteur : 260 cm")
            match = re.match(r"([^-:]+)\s*[:‑-]\s*(.+)", point)
            if match:
                label = match.group(1).strip()
                value = match.group(2).strip()
                # Mappage des libelles d'attributs vers les references Octopia
                ref = self._attribute_label_to_ref(label)
                if ref:
                    attributes.append({
                        "propertyReference": ref,
                        "values": [value],
                    })

        return attributes

    @staticmethod
    def _attribute_label_to_ref(label: str) -> Optional[str]:
        """Mappe un libelle d'attribut vers une reference Octopia."""
        label_lower = label.lower().strip()
        ref_map = {
            "hauteur": "HEIGHT",
            "largeur": "WIDTH",
            "profondeur": "DEPTH",
            "epaisseur": "THICKNESS",
            "poids": "WEIGHT",
            "matiere": "MATERIAL",
            "couleur": "COLOR",
            "finition": "FINISH",
            "pose": "INSTALLATION_TYPE",
            "format lame": "LAME_FORMAT",
            "botte": "PACK_FORMAT",
        }
        return ref_map.get(label_lower)

    def _build_offer_payload(self, product: Product) -> Dict[str, Any]:
        """
        Construit le payload JSON pour la creation/mise a jour d'une offre.
        """
        offer: Dict[str, Any] = {
            "sellerExternalReference": f"OFFER-{product.sku}",
            "product": {
                "reference": product.sku,
            },
            "condition": "New",
            "price": {
                "price": round(product.price, 2),
                "taxes": [
                    {"code": "VAT", "value": 20}
                ],
            },
            "deliveryModes": [
                {"code": "THD", "cost": 5.99, "additionalCost": 0.0}
            ],
            "preparationTime": 2,
            "quantity": max(product.stock_quantity, 1),
        }

        # Inclure le GTIN si disponible
        if product.gtin:
            offer["product"]["gtin"] = product.gtin

        return offer

    # ------------------------------------------------------------------
    # Operations publiques
    # ------------------------------------------------------------------

    def submit_products(self, products: List[Product], wait: bool = True, dry_run: bool = False) -> Dict[str, Any]:
        """
        Soumet une liste de produits sur CDiscount/Octopia.

        Args:
            products: Liste de produits a publier.
            wait: Si True, attend que l'integration soit terminee.
            dry_run: Si True, genere les payloads sans les envoyer.

        Returns:
            Dict avec 'package_id', 'status', 'product_count'.
        """
        if not products:
            logger.warning("Aucun produit a soumettre sur CDiscount")
            return {"package_id": None, "status": "SKIPPED_EMPTY", "product_count": 0}

        # Construire les payloads produits
        product_payloads = [self._build_product_payload(p) for p in products]
        body = {"products": product_payloads}

        logger.info("Payload produit genere pour %d produits", len(product_payloads))

        if dry_run:
            logger.info("[MODE TEST] Payloads produits sans envoi : %s", json.dumps(body, indent=2)[:500])
            # Aussi generer les offres
            offer_payloads = [self._build_offer_payload(p) for p in products]
            return {
                "package_id": None,
                "status": "DRY_RUN",
                "product_count": len(products),
                "products_sample": product_payloads[:2],
                "offers_sample": offer_payloads[:2],
            }

        if not self.config.is_configured:
            raise CDiscountAPIError(
                "Configuration CDiscount incompletes. Definissez "
                "CDISCOUNT_CLIENT_ID et CDISCOUNT_CLIENT_SECRET."
            )

        # Etape 1 : soumettre les fiches produits
        response = self._post("/products-integration", body)
        package_id = response.get("packageId") or response.get("package_id")
        logger.info("Produits soumis, package_id=%s", package_id)

        product_status = "SUBMITTED"
        if wait and package_id:
            product_status = self._wait_for_product_integration(package_id)

        # Etape 2 : soumettre les offres
        offer_body = {"offers": [self._build_offer_payload(p) for p in products]}
        offer_response = self._post("/offers-integration", offer_body)
        offer_package_id = offer_response.get("packageId") or offer_response.get("package_id")
        logger.info("Offres soumises, package_id=%s", offer_package_id)

        offer_status = "SUBMITTED"
        if wait and offer_package_id:
            offer_status = self._wait_for_offer_integration(offer_package_id)

        return {
            "package_id": package_id,
            "offer_package_id": offer_package_id,
            "product_status": product_status,
            "offer_status": offer_status,
            "product_count": len(products),
        }

    def _wait_for_product_integration(self, package_id: str) -> str:
        """Attend que l'integration des produits soit terminee."""
        deadline = time.time() + INTEGRATION_POLL_TIMEOUT
        while time.time() < deadline:
            response = self._get(f"/products-integration-reports/{package_id}")
            status = response.get("status", "UNKNOWN")
            logger.info("Statut de l'integration produit (%s) : %s", package_id, status)

            if status in ("Done", "Integrated", "Completed", "FAILED", "Refused"):
                return status

            errors = response.get("errors", [])
            if errors:
                for err in errors[:3]:
                    logger.warning("Erreur d'integration : %s", err.get("message", err))

            time.sleep(INTEGRATION_POLL_INTERVAL)

        logger.warning("Timeout de l'integration produit (%s)", package_id)
        return "TIMEOUT"

    def _wait_for_offer_integration(self, package_id: str) -> str:
        """Attend que l'integration des offres soit terminee."""
        deadline = time.time() + INTEGRATION_POLL_TIMEOUT
        while time.time() < deadline:
            response = self._get(f"/offers-integration-reports/{package_id}")
            status = response.get("status", "UNKNOWN")
            logger.info("Statut de l'integration offre (%s) : %s", package_id, status)

            if status in ("Done", "Integrated", "Completed", "FAILED", "Refused"):
                return status

            time.sleep(INTEGRATION_POLL_INTERVAL)

        logger.warning("Timeout de l'integration offre (%s)", package_id)
        return "TIMEOUT"


# Import re au niveau du module pour _build_attributes
import re


def main() -> int:
    """Test rapide du client CDiscount."""
    import argparse
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="Soumettre des produits sur CDiscount via l'API Octopia."
    )
    parser.add_argument(
        "--input", "-i",
        default="products.json",
        help="Fichier JSON contenant les produits (defaut: products.json)",
    )
    parser.add_argument(
        "--wait",
        action="store_true",
        help="Attendre que l'integration soit terminee.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generer les payloads sans les envoyer.",
    )

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Erreur : fichier {args.input} introuvable.", file=sys.stderr)
        return 1

    with open(args.input, "r", encoding="utf-8") as f:
        products_data = json.load(f)

    products = [Product(**data) for data in products_data]

    config = CDiscountConfig()
    client = CDiscountClient(config)

    try:
        result = client.submit_products(products, wait=args.wait, dry_run=args.dry_run)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except CDiscountAPIError as exc:
        print(f"Erreur CDiscount : {exc}", file=sys.stderr)
        return 1


import sys


if __name__ == "__main__":
    sys.exit(main())
