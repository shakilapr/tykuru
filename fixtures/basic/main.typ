= Tykuru Test Document

This is a *basic* Typst fixture used by Tykuru's integration tests.

== Headings and structure

A short paragraph with #strong[emphasis] and #emph[italics].

=== An equation

$ sum_(k=1)^n k = (n (n+1)) / 2 $

=== A table

#table(
  columns: 3,
  table.header([Name], [Role], [Year]),
  [Alice], [Author], [2024],
  [Bob], [Editor], [2025],
  [Carol], [Reviewer], [2026],
)

#pagebreak()

== Second page

Some trailing content to exercise multi-page output.
