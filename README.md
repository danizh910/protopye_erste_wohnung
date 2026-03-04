# Erste eigene Wohnung – Prototype

## Start

```bash
python3 -m http.server 4173
```

Dann im Browser `http://localhost:4173` öffnen.

## Prototype Flow

1. Home öffnen und auf **🏠 Erste eigene Wohnung** klicken.
2. Im Onboarding auf **Start Checkliste**.
3. In der Checkliste die Schritte in Reihenfolge öffnen.
4. **Kaution organisieren**: Betrag eingeben & bestätigen, dann zu Invite wechseln und Signaturen simulieren.
5. **Budget planen**: Basiskosten + Zusatzpunkte pflegen und speichern.
6. **Dauerauftrag einrichten**: Empfänger, IBAN, Betrag, Tag und Verwendungszweck hinterlegen.
7. **Versicherung prüfen**: passende Optionen auswählen und speichern.
8. **Wohnungsdokumente**: Datei auswählen und Upload für Mietvertrag/Kautionsbestätigung simulieren.
9. Nach 6/6 erledigten Tasks öffnet sich die Abschlussseite **🎉 Geschafft!** automatisch.
10. Über **Reset Prototype** wird `localStorage` gelöscht und der Flow neu gestartet.
