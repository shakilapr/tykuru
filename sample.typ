// ==============================================================================
// TYKURU COMPREHENSIVE TYPST VERIFICATION & SHOWCASE SUITE
// A full-scale scientific and research-paper document exercising all Typst capabilities
// ==============================================================================

#set page(
  paper: "a4",
  margin: (top: 2.5cm, bottom: 2.5cm, left: 2.2cm, right: 2.2cm),
  header: context [
    #if counter(page).get().first() > 1 [
      #set text(8pt, fill: rgb("#6b7280"), font: ("Times New Roman", "Georgia", "Cambria", "DejaVu Serif"))
      #grid(
        columns: (1fr, 1fr),
        align(left)[*Tykuru Scientific Review* · Vol. 42, No. 1],
        align(right)[*Comprehensive Typst Verification Suite*],
      )
      #v(-0.5em)
      #line(length: 100%, stroke: 0.4pt + rgb("#d1d5db"))
    ]
  ],
  footer: context [
    #set text(8.5pt, fill: rgb("#6b7280"), font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"))
    #line(length: 100%, stroke: 0.4pt + rgb("#e5e7eb"))
    #v(0.3em)
    #grid(
      columns: (1fr, 1fr, 1fr),
      align(left)[*Tykuru Project / Verification*],
      align(center)[Typst 0.15.1 Native Engine],
      align(right)[Page #counter(page).display("1 of 1", both: true)],
    )
  ]
)

// Global Typography Rules
#set text(
  font: ("Times New Roman", "Georgia", "Cambria", "DejaVu Serif"),
  size: 10pt,
  lang: "en",
  fill: rgb("#1f2937"),
  spacing: 120%,
)

#set par(justify: true, leading: 0.68em)
#set heading(numbering: "1.1")

#show heading: it => block(above: 1.2em, below: 0.7em)[
  #set text(
    font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"),
    fill: rgb("#1e3a8a"),
    weight: "bold"
  )
  #if it.level == 1 {
    text(size: 13pt)[#it]
  } else if it.level == 2 {
    text(size: 11pt, fill: rgb("#1e40af"))[#it]
  } else {
    text(size: 10pt, fill: rgb("#374151"))[#it]
  }
]

#show raw: set text(font: ("Consolas", "Cascadia Code", "Courier New", "DejaVu Sans Mono"), size: 8.5pt)
#show link: it => text(fill: rgb("#2563eb"), underline(stroke: 0.5pt + rgb("#93c5fd"), offset: 2pt, it))

// ------------------------------------------------------------------------------
// Custom Environments: Admonitions, Theorems, Definitions, Proofs, Algorithms
// ------------------------------------------------------------------------------

#let callout(title: none, icon: "💡", body, color: rgb("#3b82f6")) = {
  block(
    fill: color.lighten(94%),
    stroke: (left: 4pt + color, rest: 0.5pt + color.lighten(70%)),
    inset: (x: 12pt, y: 10pt),
    radius: (right: 4pt),
    width: 100%,
  )[
    #if title != none [
      #text(weight: "bold", fill: color.darken(30%), font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"))[#icon #title]
      #v(0.3em)
    ]
    #set text(fill: rgb("#1f2937"))
    #body
  ]
}

#let thm-counter = counter("theorem")
#let def-counter = counter("definition")

#let theorem(title: none, body) = {
  thm-counter.step()
  block(
    fill: rgb("#f0fdf4"),
    stroke: (left: 3.5pt + rgb("#16a34a"), rest: 0.5pt + rgb("#bbf7d0")),
    inset: (x: 12pt, y: 9pt),
    radius: (right: 4pt),
    width: 100%,
    above: 0.8em,
    below: 0.8em,
  )[
    #context [
      #text(weight: "bold", fill: rgb("#15803d"), font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"))[
        Theorem #thm-counter.display() #if title != none [ (#title)] :
      ]
    ]
    #emph(body)
  ]
}

#let definition(title: none, body) = {
  def-counter.step()
  block(
    fill: rgb("#eff6ff"),
    stroke: (left: 3.5pt + rgb("#2563eb"), rest: 0.5pt + rgb("#bfdbfe")),
    inset: (x: 12pt, y: 9pt),
    radius: (right: 4pt),
    width: 100%,
    above: 0.8em,
    below: 0.8em,
  )[
    #context [
      #text(weight: "bold", fill: rgb("#1d4ed8"), font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"))[
        Definition #def-counter.display() #if title != none [ (#title)] :
      ]
    ]
    #body
  ]
}

#let proof(body) = [
  #block(above: 0.5em, below: 0.8em)[
    #text(weight: "bold", style: "italic", fill: rgb("#374151"))[Proof.] #body
    #align(right)[#text(size: 11pt)[$square$]]
  ]
]

#let badge(txt, color: rgb("#2563eb")) = {
  box(
    fill: color.lighten(90%),
    stroke: 0.6pt + color.lighten(40%),
    inset: (x: 5pt, y: 2.5pt),
    radius: 3pt,
    outset: (y: 1pt),
    text(size: 7.5pt, fill: color.darken(20%), weight: "bold", font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"), txt)
  )
}

// ------------------------------------------------------------------------------
// Document Header & Academic Metadata
// ------------------------------------------------------------------------------

#align(center)[
  #badge("PEER-REVIEWED RESEARCH ARTIFACT", color: rgb("#16a34a"))
  #h(6pt)
  #badge("DOI: 10.1000/tykuru.2026.08", color: rgb("#2563eb"))
  #h(6pt)
  #badge("OPEN SOURCE SPECIFICATION", color: rgb("#7c3aed"))
  
  #v(0.8em)
  #text(
    size: 22pt,
    weight: "bold",
    font: ("Times New Roman", "Georgia", "Cambria", "DejaVu Serif"),
    fill: rgb("#111827"),
  )[
    Universal Typesetting & Rendering Verification:\
    A Multi-Domain Typst Paradigm Analysis
  ]
  
  #v(0.5em)
  #text(size: 11pt, style: "italic", fill: rgb("#4b5563"))[
    Comprehensive Benchmark Specification for the Tykuru Compilation & Preview Engine
  ]

  #v(1.2em)
  
  // Author Grid
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 1.5em,
    [
      #text(weight: "bold", size: 10.5pt)[Dr. Elizabeth Vance]\
      #text(size: 8.5pt, fill: rgb("#4b5563"))[
        Dept. of Computer Science\
        Institute for Advanced Layout\
        #link("mailto:e.vance@tykuru.dev")[e.vance\@tykuru.dev]
      ]
    ],
    [
      #text(weight: "bold", size: 10.5pt)[Prof. Marcus H. Sterling]\
      #text(size: 8.5pt, fill: rgb("#4b5563"))[
        Center for Scientific Computing\
        Polytechnic Research Lab\
        #link("mailto:m.sterling@tykuru.dev")[m.sterling\@tykuru.dev]
      ]
    ],
    [
      #text(weight: "bold", size: 10.5pt)[Sora Takahashi, M.Sc.]\
      #text(size: 8.5pt, fill: rgb("#4b5563"))[
        Systems Architecture Group\
        Open Source Foundation\
        #link("mailto:sora@tykuru.dev")[sora\@tykuru.dev]
      ]
    ]
  )
  
  #v(0.8em)
  #text(size: 8.5pt, fill: rgb("#6b7280"))[Received: August 15, 2026 / Accepted: August 23, 2026 / Published Online: August 24, 2026]
]

#v(1em)

// Abstract & Keywords Box
#align(center)[
  #block(
    width: 95%,
    stroke: 0.5pt + rgb("#cbd5e1"),
    inset: (x: 16pt, y: 14pt),
    radius: 4pt,
    fill: rgb("#f8fafc"),
  )[
    #align(left)[
      #text(weight: "bold", size: 10pt, font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"), fill: rgb("#0f172a"))[Abstract] ---
      This document serves as the canonical, multi-faceted verification suite and feature showcase for the *Tykuru* desktop application, its embedded Typst compiler sidecar, and its PDF.js preview engine. We evaluate rich typographic features, complex mathematical formulations, multi-line aligned proofs, interactive and styled data tables, vector diagrams synthesized with native graphics primitives, multi-language source code highlighting, and functional data-driven visualizations. Furthermore, we test bibliographical citation structures against classical foundational works (@shannon1948; @knuth1984; @turing1936; @lamport1994; @vaswani2017). The goal of this test suite is to guarantee absolute rendering fidelity, rock-solid stability across page boundaries, and seamless cross-platform performance.
      
      #v(0.6em)
      #line(length: 100%, stroke: 0.4pt + rgb("#e2e8f0"))
      #v(0.3em)
      #text(weight: "bold", size: 8.5pt, font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"), fill: rgb("#334155"))[Keywords:]
      #text(size: 8.5pt, fill: rgb("#475569"))[
        Typesetting Engines, Typst Compiler, Mathematical Notation, Vector Synthesis, Document Architecture, Desktop Preview.
      ]
    ]
  ]
]

#v(1.5em)

// Two-Column Outline / TOC Preview
#outline(indent: 1.5em, depth: 2)

#v(1.5em)
#line(length: 100%, stroke: 1pt + rgb("#3b82f6"))
#v(1.5em)

// ==============================================================================
// 1. TYPOGRAPHIC FOUNDATIONS & INLINE STRUCTURES
// ==============================================================================

= Typographic Foundations & Inline Structures

Typst provides state-of-the-art document processing with sub-millisecond incremental recompilation. In this section, we examine the full breadth of text transformations, typography styles, inline annotations, and multilingual capabilities.

== Comprehensive Inline Text Formatting

Text styling in Typst is clean, semantic, and deeply composable:
- *Standard Boldness*: *Strong weight emphasis* for core conceptual anchors.
- _Italicized Forms_: _Emphasis and italic script_ for terms and latin phrases such as _a priori_ and _in situ_.
- _*Combined Aesthetics*_: _*Bold italic styling*_ for critical mathematical alerts.
- #underline[Underline Styling]: #underline(stroke: 1pt + rgb("#2563eb"), offset: 2.5pt)[Custom stroke underlines with vertical offset].
- #strike[Strikethrough Syntax]: #strike(stroke: 1.2pt + rgb("#ef4444"))[Deprecated or superseded hypothesis].
- #highlight(fill: rgb("#fef08a"))[Highlighted Annotations]: High-visibility marker boxes with customized background fills.
- #smallcaps[Small Capitals]: #smallcaps[Acronyms & Structural Labels] formatted in classical small caps.
- #box(fill: rgb("#e0e7ff"), inset: (x: 4pt, y: 2pt), radius: 2pt)[#text(fill: rgb("#3730a3"), size: 8.5pt, font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"))[Inline Pill Box]]

== Multilingual Typography, Subscripts & Emojis

Document pipelines must handle UTF-8 symbols, sub/superscripts, chemical formulas, and emojis seamlessly:
- *Chemical Formulas & Isotopes*: Carbon-14 radioactive decay: $attach("C", tl: 14, bl: 6) -> attach("N", tl: 14, bl: 7) + e^(-) + macron(nu)_e$.
- *Subscripts and Superscripts*: Variable indexing $x_(i, j, k)^(n + 1)$ and relativistic notation $T^(mu nu) = (rho + p) u^mu u^nu + p g^(mu nu)$.
- *Unicode & Emojis*: 🚀 Quantum Rocket, 🦀 Rust Safety Engine, 📄 Document Pipeline, ⚡ Instant Watcher, ⚛️ Nuclear Physics, 🔬 Electron Microscope, 🌐 Global Network.
- *Greek & Mathematical Symbols*: $alpha, beta, gamma, delta, epsilon, zeta, eta, theta, iota, kappa, lambda, mu, nu, xi, pi, rho, sigma, tau, upsilon, phi, chi, psi, omega, Gamma, Delta, Theta, Lambda, Xi, Pi, Sigma, Phi, Psi, Omega$.

== Footnotes, Quotes and Admonitions

Inline references trigger automatic numbering and placement in page footers #footnote[Footnotes automatically track page flow and isolate footnotes per physical page.]. 

#quote(block: true, attribution: [Donald E. Knuth, *Literate Programming* (1984)])[
  "Let us change our traditional attitude to the construction of programs: Instead of imagining that our main task is to instruct a computer what to do, let us concentrate rather on explaining to human beings what we want a computer to do."
]

#callout(title: "Architecture Invariant Note", icon: "📌", color: rgb("#0284c7"))[
  Tykuru enforces a strict unidirectional preview pipeline: `Typst CLI -> Rendered PDF -> PDF.js Canvas`. The source `.typ` file on disk remains the absolute ground truth. Unsaved buffer states are held in memory by the CodeMirror editor and synchronized via atomic write operations.
]

// ==============================================================================
// 2. MATHEMATICAL FORMULATION & SCIENTIFIC RIGOR
// ==============================================================================

= Mathematical Formulation & Scientific Rigor

Typst features a modern, ultra-fast mathematical notation syntax that supersedes legacy TeX macros while preserving complete typographic rigor.

== Classical Field Equations

The covariant formulation of electrodynamics and general relativity demonstrates tensor indexing:

$ partial_mu F^(mu nu) = mu_0 J^nu \
  partial_mu tilde(F)^(mu nu) = 0 $

$ R_(mu nu) - 1/2 R g_(mu nu) + Lambda g_(mu nu) = (8 pi G) / c^4 T_(mu nu) $

== Multi-Line Aligned Proofs & Limit Derivations

Aligned equations use the `&` alignment anchor with step-by-step commentary:

$ ln(1 + x) &= sum_(k=1)^oo (-1)^(k+1) x^k / k \
            &= x - x^2/2 + x^3/3 - x^4/4 + cal(O)(x^5) quad "as" x -> 0 $

$ lim_(n -> oo) (1 + 1/n)^n &= lim_(n -> oo) exp(n ln(1 + 1/n)) \
                            &= lim_(n -> oo) exp(n (1/n - 1/(2 n^2) + cal(O)(1/n^3))) \
                            &= exp(1) = e $

== Quantum Mechanics & Dirac Notation

The time-dependent Schrödinger equation and state projection:

$ i planck frac(partial, partial t) |Psi(t) chevron.r = hat(H) |Psi(t) chevron.r $

$ chevron.l psi | phi chevron.r = integral_(-oo)^oo psi^*(x) phi(x) d x \
  hat(a) |n chevron.r = sqrt(n) |n - 1 chevron.r, quad hat(a)^dagger |n chevron.r = sqrt(n + 1) |n + 1 chevron.r $

== Piecewise Functions and Multidimensional Systems

Piecewise systems are expressed cleanly using the `cases` construct:

$ f(x, y) = cases(
  frac(sin(x^2 + y^2), x^2 + y^2) &"if" (x, y) != (0, 0),
  1                               &"if" (x, y) = (0, 0),
  0                               &"otherwise"
) $

== Matrix Algebra & Linear Transformations

Complex matrix equations, determinants, and block matrices:

$ mat(
  a_11, a_12, dots.h, a_(1 n);
  a_21, a_22, dots.h, a_(2 n);
  dots.v, dots.v, dots.down, dots.v;
  a_(m 1), a_(m 2), dots.h, a_(m n)
)
vec(x_1, x_2, dots.v, x_n)
=
vec(b_1, b_2, dots.v, b_m) $

$ det(A - lambda I) = |mat(
  a_11 - lambda, a_12, a_13;
  a_21, a_22 - lambda, a_23;
  a_31, a_32, a_33 - lambda
)| = 0 $

// ==============================================================================
// 3. FORMAL THEOREMS, DEFINITIONS & ALGORITHMS
// ==============================================================================

= Formal Theorems, Definitions & Algorithms

Rigorous computer science literature requires structured theorem boxes, definitions, and formatted pseudocode routines.

#definition(title: "Lipschitz Continuity")[
  Let $(X, d_X)$ and $(Y, d_Y)$ be metric spaces. A function $f: X -> Y$ is called *Lipschitz continuous* if there exists a real constant $K >= 0$ such that for all $x_1, x_2 in X$:
  $ d_Y (f(x_1), f(x_2)) <= K d_X (x_1, x_2) $
]

#theorem(title: "Banach Fixed-Point Theorem")[
  Let $(X, d)$ be a non-empty complete metric space with a contraction mapping $T: X -> X$ having Lipschitz constant $q in [0, 1)$. Then $T$ admits a unique fixed point $x^* in X$ such that $T(x^*) = x^*$. Furthermore, for any arbitrary initial element $x_0 in X$, the sequence $x_(n+1) = T(x_n)$ converges to $x^*$:
  $ lim_(n -> oo) x_n = x^* $
]

#proof[
  Let $x_0 in X$ and define $x_n = T^n (x_0)$. By induction, $d(x_(n+1), x_n) <= q^n d(x_1, x_0)$. For any $m > n >= 1$:
  $ d(x_m, x_n) <= sum_(i=n)^(m-1) d(x_(i+1), x_i) <= d(x_1, x_0) sum_(i=n)^(m-1) q^i <= frac(q^n, 1 - q) d(x_1, x_0) $
  Since $q < 1$, as $n -> oo$, $frac(q^n, 1 - q) -> 0$, showing $(x_n)_(n in NN)$ is a Cauchy sequence. Completeness of $X$ guarantees the existence of $x^* = lim x_n$. Continuity of $T$ yields $T(x^*) = x^*$.
]

== Structured Algorithm Specification

#align(center)[
  #block(
    width: 100%,
    stroke: 0.8pt + rgb("#334155"),
    radius: 4pt,
    fill: rgb("#fafafa"),
    inset: 12pt,
  )[
    #align(left)[
      #text(weight: "bold", size: 10pt, font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"), fill: rgb("#0f172a"))[
        Algorithm 1: Incremental Document Synchronization & Diff Propagation
      ]
      #v(0.3em)
      #line(length: 100%, stroke: 0.5pt + rgb("#cbd5e1"))
      #v(0.4em)
      
      #set text(size: 8.5pt, font: ("Consolas", "Cascadia Code", "Courier New", "DejaVu Sans Mono"))
      *Input:* Old document AST $cal(T)_"prev"$, incoming keystroke delta $Delta_k$, Session identifier $S_"id"$\
      *Output:* Updated revision token $cal(R)_"committed"$, dirty bounding region $cal(B)$\
      
      #line(length: 100%, stroke: 0.4pt + rgb("#e2e8f0"))
      #v(0.3em)
      
      #grid(
        columns: (2.5em, 1fr),
        row-gutter: 0.4em,
        [01:], [ *function* #text(fill: rgb("#2563eb"))[SyncBuffer]\($cal(T)_"prev"$, $Delta_k$, $S_"id"$\): ],
        [02:], [ #h(1.5em) $cal(L) arrow.l$ ComputeLineOffsetSpan($Delta_k$) ],
        [03:], [ #h(1.5em) *if* ValidateSessionToken($S_"id"$) $==$ #text(fill: rgb("#dc2626"))[INVALID] *then* ],
        [04:], [ #h(3.0em) *return* #text(fill: rgb("#dc2626"))[Err]\(StaleSessionRejected\) ],
        [05:], [ #h(1.5em) *end if* ],
        [06:], [ #h(1.5em) $cal(B) arrow.l$ ReparseRegionIncremental($cal(T)_"prev"$, $cal(L)$) ],
        [07:], [ #h(1.5em) $cal(P)_"cand" arrow.l$ CompileCandidatePDF($cal(T)_"prev"$, $cal(B)$) ],
        [08:], [ #h(1.5em) *while* LockAcquired($cal(P)_"cand"$) *do* ],
        [09:], [ #h(3.0em) AtomicRename($cal(P)_"cand"$, "revision-" + Timestamp() + ".pdf") ],
        [10:], [ #h(3.0em) $cal(R)_"committed" arrow.l$ CommitRevision($S_"id"$) ],
        [11:], [ #h(1.5em) *end while* ],
        [12:], [ #h(1.5em) *return* #text(fill: rgb("#16a34a"))[Ok]\($cal(R)_"committed"$, $cal(B)$\) ],
        [13:], [ *end function* ],
      )
    ]
  ]
]

// ==============================================================================
// 4. COMPLEX SCIENTIFIC TABLES & BENCHMARKS
// ==============================================================================

= Complex Scientific Tables & Benchmarks

Scientific documentation requires tables with merged cells (`colspan` / `rowspan`), colored metric tags, precision-aligned decimals, and distinct header shading.

#align(center)[
  #table(
    columns: (auto, 1.2fr, 1.2fr, 1.2fr, 1.2fr, 1.4fr),
    fill: (col, row) => {
      if row == 0 { rgb("#1e3a8a") }
      else if row == 1 { rgb("#3b82f6").lighten(70%) }
      else if calc.even(row) { rgb("#f8fafc") }
      else { none }
    },
    stroke: (col, row) => {
      if row == 0 { (bottom: 1.5pt + rgb("#1e3a8a")) }
      else { 0.4pt + rgb("#e2e8f0") }
    },
    align: (col, row) => {
      if row <= 1 { center + horizon }
      else if col == 0 { center + horizon }
      else if col >= 2 and col <= 4 { right + horizon }
      else { left + horizon }
    },
    
    // Top-Level Multi-column Header
    table.cell(colspan: 1, rowspan: 2)[#text(fill: white, weight: "bold")[Fixture ID]],
    table.cell(colspan: 1, rowspan: 2)[#text(fill: white, weight: "bold")[Module / Category]],
    table.cell(colspan: 3)[#text(fill: white, weight: "bold")[Performance Metrics (ms)]],
    table.cell(colspan: 1, rowspan: 2)[#text(fill: white, weight: "bold")[Compilation Status]],
    
    // Sub-headers
    [#text(weight: "bold", size: 8.5pt)[AST Parse]],
    [#text(weight: "bold", size: 8.5pt)[Layout Eval]],
    [#text(weight: "bold", size: 8.5pt)[PDF Export]],

    // Data Rows
    [FX-01], [Core Typography], [1.42], [3.18], [2.05], [#badge("VERIFIED", color: rgb("#16a34a"))],
    [FX-02], [Math Equations], [2.15], [5.40], [3.12], [#badge("VERIFIED", color: rgb("#16a34a"))],
    [FX-03], [Vector Synthesis], [3.80], [8.94], [4.65], [#badge("VERIFIED", color: rgb("#16a34a"))],
    [FX-04], [Unicode & Fonts], [4.10], [9.25], [5.80], [#badge("VERIFIED", color: rgb("#16a34a"))],
    [FX-05], [Large Document (50p)], [14.80], [38.40], [22.10], [#badge("OPTIMAL", color: rgb("#0284c7"))],
    [FX-06], [Bibliography Engine], [2.60], [4.90], [2.80], [#badge("VERIFIED", color: rgb("#16a34a"))],
    [FX-07], [Error Diagnostic], [0.90], [1.20], [---], [#badge("DIAGNOSTIC", color: rgb("#ea580c"))],
  )
]

// ==============================================================================
// 5. VECTOR SYNTHESIS & SCIENTIFIC ILLUSTRATIONS
// ==============================================================================

= Vector Synthesis & Scientific Illustrations

Typst provides rich vector graphic primitives (`rect`, `circle`, `line`, `polygon`, `place`, `grid`) allowing full architectural diagrams and charts to be drawn in pure code without external dependencies.

== High-Level Pipeline Architecture

Below is a schematic of the Tykuru system architecture, rendered with native Typst vector components:

#align(center)[
  #block(
    fill: rgb("#f8fafc"),
    stroke: 0.8pt + rgb("#cbd5e1"),
    inset: 16pt,
    radius: 6pt,
    width: 100%,
  )[
    #grid(
      columns: (1fr, 40pt, 1fr, 40pt, 1fr),
      align: center + horizon,
      
      // Node 1: Editor Layer
      rect(
        width: 100%,
        height: 65pt,
        fill: rgb("#dbeafe"),
        stroke: 1.2pt + rgb("#2563eb"),
        radius: 4pt,
      )[
        #align(center + horizon)[
          #text(weight: "bold", size: 9pt, fill: rgb("#1e40af"))[React + CodeMirror 6]\
          #text(size: 7.5pt, fill: rgb("#3b82f6"))[In-Memory Buffer]\
          #badge("UI Thread", color: rgb("#2563eb"))
        ]
      ],
      
      // Arrow 1
      [
        #text(size: 14pt, fill: rgb("#64748b"))[$arrow.r.double$]\
        #text(size: 6.5pt, fill: rgb("#94a3b8"))[Tauri IPC]
      ],
      
      // Node 2: Rust Host Core
      rect(
        width: 100%,
        height: 65pt,
        fill: rgb("#fef3c7"),
        stroke: 1.2pt + rgb("#d97706"),
        radius: 4pt,
      )[
        #align(center + horizon)[
          #text(weight: "bold", size: 9pt, fill: rgb("#92400e"))[Rust Core Host]\
          #text(size: 7.5pt, fill: rgb("#b45309"))[Session & File Lock]\
          #badge("Native Backend", color: rgb("#d97706"))
        ]
      ],
      
      // Arrow 2
      [
        #text(size: 14pt, fill: rgb("#64748b"))[$arrow.r.double$]\
        #text(size: 6.5pt, fill: rgb("#94a3b8"))[CLI Watcher]
      ],
      
      // Node 3: Typst Compiler & PDF.js
      rect(
        width: 100%,
        height: 65pt,
        fill: rgb("#dcfce7"),
        stroke: 1.2pt + rgb("#16a34a"),
        radius: 4pt,
      )[
        #align(center + horizon)[
          #text(weight: "bold", size: 9pt, fill: rgb("#14532d"))[Typst 0.15.1 Sidecar]\
          #text(size: 7.5pt, fill: rgb("#15803d"))[Immutable PDF Output]\
          #badge("Render Canvas", color: rgb("#16a34a"))
        ]
      ]
    )
    #v(0.8em)
    #text(size: 8pt, style: "italic", fill: rgb("#64748b"))[
      Figure 1: Architectural Data Flow from In-Memory State to PDF.js Canvas
    ]
  ]
]

== Visual Figure Asset Loading

We also verify the dynamic loading and cross-referencing of local SVG vector assets:

#figure(
  image("fixtures/images/logo.svg", width: 4.5cm),
  caption: [Project Vector Logo Asset imported dynamically from local workspace fixtures.],
) <fig-project-logo>

As illustrated in @fig-project-logo, the project logo is integrated directly into the compiled output with zero rasterization artifacts.

== Complex Geometric Shapes & Set Diagram

#align(center)[
  #grid(
    columns: (1fr, 1fr),
    gutter: 1.5cm,
    align: center + horizon,
    
    // Left: Coordinate Shapes
    block(stroke: 0.5pt + rgb("#cbd5e1"), inset: 10pt, radius: 4pt)[
      #text(weight: "bold", size: 9pt)[Geometric Primitives]\
      #v(0.5em)
      #grid(
        columns: (1fr, 1fr),
        gutter: 10pt,
        align: center + horizon,
        rect(width: 2.2cm, height: 1.5cm, fill: rgb("#e0e7ff"), stroke: 1pt + rgb("#4338ca"), radius: 3pt)[
          #align(center + horizon)[#text(size: 8pt, fill: rgb("#3730a3"))[Box]]
        ],
        circle(radius: 0.9cm, fill: rgb("#fee2e2"), stroke: 1pt + rgb("#b91c1c"))[
          #align(center + horizon)[#text(size: 8pt, fill: rgb("#991b1b"))[Circle]]
        ]
      )
      #v(0.5em)
      #polygon(
        fill: rgb("#fef9c3"),
        stroke: 1pt + rgb("#a16207"),
        (0cm, 0cm),
        (2.8cm, 0cm),
        (3.5cm, 0.8cm),
        (0.7cm, 0.8cm),
      )
    ],
    
    // Right: Set Theory Euler Diagram
    block(stroke: 0.5pt + rgb("#cbd5e1"), inset: 10pt, radius: 4pt)[
      #text(weight: "bold", size: 9pt)[Set Theory & Intersections]\
      #v(0.5em)
      #grid(
        columns: (1fr),
        align: center + horizon,
        [
          #circle(radius: 1.1cm, fill: rgb("#3b82f6").lighten(80%), stroke: 1.2pt + rgb("#2563eb"))[
            #align(center + horizon)[
              #text(size: 8pt, weight: "bold", fill: rgb("#1e40af"))[Typst $A$]
            ]
          ]
        ]
      )
      #text(size: 7.5pt, fill: rgb("#64748b"))[$A inter B$: High-Performance Real-Time Typesetting]
    ]
  )
]

// ==============================================================================
// 6. FUNCTIONAL SCRIPTING & DYNAMIC VISUALIZATIONS
// ==============================================================================

= Functional Scripting & Dynamic Visualizations

Typst is a complete functional programming language featuring arrays, dictionaries, lambdas, closures, and recursive data pipelines.

== Dynamic Chart Generation via Pure Typst Functions

We define a pure Typst function `#barchart(data)` that computes relative bar lengths dynamically and renders an annotated bar chart:

#let barchart(data, max-val: 100, bar-color: rgb("#2563eb")) = {
  block(
    width: 100%,
    fill: rgb("#f8fafc"),
    stroke: 0.5pt + rgb("#cbd5e1"),
    inset: 12pt,
    radius: 4pt,
  )[
    #text(weight: "bold", size: 9.5pt, font: ("Segoe UI", "Arial", "Calibri", "DejaVu Sans"), fill: rgb("#0f172a"))[
      Compilation Throughput Benchmark (Documents / sec)
    ]
    #v(0.8em)
    #for (label, val) in data [
      #let width-percent = (val / max-val) * 100%
      #grid(
        columns: (80pt, 1fr, 35pt),
        align: (left + horizon, left + horizon, right + horizon),
        gutter: 6pt,
        [#text(size: 8pt, weight: "bold", fill: rgb("#334155"))[#label]],
        [
          #block(
            width: width-percent,
            height: 12pt,
            fill: bar-color,
            radius: 2pt,
          )
        ],
        [#text(size: 8pt, font: ("Consolas", "Cascadia Code", "Courier New", "DejaVu Sans Mono"), fill: rgb("#475569"))[#val]]
      )
      #v(0.25em)
    ]
  ]
}

#let benchmark-data = (
  ("Basic Text", 94.5),
  ("Math Proofs", 78.2),
  ("Big Tables", 62.4),
  ("Vector Graphics", 53.8),
  ("Full Document", 81.0),
)

#barchart(benchmark-data, max-val: 100, bar-color: rgb("#3b82f6"))

== Array Mapping & Higher-Order Transformations

#let technologies = (
  (name: "Tauri 2", role: "Native OS Shell & IPC Host", lang: "Rust", color: rgb("#ea580c")),
  (name: "CodeMirror 6", role: "Extensible Modular Editor", lang: "TypeScript", color: rgb("#2563eb")),
  (name: "PDF.js", role: "Standard-Compliant PDF Canvas", lang: "JavaScript", color: rgb("#16a34a")),
  (name: "Typst CLI", role: "Incremental Fast Typesetter", lang: "Rust", color: rgb("#7c3aed")),
)

#align(center)[
  #grid(
    columns: (1fr, 1fr),
    gutter: 10pt,
    ..technologies.map(tech => block(
      fill: tech.color.lighten(94%),
      stroke: 0.5pt + tech.color.lighten(60%),
      inset: 8pt,
      radius: 3pt,
      width: 100%,
      align(left)[
        #grid(
          columns: (1fr, auto),
          [#text(weight: "bold", size: 9pt, fill: tech.color.darken(20%))[#tech.name]],
          [#badge(tech.lang, color: tech.color)]
        )
        #v(0.2em)
        #text(size: 7.5pt, fill: rgb("#4b5563"))[#tech.role]
      ]
    ))
  )
]

// ==============================================================================
// 7. MULTI-LANGUAGE SYNTAX HIGHLIGHTING
// ==============================================================================

= Multi-Language Syntax Highlighting

Tykuru accurately highlights source listings with custom line backgrounds, monospaced typography, and identifier contrast across diverse language paradigms.

== Rust Host Controller Implementation

```rust
// src-tauri/src/preview/revisions.rs
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RevisionToken {
    pub session_id: String,
    pub revision_number: u64,
    pub timestamp_ms: u64,
}

impl RevisionToken {
    pub fn next(&self) -> Self {
        Self {
            session_id: self.session_id.clone(),
            revision_number: self.revision_number + 1,
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() as u64)
                .unwrap_or(0),
        }
    }
}
```

== TypeScript Bridge & UI Client

```typescript
// src/bridge/previewBridge.ts
import { invoke } from "@tauri-apps/api/core";

export interface PreviewUpdateEvent {
  sessionId: string;
  revision: number;
  pdfPath: string;
}

export async function requestPdfRevision(sessionId: string): Promise<Uint8Array> {
  const bytes = await invoke<number[]>("get_preview_pdf_bytes", { sessionId });
  return new Uint8Array(bytes);
}
```

// ==============================================================================
// 8. BIBLIOGRAPHY & CITATION REFERENCES
// ==============================================================================

= Bibliography & Scholarly Citations

Academic documents rely on strict citation management. Typst automatically formats citations according to chosen styles (e.g., IEEE, APA, Nature, Chicago) while linking in-text references to the bibliography.

Foundational information theory was established by Shannon in his seminal treatise @shannon1948. Knuth transformed software documentation and typography through literate programming @knuth1984, while Lamport unified macro typesetting in @lamport1994. The limits of mechanical computability were delineated by Turing @turing1936. Modern deep learning and transformer attention mechanisms stem from Vaswani et al. @vaswani2017.

#v(1em)

#bibliography("sample.bib", title: [References], style: "ieee")

// ==============================================================================
// 9. APPENDIX: RAW TELEMETRY & SPECIFICATION SHEETS
// ==============================================================================

#pagebreak()

#heading(numbering: none)[Appendix A: Comprehensive Telemetry Specification]

#align(center)[
  #table(
    columns: (1fr, 2fr, 1.5fr, 1.2fr),
    fill: (x, y) => if y == 0 { rgb("#1e293b") } else if calc.even(y) { rgb("#f1f5f9") } else { none },
    stroke: 0.4pt + rgb("#cbd5e1"),
    align: (col, row) => if row == 0 { center } else { left },
    table.header(
      [#text(fill: white, weight: "bold")[Parameter]],
      [#text(fill: white, weight: "bold")[Specification & Target]],
      [#text(fill: white, weight: "bold")[Tolerances]],
      [#text(fill: white, weight: "bold")[Compliance]],
    ),
    [Watch Latency], [File event to compile trigger $< 25$ ms], [$plus.minus 5$ ms], [#badge("PASS", color: rgb("#16a34a"))],
    [PDF Sync Lock], [Candidate PDF atomically swapped], [Zero collision], [#badge("PASS", color: rgb("#16a34a"))],
    [Cache Isolation], [Bounded to `%LOCALAPPDATA%/tykuru`], [Strict sandbox], [#badge("PASS", color: rgb("#16a34a"))],
    [Memory Profile], [Resident set size $< 120$ MB], [$< 150$ MB peak], [#badge("PASS", color: rgb("#16a34a"))],
    [Font Fallback], [System font resolution with graceful fallbacks], [No crash], [#badge("PASS", color: rgb("#16a34a"))],
  )
]

#v(1.5em)

#callout(title: "Test Suite Verification Concluded", icon: "✅", color: rgb("#16a34a"))[
  All test vectors across typography, mathematical equations, theorems, algorithms, data grids, vector graphics, code blocks, and bibliographies have been compiled and verified against Typst `0.15.1`.
]
