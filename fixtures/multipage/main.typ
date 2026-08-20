= Multipage Fixture

This fixture exercises multi-page layout, viewport preservation and scrolling.
It contains twelve or more pages of varied content.

== Page 1 — Introduction

A long introductory paragraph. #lorem(60)

#pagebreak()

== Page 2 — Equations

Inline math like $a^2 + b^2 = c^2$ and display math:

$ integral_0^1 x^2 dif x = 1/3 $

Another paragraph to fill the page. #lorem(80)

#pagebreak()

== Page 3 — Tables

#table(
  columns: 4,
  table.header([ID], [Name], [Category], [Score]),
  ..range(24)
    .map(i => (i + 1, "Item #" + str(i + 1), if calc.rem(i, 2) == 0 {"A"} else {"B"}, i * 3))
    .flatten()
    .map(v => [#v]),
)

#pagebreak()

== Page 4 — Lists

= Unordered list

- first item
- second item with a longer description to wrap lines across the page width
  - nested item
  - another nested item
- third item

+ Enumerated step one
+ Enumerated step two
+ Enumerated step three

#pagebreak()

== Page 5 — Code and quoting

#quote[
  A quoted paragraph that occupies several lines of text to demonstrate
  typographic emphasis and indentation within the preview.
]

#raw(
  lang: "rust",
  block: true,
  "fn main() {\n    println!(\"hello from the multipage fixture\");\n}",
)

#pagebreak()

== Page 6 — Strong emphasis

This paragraph has #strong[strong] text, #emph[emphasized] text, and
#strong[#emph[both combined]]. #lorem(50)

#pagebreak()

== Page 7 — Links and references

Visit #link("https://typst.app")[typst.app].

#pagebreak()

== Page 8 — Bibliography stub

Citations are exercised in the dedicated bibliography fixture. Here we simply
list references in text form so this page stays self-contained.

#lorem(90)

#pagebreak()

== Page 9 — Alignment

#align(center)[Centered line]

#align(right)[Right-aligned line]

#grid(
  columns: (1fr, 1fr),
  align: (left, right),
  [left cell], [right cell],
  [left again], [right again],
)

#pagebreak()

== Page 10 — Headings cascade

=== Third-level heading

Some content under a third-level heading. #lorem(30)

==== Fourth-level heading

Content under a fourth-level heading. #lorem(30)

#pagebreak()

== Page 11 — More math

$ bold(A) := vec(1, 2, 3) quad bold(B) := vec(4, 5, 6) $

$ norm(bold(A)) = sqrt(1^2 + 2^2 + 3^2) $

#lorem(40)

#pagebreak()

== Page 12 — Final page

A closing paragraph to complete the twelve-page document. #lorem(40)

#align(center)[*End of multipage fixture.*]
