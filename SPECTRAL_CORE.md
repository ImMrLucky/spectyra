# Spectral Core v0 Implementation

## Algorithmic Flow

The optimizer follows this exact sequence:

1. **Unitize** → Convert messages into `SemanticUnit[]` with embeddings
2. **Build Graph** → Create signed weighted graph from units
3. **Signed Laplacian** → Compute L = D - W
4. **Eigenvalues** → Estimate λ₂ using power iteration
5. **Stability Index** → Compute from λ₂ and contradiction energy
6. **Recommendation** → REUSE / EXPAND / ASK_CLARIFY based on thresholds

## File Structure

```
apps/api/src/services/optimizer/
├── spectral/
│   ├── types.ts              # Core types (SemanticUnit, SignedGraph, SpectralResult, etc.)
│   ├── math.ts               # Math utilities (cosine, sigmoid, normalize, etc.)
│   ├── signedLaplacian.ts    # Build L = D - W from graph edges
│   ├── powerIteration.ts     # Estimate λ₂ using Rayleigh quotient
│   ├── stabilityIndex.ts     # Compute stability index from λ₂ and contradiction energy
│   └── spectralCore.ts       # Main spectralAnalyze() function
├── edgeBuilders/
│   ├── similarityEdges.ts    # Build similarity edges from embeddings
│   └── contradictionEdges.ts # Build contradiction edges from heuristics
├── unitize.ts                # Convert messages → SemanticUnit[]
├── buildGraph.ts             # Build SignedGraph from units
└── optimizer.ts              # Main optimize() function that wires everything

```

## Key Components

### Spectral Options

```typescript
{
  tLow: 0.35,              // stabilityIndex <= tLow => ASK_CLARIFY
  tHigh: 0.70,             // stabilityIndex >= tHigh => REUSE
  maxNodes: 50,            // Limit graph size
  similarityEdgeMin: 0.90,  // Minimum cosine similarity for edges
  contradictionEdgeWeight: -0.8  // Weight for contradiction edges
}
```

### Spectral Result

```typescript
{
  nNodes: number,
  nEdges: number,
  lambda2: number,              // Second smallest eigenvalue
  contradictionEnergy: number,  // Normalized negative edge weight
  stabilityIndex: number,       // [0,1] computed via sigmoid
  recommendation: "REUSE" | "EXPAND" | "ASK_CLARIFY",
  stableNodeIdx: number[],      // Indices of stable nodes
  unstableNodeIdx: number[]     // Indices of unstable nodes
}
```

## How It Works

1. **Unitization**: Messages are chunked and embedded. Each chunk becomes a `SemanticUnit` with:
   - `id`: Unique identifier
   - `kind`: fact | constraint | explanation | code | patch
   - `text`: Original text
   - `embedding`: Vector embedding
   - `stabilityScore`: Initially 0.5, updated after spectral analysis

2. **Graph Building**:
   - **Similarity edges**: Cosine similarity > threshold → positive weight
   - **Contradiction edges**: Numeric conflicts or negation patterns → negative weight
   - Graph limited to last `maxNodes` units

3. **Spectral Analysis**:
   - Build signed Laplacian L = D - W
   - Estimate λ₂ (second smallest eigenvalue) using power iteration
   - Compute contradiction energy (fraction of negative edges)
   - Compute stability index: `sigmoid(1.8 * λ₂ - 3.0 * contradictionEnergy)`

4. **Recommendation**:
   - `stabilityIndex >= tHigh` → **REUSE**: Aggressive compaction, delta prompting
   - `stabilityIndex <= tLow` → **ASK_CLARIFY**: Ask clarifying question
   - Otherwise → **EXPAND**: Moderate compaction

5. **Policy Application**:
   - **Talk Policy**: Context compaction, delta prompting, output trimming
   - **Code Policy**: Code slicing, patch mode, dependency tracking

## Debug Output

The optimizer returns debug information including:
- `nNodes`, `nEdges`: Graph statistics
- `lambda2`: Spectral gap
- `stabilityIndex`: Computed stability (0-1)
- `recommendation`: REUSE/EXPAND/ASK_CLARIFY
- `stableUnitIds`, `unstableUnitIds`: Which units are stable/unstable

This is displayed in the UI debug tab.

## Notes

- **Small matrix assumption**: Designed for graphs ≤ 50 nodes
- **MVP eigenvalue estimation**: Uses power iteration + Rayleigh quotient
- **Future enhancement**: Can swap in a proper numeric eigensolver library
- **Contradiction detection**: Uses lightweight heuristics (numeric conflicts, negation patterns)
- **No fine-tuning required**: Works with any LLM embeddings
