# Team United Christmas party invite (pilot)

Local pilot for Playfair Fun & Games. Tagline: You're Invited to Play.

Test-only GitHub Pages link for Mike to try on his phone. rsvpEndpoint is still "local" (replies stay in the browser; nothing is emailed). This is not a public product launch. The page is noindex.

## Open it on a phone or computer

From this folder:

    python3 -m http.server 8765

Then open http://127.0.0.1:8765/ on a computer, or that address on a phone on the same network. Opening the HTML file directly as a file:// URL may block config.json and the Home Screen manifest.

On iPhone: Safari → Share → Add to Home Screen.

## Party details and landing copy

All guest-facing details live in `config.json`:

- Host: Mike Moncada
- Landing headline: Mike Moncada is inviting you to a Christmas party!
- Subline: But only the worthy get the details!
- Event: Team United Christmas Party
- Date: Saturday, December 12, 2026
- Time: 4:00 PM
- Location: 223A Hickory Lane, Barrie
- RSVP: guests fill in the reveal-card form (family name, how many will attend, what dish they are bringing, optional cookie-contest checkbox)
- Cookie contest note (editable as cookieContestNote in config.json): Optional cookie contest! Must be homemade and Christmas themed.

## RSVP

`rsvpEndpoint` in `config.json` is currently `"local"`. Submissions are saved in this browser's localStorage (and logged to the developer console) so the form can be tested. They are not sent to Mike until a real endpoint is added.

To collect replies for real, set `rsvpEndpoint` to an HTTPS URL that accepts a JSON POST with `familyName`, `attendingCount`, `dish`, `eventName`, `date`, `time`, `location`, `hostName`, and `submittedAt`. See the notes in ATTRIBUTION.md and the launch-plan report for setup options. Do not leave `"local"` on a link you share with guests.

The form has no ads and no extra tracking. It only sends what the guest types, if they choose to submit.

## What the guest sees

1. “Mike Moncada is inviting you to a Christmas party!” and “But only the worthy get the details!”
2. How to play
3. One short Christmas volleyball level: a cartoony girl player tosses up a stream of balls; you tap or swipe to send each ball at waddling snowmen who are trying to hug her
4. After a few fails, assist turns on and a Skip button appears
5. The reveal card with the party details and the RSVP form
6. Footer: Made by Playfair Fun & Games, with the tagline
