// Large fixture for the fixtures/large performance benchmark (architecture §13,
// work-plan Stage 15/20). Sizable enough to exercise compile/watch latency and
// binary IPC transfer without external packages.

#set page(
  paper: "a4",
  margin: 2cm,
)

#set text(size: 10pt)

= Large Document Fixture

This fixture is used by the performance decision gate: it measures the transfer
and memory profile of the preview pipeline across Tauri binary IPC. Keep it
self-contained (no imports, no images, no packages).

#let chapter(n, title) = block[
  = Chapter #n — #title

  #lorem(180)

  == A table for chapter #n

  #table(
    columns: 4,
    table.header([Index], [Value], [Parity], [Label]),
    ..range(40)
      .map(i => (
        i + 1,
        str(calc.rem(i * 7, 1000)),
        if calc.rem(i, 2) == 0 { "even" } else { "odd" },
        "chapter-#n-item-#i",
      ))
      .flatten()
      .map(v => [#v]),
  )

  == An equation for chapter #n

  $ S_n = sum_(k=1)^n k = (n(n+1)) / 2 $

  #lorem(120)
]

#chapter(1, "Foundations")
#pagebreak()
#chapter(2, "Methods")
#pagebreak()
#chapter(3, "Experiments")
#pagebreak()
#chapter(4, "Results")
#pagebreak()
#chapter(5, "Discussion")
#pagebreak()
#chapter(6, "Limitations")
#pagebreak()
#chapter(7, "Related Work")
#pagebreak()
#chapter(8, "Future Directions")
#pagebreak()
#chapter(9, "Appendix A: Data")
#pagebreak()
#chapter(10, "Appendix B: Notation")

#align(center)[*End of large document fixture.*]
