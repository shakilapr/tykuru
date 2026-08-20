= Errors fixture

This document is intentionally invalid Typst and is used to verify that Tykuru
captures compiler diagnostics without panicking.

#this_function_does_not_exist[boom]

#table(columns: 2, [a])  // mismatched column count
