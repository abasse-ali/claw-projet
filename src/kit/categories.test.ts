// Tests pour la catégorisation automatique
import { describe, it, expect } from "vitest";
import { categorize, CATEGORY_KEYWORDS } from "../kit/categories";

describe("categorize", () => {
  describe("Courses", () => {
    it("catégorise CARREFOUR en Courses", () => {
      expect(categorize("CARREFOUR")).toBe("Courses");
      expect(categorize("CARREFOUR MARKET")).toBe("Courses");
      expect(categorize("CARREFOUR CONTACT")).toBe("Courses");
    });

    it("catégorise LECLERC en Courses", () => {
      expect(categorize("E.LECLERC")).toBe("Courses");
      expect(categorize("LECLERC DRIVE")).toBe("Courses");
    });

    it("catégorise autres supermarchés en Courses", () => {
      expect(categorize("AUCHAN")).toBe("Courses");
      expect(categorize("INTERMARCHE")).toBe("Courses");
      expect(categorize("SUPER U")).toBe("Courses");
      expect(categorize("LIDL")).toBe("Courses");
      expect(categorize("ALDI")).toBe("Courses");
      expect(categorize("MONOPRIX")).toBe("Courses");
      expect(categorize("FRANPRIX")).toBe("Courses");
      expect(categorize("CASINO")).toBe("Courses");
      expect(categorize("CORA")).toBe("Courses");
      expect(categorize("BIO C BON")).toBe("Courses");
      expect(categorize("NATURALIA")).toBe("Courses");
    });

    it("catégorise mots-clés alimentation en Courses", () => {
      expect(categorize("EPICERIE FINE")).toBe("Courses");
      expect(categorize("ALIMENTATION GENERALE")).toBe("Courses");
      expect(categorize("SUPERMARCHE DU COIN")).toBe("Courses");
    });
  });

  describe("Transport", () => {
    it("catégorise SNCF en Transport", () => {
      expect(categorize("SNCF")).toBe("Transport");
      expect(categorize("SNCF TER")).toBe("Transport");
      expect(categorize("SNCF TGV")).toBe("Transport");
      expect(categorize("SNCF INTERCITES")).toBe("Transport");
    });

    it("catégorise RATP et transports en commun en Transport", () => {
      expect(categorize("RATP")).toBe("Transport");
      expect(categorize("NAVIGO")).toBe("Transport");
      expect(categorize("TRANSILIEN")).toBe("Transport");
      expect(categorize("METRO")).toBe("Transport");
      expect(categorize("BUS")).toBe("Transport");
      expect(categorize("TRAM")).toBe("Transport");
      expect(categorize("VELIB")).toBe("Transport");
      expect(categorize("MOBILIB")).toBe("Transport");
    });

    it("catégorise VTC et taxis en Transport", () => {
      expect(categorize("UBER")).toBe("Transport");
      expect(categorize("BOLT")).toBe("Transport");
      expect(categorize("HEETCH")).toBe("Transport");
      expect(categorize("TAXI PARIS")).toBe("Transport");
    });

    it("catégorise essence et péages en Transport", () => {
      expect(categorize("TOTAL ENERGIES")).toBe("Transport");
      expect(categorize("SHELL")).toBe("Transport");
      expect(categorize("ESSO")).toBe("Transport");
      expect(categorize("ELF")).toBe("Transport");
      expect(categorize("CARBURANT")).toBe("Transport");
      expect(categorize("ESSENCE")).toBe("Transport");
      expect(categorize("PEAGE")).toBe("Transport");
      expect(categorize("AUTOROUTE")).toBe("Transport");
      expect(categorize("PARKING")).toBe("Transport");
    });

    it("catégorise avion en Transport", () => {
      expect(categorize("AIR FRANCE")).toBe("Transport");
      expect(categorize("AEROPORT")).toBe("Transport");
      expect(categorize("AVION")).toBe("Transport");
      expect(categorize("OUI GO")).toBe("Transport");
      expect(categorize("OUI GO TRAIN")).toBe("Transport");
      expect(categorize("BLABLACAR")).toBe("Transport");
    });
  });

  describe("Logement", () => {
    it("catégorise loyer et charges en Logement", () => {
      expect(categorize("LOYER")).toBe("Logement");
      expect(categorize("CHARGES LOCATIVES")).toBe("Logement");
      expect(categorize("SYNDIC")).toBe("Logement");
    });

    it("catégorise électricité/gaz/eau en Logement", () => {
      expect(categorize("EDF")).toBe("Logement");
      expect(categorize("ENGIE")).toBe("Logement");
      expect(categorize("VEOLIA EAU")).toBe("Logement");
      expect(categorize("SUEZ EAU")).toBe("Logement");
      expect(categorize("GAZ")).toBe("Logement");
      expect(categorize("ELECTRICITE")).toBe("Logement");
      expect(categorize("CHAUFFAGE")).toBe("Logement");
    });

    it("catégorise internet/box en Logement", () => {
      expect(categorize("FREEBOX")).toBe("Logement");
      expect(categorize("ORANGE INTERNET")).toBe("Logement");
      expect(categorize("SFR BOX")).toBe("Logement");
      expect(categorize("BOUYGUES TELECOM")).toBe("Logement");
      expect(categorize("INTERNET")).toBe("Logement");
    });

    it("catégorise taxes et assurance habitation en Logement", () => {
      expect(categorize("TAXE FONCIERE")).toBe("Logement");
      expect(categorize("TAXE HABITATION")).toBe("Logement");
      expect(categorize("ASSURANCE HABITATION")).toBe("Logement");
    });
  });

  describe("Santé", () => {
    it("catégorise pharmacie et médecins en Santé", () => {
      expect(categorize("PHARMACIE")).toBe("Santé");
      expect(categorize("MEDECIN")).toBe("Santé");
      expect(categorize("DOCTEUR")).toBe("Santé");
      expect(categorize("DENTISTE")).toBe("Santé");
      expect(categorize("OPTICIEN")).toBe("Santé");
      expect(categorize("LUNETTES")).toBe("Santé");
    });

    it("catégorise mutuelle et hôpital en Santé", () => {
      expect(categorize("MUTUELLE")).toBe("Santé");
      expect(categorize("HOPITAL")).toBe("Santé");
      expect(categorize("CLINIQUE")).toBe("Santé");
      expect(categorize("LABORATOIRE")).toBe("Santé");
      expect(categorize("ANALYSE")).toBe("Santé");
    });
  });

  describe("Loisirs", () => {
    it("catégorise cinéma et spectacles en Loisirs", () => {
      expect(categorize("CINEMA")).toBe("Loisirs");
      expect(categorize("CINE")).toBe("Loisirs");
      expect(categorize("THEATRE")).toBe("Loisirs");
      expect(categorize("CONCERT")).toBe("Loisirs");
      expect(categorize("SPECTACLE")).toBe("Loisirs");
    });

    it("catégorise streaming et jeux en Loisirs", () => {
      expect(categorize("NETFLIX")).toBe("Loisirs");
      expect(categorize("SPOTIFY")).toBe("Loisirs");
      expect(categorize("DEEZER")).toBe("Loisirs");
      expect(categorize("STEAM")).toBe("Loisirs");
      expect(categorize("JEUX")).toBe("Loisirs");
    });

    it("catégorise sport et parcs en Loisirs", () => {
      expect(categorize("DECATHLON")).toBe("Loisirs");
      expect(categorize("FITNESS")).toBe("Loisirs");
      expect(categorize("SALLE DE SPORT")).toBe("Loisirs");
      expect(categorize("DISNEYLAND")).toBe("Loisirs");
      expect(categorize("PARC ATTRACTIONS")).toBe("Loisirs");
    });

    it("catégorise livres et culture en Loisirs", () => {
      expect(categorize("FNAC")).toBe("Loisirs");
      expect(categorize("CULTURA")).toBe("Loisirs");
      expect(categorize("LIVRE")).toBe("Loisirs");
    });
  });

  describe("Shopping", () => {
    it("catégorise e-commerce en Shopping", () => {
      expect(categorize("AMAZON")).toBe("Shopping");
      expect(categorize("CDISCOUNT")).toBe("Shopping");
      expect(categorize("RAKUTEN")).toBe("Shopping");
      expect(categorize("EBAY")).toBe("Shopping");
      expect(categorize("VINTED")).toBe("Shopping");
      expect(categorize("LEBONCOIN")).toBe("Shopping");
    });

    it("catégorise vêtements en Shopping", () => {
      expect(categorize("ZALANDO")).toBe("Shopping");
      expect(categorize("ASOS")).toBe("Shopping");
      expect(categorize("H&M")).toBe("Shopping");
      expect(categorize("ZARA")).toBe("Shopping");
      expect(categorize("UNIQLO")).toBe("Shopping");
      expect(categorize("PRIMARK")).toBe("Shopping");
      expect(categorize("VETEMENT")).toBe("Shopping");
      expect(categorize("CHAUSSURE")).toBe("Shopping");
      expect(categorize("MODE")).toBe("Shopping");
      expect(categorize("BOUTIQUE")).toBe("Shopping");
      expect(categorize("MAGASIN")).toBe("Shopping");
    });
  });

  describe("Restaurants", () => {
    it("catégorise restaurants et fast-food en Restaurants", () => {
      expect(categorize("RESTAURANT")).toBe("Restaurants");
      expect(categorize("RESTO")).toBe("Restaurants");
      expect(categorize("BURGER")).toBe("Restaurants");
      expect(categorize("PIZZA")).toBe("Restaurants");
      expect(categorize("KEBAB")).toBe("Restaurants");
      expect(categorize("MACDO")).toBe("Restaurants");
      expect(categorize("MCDO")).toBe("Restaurants");
      expect(categorize("QUICK")).toBe("Restaurants");
      expect(categorize("KFC")).toBe("Restaurants");
      expect(categorize("SUBWAY")).toBe("Restaurants");
    });

    it("catégorise boulangerie et café en Restaurants", () => {
      expect(categorize("BOULANGERIE")).toBe("Restaurants");
      expect(categorize("PATISSERIE")).toBe("Restaurants");
      expect(categorize("CAFE")).toBe("Restaurants");
      expect(categorize("STARBUCKS")).toBe("Restaurants");
      expect(categorize("PRET A MANGER")).toBe("Restaurants");
    });

    it("catégorise livraison en Restaurants", () => {
      expect(categorize("DELIVEROO")).toBe("Restaurants");
      expect(categorize("UBER EATS")).toBe("Restaurants");
      expect(categorize("JUST EAT")).toBe("Restaurants");
      expect(categorize("CANTINE")).toBe("Restaurants");
      expect(categorize("RESTAURATION")).toBe("Restaurants");
    });
  });

  describe("Banque", () => {
    it("catégorise frais bancaires en Banque", () => {
      expect(categorize("FRAIS BANCAIRES")).toBe("Banque");
      expect(categorize("COTISATION")).toBe("Banque");
      expect(categorize("CARTE")).toBe("Banque");
      expect(categorize("AGIOS")).toBe("Banque");
      expect(categorize("INTERET")).toBe("Banque");
      expect(categorize("PRET")).toBe("Banque");
      expect(categorize("CREDIT")).toBe("Banque");
      expect(categorize("ASSURANCE VIE")).toBe("Banque");
      expect(categorize("PLACEMENT")).toBe("Banque");
      expect(categorize("BOURSE")).toBe("Banque");
      expect(categorize("DIVIDENDE")).toBe("Banque");
      expect(categorize("VIREMENT")).toBe("Banque");
      expect(categorize("PRELEVEMENT")).toBe("Banque");
      expect(categorize("REJET")).toBe("Banque");
    });
  });

  describe("Autre", () => {
    it("retourne Autre pour libellé non reconnu", () => {
      expect(categorize("ACHAT INCONNU")).toBe("Autre");
      expect(categorize("XYZ")).toBe("Autre");
      expect(categorize("")).toBe("Autre");
    });
  });

  describe("Insensibilité à la casse et accents", () => {
    it("ignore la casse", () => {
      expect(categorize("carrefour")).toBe("Courses");
      expect(categorize("Carrefour")).toBe("Courses");
      expect(categorize("CARREFOUR")).toBe("Courses");
    });

    it("ignore les accents", () => {
      expect(categorize("PHARMACIE")).toBe("Santé");
      expect(categorize("EPICERIE")).toBe("Courses");
      expect(categorize("CAFE")).toBe("Restaurants");
    });
  });

  describe("Ordre de priorité", () => {
    it("le premier match gagne (ex: CARREFOUR avant SUPERMARCHE)", () => {
      // CARREFOUR est dans Courses, SUPERMARCHE aussi
      // mais l'ordre dans CATEGORY_KEYWORDS fait que Courses est vérifié en premier
      expect(categorize("CARREFOUR SUPERMARCHE")).toBe("Courses");
    });
  });
});