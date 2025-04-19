# **App Name**: MapYOO Web Client

## Core Features:

- Landing Page: Display a landing page with sections for 'Deliver a Package' and 'Deliver a Meal', each with a button and brief description.
- Registration Forms: Implement dynamic forms for client and delivery personnel registration, adapting based on individual or company selection. Enforce strict validation rules.
- Package Order Form: Enable individual clients to input package delivery details, including pickup and destination addresses, recipient information, and package details. Display a confirmation page with tracking details after submission.
- Login System: Implement a login system using email and password with a 'Forgot Password' link.
- Recover Password: Allow users to request a password reset via WhatsApp or Email and verify the code.

## Style Guidelines:

- Primary color: White (#FFFFFF) for a clean and modern look.
- Secondary color: Light gray (#F2F2F2) for backgrounds and subtle dividers.
- Accent color: Teal (#008080) for primary buttons and interactive elements.
- Clean and readable sans-serif font for all text elements.
- Use modern, outlined icons for navigation and key actions.
- Use a grid-based layout for consistent spacing and alignment.

## Original User Request:
DASHBOARD CLIENT — LIVRAISON APP (MapYOO)
UTILISATEURS DE L'APPLICATION

Clients (individuels et entreprises)

Livreurs (individuels ou sociétés)

Admin

 TYPES DE LIVRAISON

Colis (documents, objets, etc.)

Repas (restaurants, snacks, plats faits maison)

Courses

Médicaments

ACCÈS

Web

Application mobile (Android & iOS)
 ZONE DE COUVERTURE

Internationale ("tout le monde")

💰 MOYENS DE PAIEMENT

En ligne (Carte, Wallet, etc.)

Paiement à la livraison (COD)

📍 SUIVI EN TEMPS RÉEL

Par GPS intégré

🏠 PAGE D’ACCUEIL (HOME PAGE)

Header :

Logo "MapYOO"

Menu : Repas | Colis

Boutons : Login | Sign Up | Help | Sélecteur de langue

Hero Section :

Livrer un colis

Bouton : "Livrer un colis"

Texte : "Expédiez vos colis en un clin d’œil..."

Visuel de livraison

Livrer un repas

Bouton : "Livrer un repas"

Texte : "Optimisez vos livraisons et touchez plus de clients..."

Visuel restauration

Section complémentaire + Footer :

À proposer selon design

🔐 INSCRIPTION / CONNEXION

👤 Clients (Individuel / Société)

Formulaire dynamique selon case cochée

Client Société :

Nom de société, Téléphones, Email, Mot de passe

RC ou IF (upload)

ICE (optionnel)

Redirection vers dashboard client

Client Individuel :

Nom, Prénom, Téléphones, Email, Mot de passe

CIN (Recto/Verso - upload)

Redirection vers dashboard client

🚴 Livreurs (Individuel / Société)

Livreur Société :

Nom de société, Téléphones, Email, Mot de passe

RC ou IF (upload)

ICE (optionnel)

Livreur Individuel :

Nom, Prénom, Téléphones, Email, Mot de passe

CIN (Recto/Verso), Carte Auto-entrepreneur (CAE)

Validation stricte : Email déjà utilisé, format incorrect, mot de passe non valide, etc.

🔑 Connexion (Login)

Email + Mot de passe

Lien "Mot de passe oublié"

🔄 Mot de passe oublié

Choix entre WhatsApp ou Email

Code de vérification (6 chiffres)

Création nouveau mot de passe

🧍 DASHBOARD CLIENT INDIVIDUEL

Commander un colis :

Formulaire :

Adresse de ramassage, adresse de destination

Nom, prénom, téléphone du destinataire

Détails du colis

Paiement : en ligne ou COD

Suivi GPS de la commande

Historique des commandes

Liste avec statut (en cours, livré, annulé)

🏢 DASHBOARD ENTREPRISE CLIENT

Entrée de colis :

Formulaire manuel ou import Excel

Stockage dans l’entrepôt

Demande de livraison :

Bouton : "Livrer tout"

Ou sélection des colis à livrer

Statut : suivi GPS, livraison confirmée

Impression d’étiquettes :

Bouton à côté de chaque commande

Ou bouton global "Imprimer toutes les étiquettes"

👤 DASHBOARD ADMIN

Notifications en temps réel des nouvelles commandes

Vue séparée : commandes individuelles / entreprises

Consultation client avec tableau des commandes

Boutons d'action :

"Consulter la commande"

"Imprimer l’étiquette"

"Imprimer toutes les étiquettes"

"Livrer" (changement de statut → client et entreprise sont informés)

Assignation des livreurs :

Bouton "Assigner à un livreur"

Sélection dans une liste de livreurs disponibles

🚴 DASHBOARD LIVREUR

Liste des commandes assignées par l’admin

Détails pour chaque commande :

Adresse de départ/destination

Téléphones, nom du destinataire

Type de commande (repas, colis, etc.)

Bouton "Livré" :

À côté de chaque commande

Change automatiquement le statut côté client et admin ("Livré")

Envoie une notification au client

Historique des livraisons

Statistiques de performance (optionnel)

Tu peux me demander :

D’écrire l’interface de chaque dashboard (UI)

Générer un cahier des charges technique ou fonctionnel

Générer du code frontend/backend

Simuler les parcours utilisateurs

Prêt à passer à l’étape suivante ?
  