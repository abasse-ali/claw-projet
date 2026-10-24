"""
Client pour l'API Amazon Selling Partner (SP-API) Feeds API.

Utilise le feed type JSON_LISTINGS_FEED pour creer/mettre a jour des
fiches produits sur Amazon.

Flux d'authentification :
1. Obtenir un token d'acces LWA (Login with Amazon) via le refresh token.
2. Signer les requetes SP-API avec AWS SigV4.
3. Creer un document de flux, uploader le JSON, creer le flux, interroger le statut.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional

import requests
from requests_aws4auth import AWS4Auth

from config import AmazonConfig
from models import Product

logger = logging.getLogger(__name__)

# Feed type pour les listings produit au format JSON
FEED_TYPE_JSON_LISTINGS = "JSON_LISTINGS_FEED"

# Endpoint LWA pour obtenir un token d'acces
LWA_TOKEN_ENDPOINT = "https://api.amazon.com/auth/o2/token"

# Intervalle de polling pour le statut du flux (en secondes)
FEED_POLL_INTERVAL = 30
# Timeout maximal d'attente du traitement du flux (10 minutes)
FEED_POLL_TIMEOUT = 600


class AmazonAPIError(Exception):
    """Erreur liee a l'API Amazon SP-API."""


class AmazonClient:
    """
    Client pour l'API Amazon SP-API.

    Gere l'authentification LWA, la signature SigV4 et le workflow
    de soumission de flux (create feed document -> upload -> create feed -> poll).
    """

    def __init__(self, config: AmazonConfig):
        self.config = config
        self._http_session: Optional[requests.Session] = None
        self._lwa_access_token: Optional[str] = None
        self._lwa_token_expires_at: float = 0

    # ------------------------------------------------------------------
    # Authentification
    # ------------------------------------------------------------------

    @property
    def _aws_auth(self) -> AWS4Auth:
        """Retourne l'objet d'authentification AWS SigV4."""
        return AWS4Auth(
            self.config.aws_access_key_id,
            self.config.aws_secret_access_key,
            self.config.aws_region,
            "execute-api",
            session_token=None,
        )

    @property
    def _session(self) -> requests.Session:
        """Session HTTP lazy, cachee et reusee."""
        if self._http_session is None:
            sess = requests.Session()
            sess.headers.update({
                "User-Agent": "AtelierDeLaFourmi-Bot/1.0 (Amazon SP-API integration)",
            })
            self._http_session = sess
        return self._http_session

    def _get_lwa_access_token(self) -> str:
        """
        Obtient un token d'acces LWA en rafraichissant le refresh token.

        Cache le token tant qu'il n'est pas expire.
        """
        if self._lwa_access_token and time.time() < self._lwa_token_expires_at:
            return self._lwa_access_token

        logger.info("Obtention d'un token d'acces LWA...")
        data = {
            "grant_type": "refresh_token",
            "refresh_token": self.config.lwa_refresh_token,
            "client_id": self.config.lwa_client_id,
            "client_secret": self.config.lwa_client_secret,
        }
        response = requests.post(
            LWA_TOKEN_ENDPOINT,
            data=data,
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        token_data = response.json()

        self._lwa_access_token = token_data["access_token"]
        # Le token expire apres access_token_ttl secondes
        ttl = token_data.get("expires_in", 3600)
        self._lwa_token_expires_at = time.time() + ttl - 60  # 60s de marge

        logger.debug("Token LWA obtenu, expire dans %s secondes", ttl)
        return self._lwa_access_token

    def _signed_headers(self) -> Dict[str, str]:
        """Retourne les en-tieres d'authentification pour les requetes SP-API."""
        return {
            "x-amz-access-token": self._get_lwa_access_token(),
        }

    # ------------------------------------------------------------------
    # Feed workflow
    # ------------------------------------------------------------------

    def _create_feed_document(self, feed_content_type: str = "application/json") -> Dict[str, Any]:
        """
        Cree un document de flux et retourne l'URL S3 pour l'upload.

        Returns:
            Dict contenant 'feedDocumentId' et 'url' (URL S3 pre-signee).
        """
        url = f"{self.config.sp_api_endpoint}/feeds/2021-06-30/documents"
        body = {
            "contentType": feed_content_type,
        }

        response = self._session.post(
            url,
            auth=self._aws_auth,
            headers={
                **self._signed_headers(),
                "Content-Type": "application/json",
            },
            json=body,
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        data = response.json()

        logger.info("Document de flux cree : %s", data.get("feedDocumentId"))
        return data

    def _upload_feed(self, s3_url: str, feed_content: str, content_type: str = "application/json") -> None:
        """Uploade le contenu du flux vers l'URL S3 pre-signee."""
        response = requests.put(
            s3_url,
            data=feed_content.encode("utf-8"),
            headers={"Content-Type": content_type},
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        logger.info("Flux telecharge sur S3 avec succes")

    def _create_feed(self, feed_document_id: str, feed_type: str = FEED_TYPE_JSON_LISTINGS) -> str:
        """
        Cree un flux avec le document et le type de flux.

        Returns:
            L'ID du flux cree.
        """
        url = f"{self.config.sp_api_endpoint}/feeds/2021-06-30/feeds"
        body = {
            "feedType": feed_type,
            "marketplaceIds": self.config.marketplace_ids,
            "inputFeedDocumentId": feed_document_id,
        }

        response = self._session.post(
            url,
            auth=self._aws_auth,
            headers={
                **self._signed_headers(),
                "Content-Type": "application/json",
            },
            json=body,
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        data = response.json()
        feed_id = data.get("feedId")
        logger.info("Flux cree : %s (type=%s)", feed_id, feed_type)
        return feed_id

    def _get_feed_status(self, feed_id: str) -> str:
        """
        Recupere le statut du traitement du flux.

        Returns:
            Le statut du flux (DONE, FATAL, IN_PROGRESS, etc.)
        """
        url = f"{self.config.sp_api_endpoint}/feeds/2021-06-30/feeds/{feed_id}"
        response = self._session.get(
            url,
            auth=self._aws_auth,
            headers={
                **self._signed_headers(),
                "Content-Type": "application/json",
            },
            timeout=self.config.timeout,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("processingStatus", "UNKNOWN")

    def _wait_for_feed(self, feed_id: str) -> str:
        """
        Attend que le traitement du flux se termine.

        Returns:
            Le statut final du flux.
        """
        deadline = time.time() + FEED_POLL_TIMEOUT
        while time.time() < deadline:
            status = self._get_feed_status(feed_id)
            logger.info("Statut du flux %s : %s", feed_id, status)

            if status in ("DONE", "FATAL"):
                return status

            time.sleep(FEED_POLL_INTERVAL)

        logger.warning("Timeout d'attente du flux %s", feed_id)
        return "TIMEOUT"

    # ------------------------------------------------------------------
    # Feed content generation
    # ------------------------------------------------------------------

    def build_listings_feed(self, products: List[Product]) -> str:
        """
        Construit le contenu JSON du flux JSON_LISTINGS_FEED pour une liste de produits.

        Args:
            products: Liste de produits a publier.

        Returns:
            Le contenu JSON du flux, serialise en chaine.
        """
        messages = []
        for index, product in enumerate(products, start=1):
            message = self._build_feed_message(index, product)
            messages.append(message)

        feed = {
            "header": {
                "sellerId": self.config.seller_id,
                "version": "2.0",
                "issueLocale": "fr_FR",
            },
            "messages": messages,
        }

        return json.dumps(feed, ensure_ascii=False, indent=2)

    def _build_feed_message(self, message_id: int, product: Product) -> Dict[str, Any]:
        """Construit un message de flux pour un produit."""
        attributes: List[Dict[str, Any]] = []

        # Titre du produit
        attributes.append({
            "item_name": [{"value": product.name, "language": "fr_FR"}],
        })

        # Description
        if product.description:
            attributes.append({
                "product_description": [{"value": product.description, "language": "fr_FR"}],
            })

        # Images
        if product.image_url:
            attributes.append({
                "main_product_image": [{"link": product.image_url}],
            })

        # Points cles (bullet points)
        if product.attributes.get("bullet_points"):
            bullets = [{"value": b, "language": "fr_FR"} for b in product.attributes["bullet_points"]]
            attributes.append({"bullet": bullets})

        # Attribution produit (marque)
        if product.brand:
            attributes.append({
                "brand": [{"value": product.brand}],
            })

        # Attributs supplementaires depuis le scraping
        if product.attributes.get("dimensions"):
            attributes.append({
                "size_name": [{"value": product.attributes["dimensions"]}],
            })

        message: Dict[str, Any] = {
            "messageId": message_id,
            "sku": product.sku,
            "operationType": "UPDATE",
            "productType": "PRODUCT",
            "attributes": {},
        }

        # Fusionner tous les dictionnaires d'attributs
        for attr in attributes:
            for key, value in attr.items():
                message["attributes"][key] = value

        # Inclure le prix dans l'offre du flux
        message["attributes"]["offers"] = [
            {
                "price": product.price,
                "currency": product.currency,
                "quantity": product.stock_quantity,
            }
        ]

        return message

    # ------------------------------------------------------------------
    # Operations publiques
    # ------------------------------------------------------------------

    def submit_products(self, products: List[Product], wait: bool = True, dry_run: bool = False) -> Dict[str, Any]:
        """
        Soumet une liste de produits sur Amazon via un flux JSON_LISTINGS_FEED.

        Args:
            products: Liste de produits a publier.
            wait: Si True, attend que le flux soit traite.
            dry_run: Si True, genere le flux mais ne l'envoie pas.

        Returns:
            Dict avec 'feed_id', 'status', 'product_count'.
        """
        if not self.config.is_configured:
            raise AmazonAPIError(
                "Configuration Amazon incomplete. Definissez AMAZON_SELLER_ID, "
                "AMAZON_AWS_ACCESS_KEY_ID, AMAZON_AWS_SECRET_ACCESS_KEY, "
                "AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, AMAZON_LWA_REFRESH_TOKEN."
            )

        if not products:
            logger.warning("Aucun produit a soumettre sur Amazon")
            return {"feed_id": None, "status": "SKIPPED_EMPTY", "product_count": 0}

        # Generer le contenu du flux
        feed_content = self.build_listings_feed(products)
        logger.info("Flux JSON genere pour %d produits (taille: %d octets)", len(products), len(feed_content))

        if dry_run:
            logger.info("[MODE TEST] Flux genere mais non envoye : %s", feed_content[:500])
            return {"feed_id": None, "status": "DRY_RUN", "product_count": len(products)}

        # Etape 1 : creer le document de flux
        feed_doc = self._create_feed_document()
        feed_document_id = feed_doc["feedDocumentId"]
        upload_url = feed_doc["url"]

        # Etape 2 : uploader le flux JSON sur S3
        self._upload_feed(upload_url, feed_content)

        # Etape 3 : creer le flux
        feed_id = self._create_feed(feed_document_id)

        # Etape 4 : attendre le traitement
        status = "SUBMITTED"
        if wait:
            status = self._wait_for_feed(feed_id)

        return {
            "feed_id": feed_id,
            "status": status,
            "product_count": len(products),
        }


def main() -> int:
    """Test rapide de la generation de flux."""
    import argparse
    import os
    import sys

    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

    parser = argparse.ArgumentParser(
        description="Soumettre des produits sur Amazon via SP-API (Feeds API)."
    )
    parser.add_argument(
        "--input", "-i",
        default="products.json",
        help="Fichier JSON contenant les produits (defaut: products.json)",
    )
    parser.add_argument(
        "--wait",
        action="store_true",
        help="Attendre que le flux soit traite avant de quitter.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generer le flux sans l'envoyer sur Amazon.",
    )

    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"Erreur : fichier {args.input} introuvable.", file=sys.stderr)
        return 1

    with open(args.input, "r", encoding="utf-8") as f:
        products_data = json.load(f)

    products = [Product(**data) for data in products_data]

    config = AmazonConfig()
    client = AmazonClient(config)

    try:
        result = client.submit_products(products, wait=args.wait, dry_run=args.dry_run)
        print(json.dumps(result, indent=2, ensure_ascii=False))
        return 0
    except AmazonAPIError as exc:
        print(f"Erreur Amazon : {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
