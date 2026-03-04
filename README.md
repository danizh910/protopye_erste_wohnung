# Erste eigene Wohnung – Prototype

## Start

Nutze einen statischen Server, z. B.:

```bash
python3 -m http.server 4173
```

Dann im Browser `http://localhost:4173` öffnen.

## Prototype Flow

1. Home öffnen und auf **🏠 Erste eigene Wohnung** klicken.
2. Im Onboarding auf **Start Checkliste** gehen.
3. In der Checkliste Task **Kaution organisieren** öffnen.
4. Im Kautionsflow Betrag bestätigen und über **Mitbewohner einladen** auf Invite wechseln.
5. Im Invite-Screen Personen hinzufügen oder Signatur simulieren, dann Task als erledigt markieren.
6. Task **Budget planen** öffnen, Werte prüfen und speichern.
7. Task **Mietvertrag hochladen** / **Dokumente speichern** über **Wohnungsdokumente** mit Upload-Simulation abschließen.
8. Sobald alle 6 Tasks erledigt sind, ist der Done-Screen erreichbar (oder automatische Navigation).
9. Über **Reset Prototype** wird der lokale Zustand in `localStorage` gelöscht.
