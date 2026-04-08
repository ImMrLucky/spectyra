import { Component } from '@angular/core';

/**
 * Brand mark: three arcs suggesting a spectral waveform / compression (see spectyra-brand.md).
 * Use where a neutral Spectyra glyph is preferable to generic “AI” iconography.
 */
@Component({
  selector: 'app-spectyra-mark',
  standalone: true,
  template: `
    <svg class="spectyra-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <!-- Three arcs from a common origin — spectral / compression mark -->
        <path d="M 5 12 A 10 10 0 0 1 18 9" opacity="0.38" />
        <path d="M 5 12 A 7.5 7.5 0 0 1 17 10" opacity="0.62" />
        <path d="M 5 12 A 5 5 0 0 1 15.5 11" />
      </g>
    </svg>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        line-height: 0;
      }
      .spectyra-mark {
        width: var(--spectyra-mark-size, 1.35em);
        height: var(--spectyra-mark-size, 1.35em);
        color: var(--spectyra-mark-color, var(--spectyra-blue, #378add));
      }
    `,
  ],
})
export class SpectyraMarkIconComponent {}
