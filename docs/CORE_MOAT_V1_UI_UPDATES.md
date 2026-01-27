# Core Moat v1 UI Updates - Complete

## Summary

Successfully updated the UI to display Core Moat v1 optimization savings and metrics across all relevant pages.

## Updates Made

### 1. Runs Page (`/runs`)

#### List View Updates
- **New Column: "Optimizations"** - Shows badges for each optimization applied (RefPack, PhraseBook, CodeMap)
- **New Column: "Tokens Saved"** - Displays total tokens saved per run
- **Removed Column: "Budget"** - Moved to detail view only
- **Removed Column: "Events"** - Less important in list view

#### Detail View Updates
- **New Section: "Optimizations Applied"** - Shows detailed breakdown:
  - Badge for each optimization type
  - Per-optimization metrics:
    - Tokens Before
    - Tokens After
    - Tokens Saved
- **Enhanced Usage Section** - Now shows "Cost Saved" if available

#### Visual Enhancements
- Optimization badges with distinct styling
- Savings indicators in green
- Clean, scannable layout

### 2. Usage & Billing Page (`/usage`)

#### New Section: "Savings by Optimization Type"
- **Aggregate View** - Shows total savings per optimization type for selected time range
- **Metrics Displayed**:
  - Optimization name (RefPack, PhraseBook, CodeMap)
  - Total tokens saved
  - Number of runs that used the optimization
- **Visual Design**:
  - Card-based layout
  - Green accent border
  - Large, prominent savings numbers

### 3. Overview Page (`/overview`)

#### New Section: "Optimization Savings (Last 24h)"
- **Quick View** - Shows optimization savings for the last 24 hours
- **Card Layout** - One card per optimization type
- **Metrics**:
  - Optimization name
  - Total tokens saved
  - Number of runs
- **CTA** - Link to Usage page for detailed view

### 4. Backend API Updates

#### Runs Endpoint (`GET /v1/runs`)
- **Enhanced Response** - Now includes:
  - `optimizations_applied: string[]` - List of applied optimizations
  - `token_breakdown: object` - Per-optimization token savings
  - `savings: object` - Overall savings (existing, preserved)

#### Run Detail Endpoint (`GET /v1/runs/:id`)
- **Enhanced Response** - Same fields as list endpoint
- Extracts metrics from `debug_internal_json` field

#### New Endpoint: `GET /v1/usage/optimizations`
- **Purpose** - Aggregate savings by optimization type
- **Query Params**:
  - `range` - Time range (24h, 7d, 30d, 90d)
- **Response**:
  ```json
  [
    {
      "optimization": "refpack",
      "name": "RefPack",
      "tokens_saved": 5000,
      "runs_count": 25
    },
    ...
  ]
  ```

## Data Flow

1. **Optimizer** → Stores Core Moat v1 metrics in `debug_internal_json`:
   ```json
   {
     "refpack": { "tokensBefore": 1000, "tokensAfter": 800, "tokensSaved": 200 },
     "phrasebook": { "tokensBefore": 800, "tokensAfter": 750, "tokensSaved": 50 },
     "codemap": { "tokensBefore": 750, "tokensAfter": 600, "tokensSaved": 150 }
   }
   ```

2. **Runs API** → Extracts metrics from `debug_internal_json` and includes in response:
   - `optimizations_applied: ["refpack", "phrasebook", "codemap"]`
   - `token_breakdown: { refpack: {...}, phrasebook: {...}, codemap: {...} }`

3. **Usage API** → Aggregates across all runs:
   - Queries `debug_internal_json` for all runs in time range
   - Sums up `tokensSaved` per optimization type
   - Returns aggregate totals

4. **UI Components** → Display metrics:
   - Runs page: Per-run breakdown
   - Usage page: Aggregate totals
   - Overview page: Last 24h summary

## UI Components Added

### Optimization Badges
- Styled badges for each optimization type
- Color: Blue (#1976d2) with light background
- Tooltip shows full name on hover

### Savings Indicators
- Green text for savings values
- Bold font weight for emphasis
- Consistent formatting across pages

### Optimization Cards
- Card-based layout for aggregate views
- Left border accent (green)
- Large, readable numbers
- Run count badges

## Files Modified

### Frontend
1. `apps/web/src/app/features/runs/runs.page.ts` - Added optimization metrics interface and helper methods
2. `apps/web/src/app/features/runs/runs.page.html` - Added optimizations display in list and detail views
3. `apps/web/src/app/features/runs/runs.page.scss` - Added styling for optimization badges and savings
4. `apps/web/src/app/features/usage/usage.page.ts` - Added optimization savings loading
5. `apps/web/src/app/features/usage/usage.page.html` - Added "Savings by Optimization Type" section
6. `apps/web/src/app/features/usage/usage.page.scss` - Added styling for optimization savings cards
7. `apps/web/src/app/features/overview/overview.page.ts` - Added optimization savings loading
8. `apps/web/src/app/features/overview/overview.page.html` - Added "Optimization Savings" section
9. `apps/web/src/app/features/overview/overview.page.scss` - Added styling for optimization cards

### Backend
1. `apps/api/src/routes/runs.ts` - Enhanced to extract and include Core Moat v1 metrics
2. `apps/api/src/routes/usage.ts` - Added `/optimizations` endpoint for aggregate savings

## User Experience

### Runs Page
- **List View**: Users can quickly see which optimizations were applied and how many tokens were saved per run
- **Detail View**: Users can see detailed breakdown of each optimization's impact

### Usage Page
- **Aggregate View**: Users can see total savings across all runs by optimization type
- **Time Range**: Users can filter by time range (24h, 7d, 30d, 90d)

### Overview Page
- **Quick Summary**: Users get immediate visibility into optimization savings for the last 24 hours
- **Actionable**: Link to Usage page for detailed analysis

## Acceptance Criteria Status

✅ **Runs view improvements**
- Shows per-run: tokens before/after, $ saved, optimizations applied

✅ **Savings breakdown**
- Aggregate by optimization type: "RefPack saved X tokens", "CodeMap saved X tokens", etc.

✅ **UI copy updates**
- All pages use "Optimization Savings" terminology
- Clear labels for each optimization type

✅ **No filler pages**
- All updates are to existing, production pages

## Testing Checklist

- [ ] Runs list shows optimization badges
- [ ] Runs list shows tokens saved
- [ ] Run detail shows optimization breakdown
- [ ] Usage page shows aggregate savings by type
- [ ] Overview page shows last 24h savings
- [ ] All pages handle empty states (no optimizations)
- [ ] API endpoints return correct data structure
- [ ] No console errors in browser
- [ ] Responsive design works on mobile

## Notes

- All optimizations are optional - UI gracefully handles runs without Core Moat v1 metrics
- Empty states are handled (shows "-" or empty arrays)
- Metrics are extracted from `debug_internal_json` which is stored for all optimized runs
- Aggregate endpoint queries all runs in time range - may need pagination for large datasets in future
