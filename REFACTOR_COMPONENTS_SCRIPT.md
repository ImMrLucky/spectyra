# Component Refactoring Script

This document provides a guide for extracting inline templates and styles from Angular components.

## Components Completed ✅

1. ✅ `app.component.ts` → `app.component.html` + `app.component.css`
2. ✅ `org-switcher.component.ts` → `org-switcher.component.html` + `org-switcher.component.css`
3. ✅ `home.page.ts` → `home.page.html` + `home.page.css`
4. ✅ `login.page.ts` → `login.page.html` + `login.page.css`
5. ✅ `register.page.ts` → `register.page.html` + `register.page.css`
6. ✅ `settings.page.ts` → `settings.page.html` + `settings.page.css`

## Components Remaining

The following components still have inline templates/styles and need to be refactored:

### Pages
- `features/admin/admin.page.ts`
- `features/billing/billing.page.ts`
- `features/run/run.page.ts`
- `features/runs/runs.page.ts`
- `features/savings/savings.page.ts`
- `features/scenarios/scenarios.page.ts`
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

## Refactoring Steps

For each component:

1. **Extract Template:**
   - Find the `template: \`...\`` section
   - Copy the content (without the backticks)
   - Create `component-name.html` in the same directory
   - Paste the template content

2. **Extract Styles:**
   - Find the `styles: [\`...\`]` section
   - Copy the CSS content (without the backticks and array brackets)
   - Create `component-name.css` in the same directory
   - Paste the CSS content

3. **Update Component Decorator:**
   - Replace `template: \`...\`` with `templateUrl: './component-name.html'`
   - Replace `styles: [\`...\`]` with `styleUrls: ['./component-name.css']`

## Example

**Before:**
```typescript
@Component({
  selector: 'app-example',
  template: `<div>Hello</div>`,
  styles: [`div { color: red; }`],
})
```

**After:**
```typescript
@Component({
  selector: 'app-example',
  templateUrl: './example.component.html',
  styleUrls: ['./example.component.css'],
})
```

## Automated Script (Optional)

You can use this regex pattern to help identify components:
- Template: `template:\s*\`(.*?)\``
- Styles: `styles:\s*\[\s*\`(.*?)\`\s*\]`

Note: Be careful with nested backticks and complex templates.
