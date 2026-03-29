# Spectyra brand system

## Identity
The brand should feel: calm, trustworthy, technically precise, quietly powerful.
Not flashy. Not loud. Like infrastructure you can rely on.

## Fonts
- Display / headings: Source Sans Pro (weights 400, 600, 700)
- Body / UI: DM Sans (weights 300, 400, 500)
- Monospace / code / data: DM Mono (weights 300, 400, 500)

## Color palette (exact hex values)

### Primary
--spectyra-navy:        #0C447C   /* primary brand, headers, CTAs */
--spectyra-navy-deep:   #042C53   /* dark surfaces, active states */
--spectyra-navy-mid:    #185FA5   /* interactive elements */
--spectyra-blue:        #378ADD   /* secondary, highlights */
--spectyra-blue-light:  #85B7EB   /* subtle accents */
--spectyra-blue-pale:   #E6F1FB   /* light surfaces, backgrounds */

### Accent
--spectyra-teal:        #1D9E75   /* healthy / active / success */
--spectyra-teal-light:  #5DCAA5   /* teal text on dark bg */
--spectyra-teal-pale:   #E1F5EE   /* teal surface/badge bg */
--spectyra-teal-border: #9FE1CB   /* teal card borders */

### Warning
--spectyra-amber:       #BA7517   /* warning state, anomalies */
--spectyra-amber-light: #EF9F27   /* amber text on dark bg */
--spectyra-amber-pale:  #FAEEDA   /* warning surface */
--spectyra-amber-border:#FAC775   /* warning borders */

### Neutral
--spectyra-slate:       #444441
--spectyra-slate-mid:   #888780
--spectyra-slate-light: #D3D1C7
--spectyra-slate-pale:  #F1EFE8

## Dark mode surfaces (desktop / electron)
--bg:            #0a0f1a   /* page background */
--bg-panel:      #0e1521   /* sidebars, nav, titlebar */
--bg-card:       #121c2e   /* cards */
--bg-elevated:   #162236   /* hover states, elevated cards */
--border:        rgba(55,138,221,0.12)
--border-bright: rgba(55,138,221,0.25)
--text-primary:  #e8f1fb
--text-secondary:#7a9fc0
--text-muted:    #3d5a78

## Semantic color usage (CRITICAL — never swap these)
- Healthy / running / success  → teal  (#1D9E75 / #5DCAA5)
- Warning / anomaly / slow     → amber (#BA7517 / #EF9F27)
- Error / critical             → use CSS var(--color-danger) only
- Primary data / scores        → navy  (#0C447C)
- Interactive / links          → blue  (#378ADD)
- Neutral chrome / labels      → slate

## Status indicators (agent monitoring)
Dot size: 7px, border-radius: 50%
- Healthy:  background #1D9E75
- Warning:  background #BA7517
- Running:  background #378ADD  (with pulse animation)
- Offline:  background #444441
- Error:    background var(--color-danger)

Pulse animation for live/running states:
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
  animation: pulse 2s ease-in-out infinite;

## Logo
The logo mark is an abstract spectral waveform: three overlapping arcs of
decreasing size radiating from a center point, suggesting both a spectrum
and compression. Navy (#0C447C) on light, #E6F1FB on dark.
Wordmark: "Spectyra" in Source Sans Pro 700. Letter-spacing: 0.02em.

## Component rules
- Border radius: 4px (chips/badges), 8px (inputs/buttons), 12px (cards)
- Border width: 0.5px default, 1px for focus/active
- Card style: background var(--bg-card), border 1px solid var(--border)
- Chip/badge padding: 2px 8px, font DM Mono 10px uppercase, letter-spacing 0.04em
- All agent/session IDs: DM Mono, truncated to 8 chars + ellipsis
- Timestamps: DM Mono, color text-muted
- Token counts: DM Mono, font-weight 500
- Savings amounts: color teal, font-weight 500
- Reduction %: color teal if positive, amber if regression

## Do not
- No gradients on primary backgrounds
- No drop shadows (use border instead)
- No purple, pink, or coral anywhere in product UI
- No Inter, Roboto, Syne, or system-ui fonts
- Never use red for warnings — amber only; red reserved for errors/critical
