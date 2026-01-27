# Component Refactoring Progress

## ✅ Completed (7 components)

1. ✅ `app.component.ts` → `app.component.html` + `app.component.css`
2. ✅ `components/org-switcher.component.ts` → `org-switcher.component.html` + `org-switcher.component.css`
3. ✅ `features/home/home.page.ts` → `home.page.html` + `home.page.css`
4. ✅ `features/auth/login.page.ts` → `login.page.html` + `login.page.css`
5. ✅ `features/auth/register.page.ts` → `register.page.html` + `register.page.css`
6. ✅ `features/settings/settings.page.ts` → `settings.page.html` + `settings.page.css`
7. ✅ `features/scenarios/scenarios.page.ts` → `scenarios.page.html` + `scenarios.page.css`
8. ✅ `features/runs/runs.page.ts` → `runs.page.html` + `runs.page.css`

## ⏳ Remaining (~15 components)

### Pages
- `features/admin/admin.page.ts`
- `features/billing/billing.page.ts`
- `features/run/run.page.ts`
- `features/savings/savings.page.ts`
- `features/projects/projects.page.ts`
- `features/integrations/integrations.page.ts`
- `features/connections/connections.page.ts`
- `features/proof/proof.page.ts`

### Components
- `features/run/savings-card.component.ts`
- `features/run/run-controls.component.ts`
- `features/run/tabs-debug.component.ts`
- `features/run/token-cost-table.component.ts`
- `features/run/compare-view.component.ts`
- `features/run/optimization-slider.component.ts`
- `features/run/tabs-prompt.component.ts`
- `features/run/tabs-output.component.ts`
- `features/savings/savings-kpis.component.ts`
- `features/savings/savings-by-path.component.ts`
- `features/savings/savings-by-level.component.ts`
- `features/savings/savings-timeseries-chart.component.ts`
- `features/savings/savings-filters.component.ts`

## Quick Refactoring Steps

For each remaining component:

1. **Read the component file** to find `template:` and `styles:` sections
2. **Extract template** to `component-name.html` (remove backticks)
3. **Extract styles** to `component-name.css` (remove backticks and array brackets)
4. **Update @Component decorator:**
   ```typescript
   // Before:
   template: `...`,
   styles: [`...`],
   
   // After:
   templateUrl: './component-name.html',
   styleUrls: ['./component-name.css'],
   ```

## Pattern to Find

Search for: `template:\s*\`` and `styles:\s*\[\s*\``

The template content is between the first backtick after `template:` and the matching closing backtick.
The styles content is between the first backtick after `styles: [` and the matching closing backtick before `]`.
