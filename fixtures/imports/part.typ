// A small module imported by main.typ in the imports fixture.

#let greeting = block[
  _Greetings from a shared module._
]

#let make-box(body) = box(
  stroke: 0.5pt,
  inset: 6pt,
  radius: 3pt,
  body,
)
